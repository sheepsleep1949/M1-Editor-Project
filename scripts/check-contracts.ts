import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { strictEqual } from "node:assert";
const read = (file: string) =>
  JSON.parse(readFileSync(new URL("../" + file, import.meta.url), "utf8"));
const api = read("packages/contracts/openapi.json");
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
ajv.addSchema({ $id: "urn:campus:api", components: api.components });
for (const key of Object.keys(api.components.schemas)) {
  const validator = ajv.getSchema("urn:campus:api#/components/schemas/" + key);
  if (!validator) throw new Error("无法解析 " + key);
}
let examples = 0;
function check(schema: object, value: unknown, label: string) {
  const validate = ajv.compile({
    $id: "urn:campus:check:" + examples++,
    components: api.components,
    ...schema,
  });
  if (!validate(value))
    throw new Error(label + " " + JSON.stringify(validate.errors));
}
const exampleRoutes = [
  ["save-draft", "/api/v1/activities/{activityId}/draft", "put", "200"],
  ["execute-choice", "/api/v1/sessions/{sessionId}/choices", "post", "200"],
  ["publish", "/api/v1/activities/{activityId}/versions", "post", "201"],
  ["restore", "/api/v1/saves/{saveId}/restores", "post", "201"],
];
for (const [name, path, method, status] of exampleRoutes) {
  const operation = api.paths[path][method];
  check(
    operation.requestBody.content["application/json"].schema,
    read("fixtures/api/" + name + ".request.json"),
    name + " 请求",
  );
  if (name === "save-draft" || name === "execute-choice")
    check(
      operation.responses[status].content["application/json"].schema,
      read("fixtures/api/" + name + ".response.json"),
      name + " 响应",
    );
}
check(
  { $ref: "#/components/schemas/Error" },
  read("fixtures/api/revision-conflict.response.json"),
  "冲突错误",
);
check(
  { $ref: "#/components/schemas/Report" },
  read("fixtures/api/check-incomplete.response.json").data,
  "截断报告",
);
for (const name of ["normal", "restored-branch"]) {
  const fixture = read("fixtures/events/" + name + ".json");
  check(
    { $ref: "#/components/schemas/Session" },
    fixture.session,
    name + " Session",
  );
  for (const event of fixture.events)
    check({ $ref: "#/components/schemas/Event" }, event, name + " Event");
}
const report = read("fixtures/api/check-incomplete.response.json").data;
check(
  { $ref: "#/components/schemas/Report" },
  { ...report, complete: true, publishable: true, truncationReason: null },
  "完成报告的 null 原因",
);
const ids = new Set<string>();
let operations = 0;
for (const [path, methods] of Object.entries(api.paths))
  for (const operation of Object.values(methods as Record<string, any>)) {
    strictEqual(ids.has(operation.operationId), false, "重复 operationId");
    ids.add(operation.operationId);
    operations++;
    for (const match of path.matchAll(/\{([^}]+)\}/g))
      if (
        !operation.parameters?.some(
          (p: any) => p.in === "path" && p.name === match[1] && p.required,
        )
      )
        throw new Error("缺路径参数 " + path);
  }
console.log(
  `${operations} 个 HTTP 操作、${Object.keys(api.components.schemas).length} 个模型及 ${examples} 个样例通过引用与字段校验。此脚本不是业务接口实现验收。`,
);
