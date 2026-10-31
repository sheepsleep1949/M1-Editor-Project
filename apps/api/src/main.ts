import "dotenv/config";
import { db } from "./db";
import { createApp } from "./app";
const app = await createApp(db);
await app.listen({
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3001),
});
console.log("基础 API 已启动。业务接口按交接文档继续实现。");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    await db.$disconnect();
    process.exit(0);
  });
