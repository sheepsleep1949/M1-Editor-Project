import type { DraftState } from "./editorModel";

/** 修订冲突，UI 用它弹“草稿已被其他人修改，请刷新”。 */
export class RevisionConflictError extends Error {
  constructor() {
    super("草稿已被其他人修改，请刷新");
    this.name = "RevisionConflictError";
  }
}

type DraftDto = {
  activityId: string;
  revision: number;
  story: DraftState["story"];
  layout: DraftState["layout"];
  updatedAt: string;
};

/**
 * 保存草稿。
 *
 * - payload 必须携带 expectedRevision；后端按 `revision = expectedRevision` 条件更新，
 *   成功后 revision + 1，不符则返回 409 REVISION_CONFLICT。
 * - 契约里该接口还是 `planned`（后端未实现，返回 404），此时退回本地模拟：
 *   成功即 revision + 1，绝不写任何远程数据。
 */
export async function saveDraft(draft: DraftState): Promise<DraftState> {
  const payload = {
    expectedRevision: draft.revision,
    story: draft.story,
    layout: draft.layout,
  };
  try {
    const r = await fetch(`/api/v1/activities/${draft.activityId}/draft`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.status === 409) throw new RevisionConflictError();
    if (r.status === 404) return mockSave(draft);
    const body = await r.json();
    if (!r.ok) throw new Error(body?.error?.message ?? "保存失败");
    const d = body.data as DraftDto;
    return { activityId: d.activityId, revision: d.revision, story: d.story, layout: d.layout };
  } catch (e) {
    if (e instanceof RevisionConflictError) throw e;
    // 接口未接通（网络层失败）时同样退回本地模拟，保证基础界面可演示。
    if (e instanceof TypeError) return mockSave(draft);
    throw e;
  }
}

function mockSave(draft: DraftState): Promise<DraftState> {
  return Promise.resolve({ ...draft, revision: draft.revision + 1 });
}
