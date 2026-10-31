import { useState } from "react";
import { initialState, getChoices, applyChoice } from "@campus/engine";
import type { Story, RuntimeState } from "@campus/contracts";
import mockStory from "./mockStory.json";
import "./player.css";

// 玩家状态独立于 Story：story 是只读配置，state 单独维护，二者绝不混写。
const story = mockStory as unknown as Story;

function varLabel(id: string): string {
  return story.variables.find((v) => v.id === id)?.label ?? id;
}

export function PlayerEngine() {
  // 用 useState 维护“当前节点 + 全部布尔变量”的运行状态，初始来自纯引擎 initialState。
  const [state, setState] = useState<RuntimeState>(() => initialState(story));
  const [error, setError] = useState("");

  const node = story.nodes.find((n) => n.id === state.nodeId);
  const isEnding = node?.kind === "ending";

  // 选项永远由引擎 getChoices 按当前状态计算，绝不在前端写死任何条件判断。
  const choices = isEnding ? [] : getChoices(story, state);

  const choose = (choiceId: string) => {
    // 只提交“选择意图”，新状态由纯引擎 applyChoice 算出。
    const result = applyChoice(story, state, choiceId);
    if (result.ok) {
      setState(result.state);
      setError("");
    } else {
      setError(result.error.message);
    }
  };

  const restart = () => {
    setState(initialState(story));
    setError("");
  };

  const items = story.variables.filter((v) => v.kind === "item");
  const flags = story.variables.filter((v) => v.kind === "flag");

  return (
    <div className="player-shell">
      <header className="player-top">
        <h1>{story.title}</h1>
        <div className="player-top-right">
          <span className="player-node-title">当前：{node?.title}</span>
          <button type="button" onClick={restart}>
            重新开始
          </button>
        </div>
      </header>

      <div className="player-main">
        <section className="player-scene">
          <p className="player-body">{node?.body}</p>

          {isEnding ? (
            <p className="player-ending">【本故事到此结束】</p>
          ) : (
            <div className="player-choices">
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!c.available}
                  onClick={() => choose(c.id)}
                >
                  <span>{c.label}</span>
                  {!c.available && (
                    <small>缺少：{c.unmet.map((u) => varLabel(u.variableId)).join("、")}</small>
                  )}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="player-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <aside className="player-side">
          <h2>道具</h2>
          {items.length === 0 ? (
            <p className="player-empty">（无道具）</p>
          ) : (
            items.map((v) => (
              <div key={v.id} className="player-var">
                <span>{v.label}</span>
                <b className={state.values[v.id] ? "on" : "off"}>
                  {state.values[v.id] ? "已获得" : "未获得"}
                </b>
              </div>
            ))
          )}
          {flags.length > 0 && (
            <>
              <h2>状态标记</h2>
              {flags.map((v) => (
                <div key={v.id} className="player-var">
                  <span>{v.label}</span>
                  <b className={state.values[v.id] ? "on" : "off"}>
                    {state.values[v.id] ? "true" : "false"}
                  </b>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
