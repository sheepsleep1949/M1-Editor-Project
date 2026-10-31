# 互动剧情平台前期交接包

本目录交付五人前期设计的代码和数据基线。先读配套的《00 共同接口与交接规范》，再读自己的 M1 至 M5 文档。个人姓名待团队认领。

## 已经可以运行

- React + Vite 前端、Fastify 后端、Prisma + SQLite 迁移。
- 本地演示账号登录、查询本人登录状态、退出、数据库健康检查。
- 两个独立剧情 JSON 与布局 JSON，登录后以只读节点图展示。
- 唯一纯规则引擎、结构检查、手工期望路径及测试。
- 正常、恢复分支和损坏事件样例；正常样例一致性验证脚本。

## 尚未实现

正式编辑器、草稿业务 API、完整状态搜索、发布、权威试玩事务、存档恢复、正式回放及反馈统计。OpenAPI 的 `x-implementation-status` 标明每个接口状态，声明了契约不代表接口已上线。未实现接口返回 404，不返回虚假的成功数据。

跨电脑启动、五人互审、真实需求访谈与用户测试也尚未发生；G0 和 G1 未整体通过。测试通过数不代表全平台完成度。

## 首次启动

要求 Node 22.12+；本机验证使用 Node 24.22.1。固定依赖版本由 `package-lock.json` 管理。请勿直接升级 Prisma，当前是 6.19.0 的 `$transaction` API。

在本目录打开终端，依次执行，遇到失败先修复，不继续声称成功：

```powershell
npm ci
Copy-Item .env.example .env
# 编辑 .env，设置你自己的 DEMO_PASSWORD，不少于 12 字符。
npm run db:generate
npm run db:deploy
npm run db:seed
npm run verify
npm run dev
```

已有 `.env` 时不要覆盖，按新字段补齐即可。npm 如果报告 Prisma/esbuild 安装脚本待批准，只审查并批准这些必要依赖，然后重跑 `db:generate`；不能把安装警告当作生成客户端成功。Node 和 npm 需在 PATH 中。

打开 `http://localhost:5173`。示例账号为 `creator@example.test` 和 `player@example.test`，密码来自首次 seed 的 `DEMO_PASSWORD`。账号名称不代表全局权限角色，同一个账号可以是一个活动的作者，也可以是另一个活动的玩家。

登录后点击“基准剧情”和“第二个剧情”，可观察两套 JSON 使用同一画布渲染。图为只读交接样例，暂不能编辑和发布。生产模式不注册 `/api/v1/dev/fixtures/:name`。

`WEB_ORIGIN` 默认 `http://localhost:5173`，写请求的 Origin 必须一致。如果浏览器改用 `http://127.0.0.1:5173`，需要同步修改这个变量。前端通过 Vite 代理访问本机 3001 端口。Cookie 为 HttpOnly/SameSite=Strict；生产配置下启用 Secure。

数据库默认位于 `apps/api/prisma/dev.db`。`db:deploy` 在首次运行时安全创建空文件，再部署已有迁移；已有数据不覆盖。`db:seed` 不重置已有密码，生产环境禁止执行。忘记本地演示密码时请明确选择重置方案，不随意删除已有数据库。

## 目录与责任

| 路径 | 主责 | 内容 |
|---|---|---|
| `apps/web` 创作页面、未来 API draft 模块 | M1 | 编辑表单、画布、草稿读写、素材目录 |
| `packages/engine`、未来 player 模块 | M2 | 规则执行、玩家体验、选择事务 |
| 现有结构检查、未来 validator 包 | M3 | 结构检查、有限状态搜索、发布报告 |
| `apps/api/src/db.ts`、auth、Prisma | M4 | 公共工程、权限工具、迁移、版本、存档 |
| 未来 events/replay/feedback 模块 | M5 | 事件写入、回放、反馈和统计 |
| `packages/contracts` | 全组；变更需受影响成员复核 | 唯一类型、Schema、OpenAPI、模块端口 |
| `fixtures` | 各样例负责人 | 独立测试数据，不是业务分支代码 |
| `handoff` | 全组 | 独立文档 HTML 源、交接单、状态和验证证据 |

当前基础程序集中在 `app.ts` 是启动骨架。接业务时按负责人拆路由与服务文件，不在这个文件里累积整个项目。

## 数据分离规则

1. `story` 只存剧情、变量、条件、效果和素材 ID，`layout` 独立存画布坐标。
2. `PublishedVersion` 保存完整固定快照；修改草稿不得修改旧版本。
3. `PlaySession.state` 属于单个玩家会话，不能写回故事的 `variables.initial`。
4. `Save` 绑定原版本；恢复产生新会话，原会话不变。
5. `PlayEvent` 为成功操作追加记录，与状态更新同事务；不能只写字符串日志。
6. 素材文件、授权、内容哈希和 ID 在素材目录管理；当前目录为空，纯文字正常。
7. `.env`、数据库、登录 Cookie、`node_modules` 不进入仓库和交接压缩包。
8. 禁止按具体故事名、节点 ID、道具名字、固定步骤编号写规则特判。协议常量集中管理；不能把“禁止硬编码”误解成没有任何平台常量。

## 接口与样例

- `packages/contracts/openapi.json`：26 个 HTTP 操作，完整输入、输出、身份和错误约定。
- `packages/contracts/src/index.ts`：共享业务类型。
- `packages/contracts/src/ports.ts`：模块间函数签名；接口声明不等于实现。
- `packages/contracts/story.schema.json`：运行时字段校验。
- `fixtures/api`：保存、冲突、执行选择、检查截断、发布、恢复请求响应。
- `fixtures/events`：正常、存档分支、缺失、乱序、篡改和重复访问反馈。
- `fixtures/expected`：人工写定的规则和错误预期，禁止由被测函数自动重写。

`versionId` 不存进可编辑 Story；由发布和会话关系提供。数据库事件不冗余存 versionId，API 必须从对应会话返回它。报告中 `snapshotDigest` 的示例字符串只用于说明结构，正式摘要需服务端 SHA-256。

## 验证与门禁

```powershell
npm run verify
```

依次运行类型检查、Vitest、事件样例一致性核对、接口引用与样例字段校验和前端生产构建。测试创建独立临时数据库，结束后只删除该临时测试目录，不操作开发数据库。

已有 25 项测试覆盖引擎预期、结构错误、登录、未登录拒绝、错误来源拒绝和基础事务回滚。它们尚未覆盖未实现的业务事务、发布、存档或回放器。不得把 `check-fixtures` 描述为正式回放服务验收。

团队验证记录填写 `handoff/handoff-record.example.json` 的实际字段，保留原模板另存自己的任务记录。收件人需在自己的机器按同一提交运行。G1 必须有真实状态和事件持久化，不能仅拿此骨架通过。

## 下一步的联合交接

M4 提供资源权限和固定版本加载约定；M1 先做草稿 API；M2 和 M5 一起做状态事件事务；M3 使用现有引擎写完整状态搜索。接口未就绪可用固定 fixture 开发，但阶段验收必须接真实服务。

变更 contracts 时同时更新实现方、至少一个调用方和样例。数据库变更先由 M4 合并 schema，再生成新迁移，不修改已经交接的旧迁移。代码、数据、说明和验证证据一起提交。

## 官方参考

- [Fastify 输入校验](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [Vite 项目说明](https://vite.dev/guide/)
- [React Flow 自定义节点](https://reactflow.dev/learn/customization/custom-nodes)

这些网页可能随新版本改变；本包的运行依据是锁定依赖和已验证代码，不将最新版 Prisma API 与 6.19 混用。
