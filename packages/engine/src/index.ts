import Ajv from "ajv";
import schema from "../../contracts/story.schema.json";
import type {
  Story,
  RuntimeState,
  ChoiceView,
  ApplyResult,
  Issue,
  Condition,
} from "@campus/contracts";
const shape = new Ajv({ allErrors: true }).compile(schema);
export function validateStructure(input: unknown): Issue[] {
  if (!shape(input))
    return [
      {
        code: "SCHEMA_INVALID",
        severity: "error",
        message: JSON.stringify(shape.errors),
      },
    ];
  const story = input as Story;
  const issues: Issue[] = [];
  const push = (code: string, message: string, where: Partial<Issue> = {}) =>
    issues.push({ code, message, severity: "error", ...where });
  const ids = new Set<string>();
  const variables = new Set<string>();
  const choices = new Set<string>();
  for (const v of story.variables) {
    if (variables.has(v.id))
      push("DUPLICATE_VARIABLE", "变量 ID 重复", { variableId: v.id });
    variables.add(v.id);
  }
  for (const n of story.nodes) {
    if (ids.has(n.id)) push("DUPLICATE_NODE", "节点 ID 重复", { nodeId: n.id });
    ids.add(n.id);
  }
  if (!ids.has(story.entryNodeId)) push("ENTRY_NOT_FOUND", "起点不存在");
  for (const n of story.nodes) {
    if (n.kind === "ending" && n.choices.length)
      push("ENDING_HAS_CHOICES", "结局不能继续选择", { nodeId: n.id });
    for (const c of n.choices) {
      const where = { nodeId: n.id, choiceId: c.id };
      if (choices.has(c.id))
        push("DUPLICATE_CHOICE", "选择 ID 在故事内必须唯一", where);
      choices.add(c.id);
      if (!ids.has(c.targetNodeId))
        push("TARGET_NOT_FOUND", "目标节点不存在", where);
      for (const x of [...c.conditions, ...c.effects])
        if (!variables.has(x.variableId))
          push("UNKNOWN_VARIABLE", "变量没有声明", {
            ...where,
            variableId: x.variableId,
          });
      if (new Set(c.effects.map((x) => x.variableId)).size !== c.effects.length)
        push("DUPLICATE_EFFECT", "同次操作不得重复修改同一变量", where);
      if (
        new Set(c.conditions.map((x) => x.variableId)).size !==
        c.conditions.length
      )
        push("DUPLICATE_CONDITION", "同个选择不得重复列出同一条件变量", where);
    }
  }
  if (issues.length) return issues;
  const visited = new Set<string>();
  const pending = [story.entryNodeId];
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    pending.push(
      ...story.nodes
        .find((n) => n.id === id)!
        .choices.map((c) => c.targetNodeId),
    );
  }
  for (const n of story.nodes)
    if (!visited.has(n.id))
      push("STRUCTURALLY_UNREACHABLE", "忽略条件也无法从起点到达", {
        nodeId: n.id,
      });
  return issues;
}
export function initialState(story: Story): RuntimeState {
  return {
    nodeId: story.entryNodeId,
    values: Object.fromEntries(story.variables.map((v) => [v.id, v.initial])),
  };
}
export function validState(story: Story, state: RuntimeState): boolean {
  return (
    !!state &&
    story.nodes.some((n) => n.id === state.nodeId) &&
    !!state.values &&
    Object.keys(state.values).length === story.variables.length &&
    story.variables.every((v) => typeof state.values[v.id] === "boolean")
  );
}
function unmet(conditions: Condition[], state: RuntimeState) {
  return conditions
    .filter((c) => state.values[c.variableId] !== c.equals)
    .map((c) => ({ ...c }));
}
// Caller must supply a structurally valid immutable snapshot. applyChoice still checks the boundary.
export function getChoices(story: Story, state: RuntimeState): ChoiceView[] {
  if (!validState(story, state)) throw new Error("INVALID_STATE");
  const node = story.nodes.find((n) => n.id === state.nodeId)!;
  if (node.kind === "ending") return [];
  return node.choices.map((c) => ({
    id: c.id,
    label: c.label,
    available: unmet(c.conditions, state).length === 0,
    unmet: unmet(c.conditions, state),
  }));
}
export function applyChoice(
  story: Story,
  state: RuntimeState,
  choiceId: string,
): ApplyResult {
  if (story.rulesVersion !== "1.0" || story.schemaVersion !== "1.0")
    return {
      ok: false,
      error: { code: "UNSUPPORTED_VERSION", message: "不支持的规则或格式版本" },
    };
  if (validateStructure(story).length)
    return {
      ok: false,
      error: { code: "INVALID_STORY", message: "请先修复剧情结构" },
    };
  if (!validState(story, state))
    return {
      ok: false,
      error: { code: "INVALID_STATE", message: "状态与剧情声明不匹配" },
    };
  const n = story.nodes.find((n) => n.id === state.nodeId)!;
  if (n.kind === "ending")
    return { ok: false, error: { code: "AT_ENDING", message: "已到结局" } };
  const c = n.choices.find((c) => c.id === choiceId);
  if (!c)
    return {
      ok: false,
      error: { code: "CHOICE_NOT_FOUND", message: "该选择不属于当前节点" },
    };
  const missing = unmet(c.conditions, state);
  if (missing.length)
    return {
      ok: false,
      error: {
        code: "CONDITION_NOT_MET",
        message: "条件未满足",
        details: missing,
      },
    };
  const next = { nodeId: c.targetNodeId, values: { ...state.values } };
  const delta = c.effects
    .filter((e) => state.values[e.variableId] !== e.value)
    .map((e) => ({
      variableId: e.variableId,
      before: state.values[e.variableId],
      after: e.value,
    }));
  for (const e of c.effects) next.values[e.variableId] = e.value;
  return { ok: true, state: next, delta };
}
// Event replay is explicitly the next task for M5.
export { validateStory, VALIDATOR_VERSION } from "./stateSearch";
