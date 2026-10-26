import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Story, Layout } from "@campus/contracts";
import { AuthorEditor } from "./author/AuthorEditor";
import "./style.css";
async function api(path: string, options: RequestInit = {}) {
  const r = await fetch("/api/v1" + path, {
    credentials: "same-origin",
    ...options,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "请求失败");
  return data.data;
}
function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [model, setModel] = useState<{ story: Story; layout: Layout } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  useEffect(() => {
    api("/auth/me")
      .then((u) => setUser(u.email))
      .catch(() => {});
  }, []);
  const load = async (name: string) => {
    try {
      setModel(await api("/dev/fixtures/" + name));
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const u = await api("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setUser(u.email);
      setPassword("");
      setMessage("登录成功，可查看两个配置样例。");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <main>
      <header>
        <p className="eyebrow">互动剧情创作与试玩验证平台</p>
        <h1>前期开发骨架</h1>
        <p>
          已接通登录、数据库与配置读取。下方是只读剧情结构样例，编辑、发布、在线试玩与回放将在后续任务中实现。
        </p>
      </header>
      {!user ? (
        <form onSubmit={login}>
          <label>
            演示账号
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button>登录</button>
        </form>
      ) : (
        <section className="toolbar">
          <span>{user}</span>
          <button onClick={() => load("baseline")}>基准剧情</button>
          <button onClick={() => load("second")}>第二个剧情</button>
        </section>
      )}
      {message && <p role="status">{message}</p>}
      {model && (
        <section>
          <h2>{model.story.title}</h2>
          <p>
            {model.story.nodes.length} 个节点 · {model.story.variables.length}{" "}
            个布尔变量 · 内容来自 JSON 配置
          </p>
          <div className="canvas">
            <ReactFlow
              key={model.story.title}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              nodes={model.story.nodes.map((n) => ({
                id: n.id,
                position: model.layout.positions[n.id] || { x: 0, y: 0 },
                data: { label: n.title },
                type: n.kind === "ending" ? "output" : "default",
              }))}
              edges={model.story.nodes.flatMap((n) =>
                n.choices.map((c) => ({
                  id: c.id,
                  source: n.id,
                  target: c.targetNodeId,
                  label: c.label,
                })),
              )}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </section>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  window.location.hash.startsWith("#/author") ? <AuthorEditor /> : <App />,
);
