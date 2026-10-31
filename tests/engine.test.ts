import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  initialState,
  applyChoice,
  validateStructure,
  getChoices,
} from "@campus/engine";
import type { Story } from "@campus/contracts";
const read = (p: string) =>
  JSON.parse(
    readFileSync(new URL("../fixtures/" + p, import.meta.url), "utf8"),
  );
const story: Story = read("stories/baseline.story.json");
const expected = read("expected/rules.expected.json");
describe("规则的独立预期", () => {
  for (const test of expected.cases)
    it(test.id, () => {
      let state = initialState(story);
      if (test.states) expect(state).toEqual(test.states[0]);
      for (let i = 0; i < test.choices.length; i++) {
        const before = structuredClone(state);
        const result = applyChoice(story, state, test.choices[i]);
        expect(state).toEqual(before);
        if (result.ok) {
          state = result.state;
          if (test.states) expect(state).toEqual(test.states[i + 1]);
        } else {
          expect(result.error.code).toBe(test.error);
          expect(state).toEqual(test.state);
          return;
        }
      }
      expect(test.error).toBeUndefined();
    });
  it("结局是终点", () => {
    const state = expected.cases[0].states.at(-1);
    expect(getChoices(story, state)).toEqual([]);
    expect(applyChoice(story, state, "c_quit")).toMatchObject({
      ok: false,
      error: { code: "AT_ENDING" },
    });
  });
  it("缺失变量状态拒绝", () => {
    expect(
      applyChoice(story, { nodeId: "n_start", values: {} }, "c_search"),
    ).toMatchObject({ ok: false, error: { code: "INVALID_STATE" } });
  });
  it("确定性和输入不变", () => {
    const state = initialState(story);
    const before = structuredClone(story);
    expect(applyChoice(story, state, "c_search")).toEqual(
      applyChoice(story, state, "c_search"),
    );
    expect(story).toEqual(before);
  });
  it("第二故事不修改引擎", () => {
    const second: Story = read("stories/second.story.json");
    let state = initialState(second);
    for (const c of ["radio_listen", "radio_door", "radio_stop"]) {
      const r = applyChoice(second, state, c);
      expect(r.ok).toBe(true);
      if (r.ok) state = r.state;
    }
    expect(state).toEqual({
      nodeId: "radio_end_stop",
      values: { heard_code: true },
    });
  });
  it("变量和节点改名后仍按配置工作", () => {
    const renamed = JSON.parse(
      JSON.stringify(story)
        .replaceAll("v_key", "custom_item")
        .replaceAll("n_start", "custom_entry"),
    );
    const result = applyChoice(renamed, initialState(renamed), "c_search");
    expect(result).toMatchObject({
      ok: true,
      state: { values: { custom_item: true } },
    });
  });
});
describe("结构错误样例", () => {
  for (const fixture of read("expected/validation.expected.json").cases.filter(
    (x: any) => x.phase === "structure",
  ))
    it(fixture.file, () => {
      expect(validateStructure(read(fixture.file)).map((x) => x.code)).toEqual(
        expect.arrayContaining(fixture.requiredCodes),
      );
    });
  it("两个正常剧情结构通过", () => {
    expect(validateStructure(story)).toEqual([]);
    expect(validateStructure(read("stories/second.story.json"))).toEqual([]);
  });
});
