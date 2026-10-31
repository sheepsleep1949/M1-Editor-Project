import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { playerService } from "./service";

/**
 * M2 player 路由骨架：三个接口先搭基础结构，服务端逻辑暂未连库（返回 501）。
 * 骨架阶段暂无鉴权接线，playerId 用占位；真实归属校验由 M4 的鉴权工具提供。
 */
export async function registerPlayerRoutes(
  app: FastifyInstance,
  _db: PrismaClient,
) {
  const service = playerService();

  const notImplemented = (reply: any, req: any, e: unknown) =>
    reply.code(501).send({
      error: {
        code: "NOT_IMPLEMENTED",
        message: (e as Error).message,
        requestId: req.id,
      },
    });

  app.post<{
    Params: { versionId: string };
    Body: { requestId: string; shareWithCreator: boolean };
  }>(
    "/api/v1/versions/:versionId/sessions",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["requestId", "shareWithCreator"],
          properties: {
            requestId: { type: "string", minLength: 1, maxLength: 128 },
            shareWithCreator: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const session = await service.createSession({
          versionId: req.params.versionId,
          playerId: "M2-SKELETON",
          requestId: req.body.requestId,
          shareWithCreator: req.body.shareWithCreator,
        });
        return { data: session };
      } catch (e) {
        return notImplemented(reply, req, e);
      }
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/v1/sessions/:sessionId",
    async (req, reply) => {
      try {
        const session = await service.getSession(req.params.sessionId);
        return { data: session };
      } catch (e) {
        return notImplemented(reply, req, e);
      }
    },
  );

  app.post<{
    Params: { sessionId: string };
    Body: { choiceId: string; expectedSeq: number; requestId: string };
  }>(
    "/api/v1/sessions/:sessionId/choices",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["choiceId", "expectedSeq", "requestId"],
          properties: {
            choiceId: { type: "string", minLength: 1, maxLength: 128 },
            expectedSeq: { type: "integer", minimum: 0 },
            requestId: { type: "string", minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (req, reply) => {
      // 事务固定顺序见 service.executeChoice 内注释：
      // 鉴权 → 回执 → 摘要 → seq → 版本 → applyChoice → 条件更新 → 事件
      try {
        const resp = await service.executeChoice({
          sessionId: req.params.sessionId,
          playerId: "M2-SKELETON",
          choiceId: req.body.choiceId,
          expectedSeq: req.body.expectedSeq,
          requestId: req.body.requestId,
        });
        return { data: resp };
      } catch (e) {
        return notImplemented(reply, req, e);
      }
    },
  );
}
