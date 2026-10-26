import "dotenv/config";
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
  console.log(
    "本地演示账号已就绪。已有账号未覆盖，密码来自首次初始化时的环境配置。",
  );
} finally {
  await db.$disconnect();
}
