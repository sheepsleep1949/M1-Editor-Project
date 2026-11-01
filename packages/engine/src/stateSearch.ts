import type {
  Issue,
  RuntimeState,
  Story,
  ValidationReport,
} from "@campus/contracts";
import { applyChoice, getChoices, initialState, validateStructure } from "./index";

// 与 packages/contracts/src/ports.ts 的 ValidationBudget / CoreValidation 保持结构一致；
// contracts 包仅导出根入口，这里按端口定义就地声明同构类型。
export type ValidationBudget = { maxStates: number; maxTimeMs: number };
export type CoreValidation = Pick<
  ValidationReport,
  "complete" | "publishable" | "visitedStates" | "truncationReason" | "issues"
>;

// M3 检查器版本。报告里的 validatorVersion 来自这里，变更算法语义时必须升版。
export const VALIDATOR_VERSION = "1.0";

/**
 * 完整状态搜索（M3-2 / M3-3）。
 *
 * 实现顺序按《M3 检查验证任务与交接》：
 * 1. 先跑结构检查，有阻断错误则不做状态搜索
 *    （complete=false、visitedStates=0、truncationReason=null）。
 * 2. 从 initialState 开始 BFS；状态键为 nodeId 加按变量声明顺序排列的
 *    全部布尔值 —— 同一节点在不同变量状态下是两个状态，绝不合并。
 * 3. 只用 getChoices/applyChoice 扩展“当前可执行”的转移。
 * 4. 记录每个状态的前驱选择（BFS 树）与全部转移边。
 * 5. 完整搜索后，从结局状态沿反向边找出无法到达任何结局的可达状态。
 *
 * 截断纪律：达到预算上限时 complete=false 且 publishable=false；
 * 只能报告已经观察到的局部事实（死端），绝不能根据“尚未找到”
 * 宣布 NO_ENDING_REACHABLE / ENDING_UNREACHABLE。
 */
export function validateStory(
  story: Story,
  budget: ValidationBudget,
): CoreValidation {
  const structural = validateStructure(story);
  if (structural.length)
    return {
      complete: false,
      publishable: false,
      visitedStates: 0,
      truncationReason: null,
      issues: structural,
    };

  const startedAt = Date.now();
  const variableIds = story.variables.map((v) => v.id);
  const keyOf = (s: RuntimeState) =>
    s.nodeId +
    "|" +
    variableIds.map((id) => (s.values[id] ? "1" : "0")).join("");

  const start = initialState(story);
  const states = new Map<string, RuntimeState>([[keyOf(start), start]]);
  const predecessor = new Map<string, { from: string; choiceId: string }>();
  const reverse = new Map<string, string[]>();
  const issues: Issue[] = [];
  let truncated: "STATE_LIMIT" | "TIME_LIMIT" | null = null;

  const pathTo = (key: string): string[] => {
    const path: string[] = [];
    let cursor = key;
    while (predecessor.has(cursor)) {
      const step = predecessor.get(cursor)!;
      path.unshift(step.choiceId);
      cursor = step.from;
    }
    return path;
  };

  const queue: RuntimeState[] = [start];
  for (let head = 0; head < queue.length && !truncated; head++) {
    if (Date.now() - startedAt > budget.maxTimeMs) {
      truncated = "TIME_LIMIT";
      break;
    }
    const state = queue[head];
    const fromKey = keyOf(state);
    const node = story.nodes.find((n) => n.id === state.nodeId)!;
    const views = getChoices(story, state);
    // 结局（含失败结局）是合法终点，不是死端。
    if (node.kind !== "ending" && views.every((v) => !v.available))
      issues.push({
        code: "NONTERMINAL_DEADLOCK",
        severity: "error",
        nodeId: state.nodeId,
        message: "非结局状态没有任何可执行的选择，玩家会卡死在这里",
        state,
        path: pathTo(fromKey),
        unmet: views.flatMap((v) => v.unmet),
      });
    for (const view of views) {
      if (!view.available) continue;
      const result = applyChoice(story, state, view.id);
      if (!result.ok)
        throw new Error(
          "引擎拒绝了状态搜索内的一致转移: " + result.error.code,
        );
      const toKey = keyOf(result.state);
      if (!reverse.has(toKey)) reverse.set(toKey, []);
      reverse.get(toKey)!.push(fromKey);
      if (!states.has(toKey)) {
        if (states.size >= budget.maxStates) {
          truncated = "STATE_LIMIT";
          break;
        }
        states.set(toKey, result.state);
        predecessor.set(toKey, { from: fromKey, choiceId: view.id });
        queue.push(result.state);
      }
    }
  }

  if (!truncated) {
    // 从所有可达结局状态沿反向边回溯，标记“能到达结局”的状态。
    const canReachEnding = new Set<string>();
    const stack: string[] = [];
    for (const [key, state] of states) {
      const node = story.nodes.find((n) => n.id === state.nodeId)!;
      if (node.kind === "ending") {
        canReachEnding.add(key);
        stack.push(key);
      }
    }
    while (stack.length) {
      const key = stack.pop()!;
      for (const from of reverse.get(key) ?? [])
        if (!canReachEnding.has(from)) {
          canReachEnding.add(from);
          stack.push(from);
        }
    }
    for (const [key, state] of states) {
      const node = story.nodes.find((n) => n.id === state.nodeId)!;
      if (node.kind !== "ending" && !canReachEnding.has(key))
        issues.push({
          code: "NO_ENDING_REACHABLE",
          severity: "error",
          nodeId: state.nodeId,
          message: "该状态有出口，但沿任何后续选择都无法到达任一结局",
          state,
          path: pathTo(key),
        });
    }
    for (const node of story.nodes)
      if (
        node.kind === "ending" &&
        ![...states.values()].some((s) => s.nodeId === node.id)
      )
        // 不可达结局没有可执行路径，不为它编造 path。
        issues.push({
          code: "ENDING_UNREACHABLE",
          severity: "error",
          nodeId: node.id,
          message: `结局「${node.title}」在完整状态空间内没有任何可达状态`,
        });
  }

  const complete = truncated === null;
  return {
    complete,
    // 不能只看 issues.length：预算耗尽可能还没来得及产生问题。
    publishable: complete && issues.every((i) => i.severity !== "error"),
    visitedStates: states.size,
    truncationReason: truncated,
    issues,
  };
}
