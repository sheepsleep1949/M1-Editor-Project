import { readFileSync } from "node:fs";
import { initialState, applyChoice } from "@campus/engine";
import { deepStrictEqual, strictEqual } from "node:assert";
import type { Story, Session, PlayEvent } from "@campus/contracts";
const read = (p: string) =>
  JSON.parse(
    readFileSync(new URL("../fixtures/" + p, import.meta.url), "utf8"),
  );
const story: Story = read("stories/baseline.story.json");
for (const name of ["normal", "restored-branch"]) {
  const fixture = read("events/" + name + ".json") as {
    session: Session;
    events: PlayEvent[];
  };
  let state = fixture.session.initialState;
  for (const [i, event] of fixture.events.entries()) {
    strictEqual(event.seq, i + 1);
    strictEqual(event.sessionId, fixture.session.id);
    strictEqual(event.versionId, fixture.session.versionId);
    deepStrictEqual(event.before, state);
    const result = applyChoice(story, state, event.choiceId);
    if (!result.ok) throw new Error(result.error.code);
    deepStrictEqual(result.state, event.after);
    deepStrictEqual(result.delta, event.delta);
    state = result.state;
  }
  deepStrictEqual(state, fixture.session.state);
  strictEqual(fixture.session.seq, fixture.events.length);
}
deepStrictEqual(
  read("events/normal.json").session.initialState,
  initialState(story),
);
const normal = read("events/normal.json");
const feedback = read("events/feedback.json");
deepStrictEqual(feedback.expectedBinding, {
  versionId: normal.session.versionId,
  nodeId: normal.events[1].after.nodeId,
  eventSeq: normal.events[1].seq,
});
console.log(
  "两个手工事件样例与反馈绑定已验证。损坏事件是待实现回放器的反例，未声称回放器通过。",
);
