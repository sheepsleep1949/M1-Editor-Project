import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { validateStory, VALIDATOR_VERSION } from "@campus/engine";
import { LIMITS, type Story, type ValidationReport } from "@campus/contracts";

export class CheckError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "CheckError";
  }
}

/**
 * 服务端 SHA-256 快照摘要。发布服务（M4）必须用同一算法对同一候选
 * 快照重新计算并比对，草稿修改后的旧报告不得用于发布。
 */
export function snapshotDigestOf(story: Story): string {
  return (
    "sha256:" + createHash("sha256").update(JSON.stringify(story)).digest("hex")
  );
}

/**
 * M3 检查服务：读取同修订草稿快照，运行纯检查，包装为正式报告。
 * 返回问题不算 HTTP 失败；complete=false 时 publishable 必为 false。
 */
export function validationService(db: PrismaClient) {
  return {
    async runCheck(input: {
      activityId: string;
      userId: string;
      expectedRevision: number;
    }): Promise<ValidationReport> {
      const activity = await db.activity.findUnique({
        where: { id: input.activityId },
        include: { draft: true },
      });
      // 仅所有者；非所有者一律按不存在处理，不泄露资源是否真实存在。
      if (!activity || activity.ownerId !== input.userId || !activity.draft)
        throw new CheckError(404, "NOT_FOUND", "活动不存在或无权访问");
      if (activity.draft.revision !== input.expectedRevision)
        throw new CheckError(
          409,
          "REVISION_CONFLICT",
          "草稿已被更新，请重新加载后合并。",
          {
            expectedRevision: input.expectedRevision,
            currentRevision: activity.draft.revision,
          },
        );
      const story = activity.draft.story as unknown as Story;
      // 预算由服务端集中配置，客户端不能放大。
      const core = validateStory(story, {
        maxStates: LIMITS.states,
        maxTimeMs: LIMITS.timeMs,
      });
      return {
        reportId: randomUUID(),
        activityId: activity.id,
        revision: activity.draft.revision,
        snapshotDigest: snapshotDigestOf(story),
        validatorVersion: VALIDATOR_VERSION,
        ...core,
      };
    },
  };
}
export type ValidationService = ReturnType<typeof validationService>;
