import type {
  Session,
  ExecuteChoiceRequest,
  ExecuteChoiceResponse,
} from "@campus/contracts";

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

/**
 * M2 服务：持有“选择操作”事务边界。
 * 真实版本 / 会话 / 事件端口接入后填充，现在是逻辑框架，不连数据库。
 */
export type PlayerService = {
  createSession(input: {
    versionId: string;
    playerId: string;
    requestId: string;
    shareWithCreator: boolean;
  }): Promise<Session>;
  getSession(sessionId: string): Promise<Session>;
  executeChoice(
    input: ExecuteChoiceRequest & { sessionId: string; playerId: string },
  ): Promise<ExecuteChoiceResponse>;
};

export function playerService(): PlayerService {
  return {
    async createSession() {
      // 未来：读取固定版本 → initialState(story) → 建会话(seq=0) → 写操作回执
      throw new NotImplementedError("会话创建将在接入 M4 版本端口后实现");
    },

    async getSession() {
      // 未来：校验归属后返回会话
      throw new NotImplementedError("会话读取将在接入数据库后实现");
    },

    async executeChoice() {
      // —— 选择执行事务的固定顺序（红线：任一步失败整体回滚，任何拒绝不得改变状态）——
      // ① 鉴权并确认归属：session.playerId 必须等于请求者，否则拒绝
      // ② 按 requestId 查同次操作回执；命中则返回原响应（幂等，不能先因旧 seq 拒绝正常重试）
      // ③ 比较请求摘要：同 requestId 但选择/序号不同 → 409 IDEMPOTENCY_CONFLICT
      // ④ 验证 expectedSeq === session.seq，否则 409 SEQUENCE_CONFLICT
      // ⑤ 读取固定版本（Story 快照）与当前会话状态
      // ⑥ 调用纯规则引擎 applyChoice(story, state, choiceId)，得到新状态与 delta
      // ⑦ 按旧 seq 条件更新会话（乐观并发，仅一次成功）
      // ⑧ 同事务 appendEvent(before/after/delta...)；状态成功而事件写失败 → 整体回滚
      throw new NotImplementedError(
        "选择执行将在接入 M4 版本端口与 M5 事件端口后实现",
      );
    },
  };
}
