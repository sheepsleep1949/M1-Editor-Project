import type { DbTx } from "../../db";
import type { Session, RuntimeState } from "@campus/contracts";

/**
 * M2 仓储骨架：真实实现将在接入 Prisma 后补上（领包指南第 3 天）。
 * 现在只声明方法签名与职责，全部抛 NOT_IMPLEMENTED，不连数据库。
 */
export type PlayerRepository = {
  createSession: (input: {
    versionId: string;
    playerId: string;
    initialState: RuntimeState;
    shareWithCreator: boolean;
  }) => Promise<Session>;
  findSession: (sessionId: string) => Promise<Session | null>;
  /** 乐观并发：仅当 seq === fromSeq 时更新；返回是否命中 */
  updateSessionIfSeq: (
    sessionId: string,
    fromSeq: number,
    state: RuntimeState,
    status: "active" | "ended",
  ) => Promise<boolean>;
};

export function playerRepository(_tx: DbTx): PlayerRepository {
  return {
    async createSession() {
      throw new Error("NOT_IMPLEMENTED");
    },
    async findSession() {
      throw new Error("NOT_IMPLEMENTED");
    },
    async updateSessionIfSeq() {
      throw new Error("NOT_IMPLEMENTED");
    },
  };
}
