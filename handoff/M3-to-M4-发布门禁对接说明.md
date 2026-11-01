# M3 → M4 发布门禁对接说明（一页）

面向 M4 发布服务（`POST /api/v1/activities/{activityId}/versions`）的约定。
以 `feat/m3-validation` 已落地代码为准，任何一侧改动都需两人复核。

## 1. 快照摘要算法（必须一致）

唯一实现：`apps/api/src/modules/validation/service.ts` 的 `snapshotDigestOf(story)`。

- 输入：候选 `Story` 对象（草稿或待发布快照）。
- 计算：`"sha256:" + sha256hex(JSON.stringify(story))`。
- M4 发布时必须对**同一份候选快照**调用同一函数（或逐字节等价实现），
  不得自行更换序列化方式（加空格、排序键、换编码都会得到不同摘要）。

## 2. 检查报告与修订绑定

`POST /api/v1/activities/{activityId}/checks`，body `{expectedRevision}`：

- 草稿 `revision !== expectedRevision` → 409 `REVISION_CONFLICT`，
  `details` 含 `{expectedRevision, currentRevision}`。
- 报告字段：`reportId / activityId / revision / snapshotDigest /
  validatorVersion / complete / publishable / visitedStates /
  truncationReason / issues`。
- `revision` 与 `snapshotDigest` 共同标识被检快照：报告只对
  「该活动 + 该修订 + 该摘要」有效。

## 3. 发布门禁条件（三条同时满足才可发布）

1. 存在对应修订的检查报告，且报告 `complete === true`
   （截断报告 `truncationReason` 非空，视为未检完，不是"没问题"）。
2. 报告 `publishable === true`：引擎保证它等价于
   「搜索完整 + 无 error 级问题 + 所有声明结局可达」，
   M4 不得只判 `issues.length === 0`。
3. 发布请求时刻：重新读取草稿，满足
   `draft.revision === report.revision` 且
   `snapshotDigestOf(draft.story) === report.snapshotDigest`。

## 4. 过期判定（检查后改草稿必须失效）

- 草稿每次保存都会自增 `revision`；修订变了，条件 3 直接失败。
- 同修订下内容被改写（未来若有无 revision 变化的写路径），摘要兜底。
- 判定失败 → 拒绝发布，建议 422 + 明确错误码（如 `VALIDATION_STALE`），
  提示作者重新运行检查。任何 error、未完成、过期修订都不可发布。

## 5. 建议的发布事务内顺序

读取草稿与最新报告 → 校验门禁三条 → 生成 `PublishedVersion`
（`sourceRevision = draft.revision`，`snapshotDigest` 存报告同值，
`story` 存被检快照原文）→ 同事务提交。任一步失败整体回滚，
与 M2 选择事务同一纪律。

## 6. 当前缺口（如实记录）

- 报告目前不落库，由检查接口即时返回；若 M4 需要"查最新报告"，
  需约定存储模型（可加 `ValidationReport` 表，键
  `(activityId, revision)` 唯一）。
- `validatorVersion` 现为 `1.0`；算法语义变更会升版，M4 可将其纳入
  报告有效性判断（版本不符视为过期）。
- 发布接口本身（M4 域）尚未实现；本说明只锁定 M3 侧的契约面。
