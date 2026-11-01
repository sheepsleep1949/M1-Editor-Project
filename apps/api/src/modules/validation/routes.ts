import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { CheckError, validationService } from "./service";

type Helpers = {
  userFor: (req: FastifyRequest) => Promise<{ id: string } | null>;
  fail: (
    reply: FastifyReply,
    req: FastifyRequest,
    status: number,
    code: string,
    message: string,
  ) => FastifyReply;
};

/**
 * M3 检查路由：POST /api/v1/activities/:activityId/checks
 * 鉴权与来源校验沿用 app.ts 的公共钩子；业务错误由服务层抛出。
 */
export async function registerValidationRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  helpers: Helpers,
) {
  const service = validationService(db);
  app.post<{
    Params: { activityId: string };
    Body: { expectedRevision: number };
  }>(
    "/api/v1/activities/:activityId/checks",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["expectedRevision"],
          properties: {
            expectedRevision: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const user = await helpers.userFor(req);
      if (!user)
        return helpers.fail(reply, req, 401, "UNAUTHENTICATED", "请先登录");
      try {
        const report = await service.runCheck({
          activityId: req.params.activityId,
          userId: user.id,
          expectedRevision: req.body.expectedRevision,
        });
        return { data: report };
      } catch (e) {
        if (e instanceof CheckError)
          return reply.code(e.status).send({
            error: {
              code: e.code,
              message: e.message,
              requestId: req.id,
              ...(e.details ? { details: e.details } : {}),
            },
          });
        throw e;
      }
    },
  );
}
