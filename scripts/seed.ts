import "dotenv/config";
import { readFileSync } from "node:fs";
import { db } from "../apps/api/src/db";
import { passwordHash } from "../apps/api/src/auth";
if (process.env.NODE_ENV === "production")
  throw new Error("禁止在生产环境初始化演示账号");
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error("请在 .env 中设置不少于 12 字符的 DEMO_PASSWORD");
try {
  for (const email of ["creator@example.test", "player@example.test"])
    await db.user.upsert({
      where: { email },
      create: { email, passwordHash: passwordHash(password) },
      update: {},
    });
  // 演示活动与草稿（基准剧情），供 M3 检查接口本地联调；已有数据不覆盖。
  const creator = await db.user.findUnique({
    where: { email: "creator@example.test" },
  });
  const fixture = (name: string) =>
    JSON.parse(
      readFileSync(
        new URL("../fixtures/stories/" + name, import.meta.url),
        "utf8",
      ),
    );
  await db.activity.upsert({
    where: { id: "demo-activity-baseline" },
    create: {
      id: "demo-activity-baseline",
      ownerId: creator!.id,
      title: "消失的活动策划书（演示）",
      draft: {
        create: {
          revision: 1,
          story: fixture("baseline.story.json"),
          layout: fixture("baseline.layout.json"),
        },
      },
    },
    update: {},
  });
  console.log(
    "本地演示账号已就绪。已有账号未覆盖，密码来自首次初始化时的环境配置。",
  );
} finally {
  await db.$disconnect();
}
