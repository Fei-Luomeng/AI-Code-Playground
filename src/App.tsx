import { useMemo, useState } from "react";
import { Button, ConfigProvider, Segmented, Select, Switch, Tooltip } from "antd";
import {
  ApiOutlined,
  AppstoreOutlined,
  BugOutlined,
  CodeOutlined,
  ConsoleSqlOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import ReactFlow, { Background, Controls, Edge, Node } from "react-flow-renderer";
import { create } from "zustand";
import axios from "axios";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";

type Language = "javascript" | "typescript" | "html";
type ModelName = "GLM-4.7-Flash" | "DeepSeek";

type PlaygroundState = {
  code: string;
  language: Language;
  output: string[];
  activeFile: string;
  model: ModelName;
  setCode: (code: string) => void;
  setLanguage: (language: Language) => void;
  setOutput: (output: string[]) => void;
  setActiveFile: (file: string) => void;
  setModel: (model: ModelName) => void;
};

const starterCode = `console.log("script start");

setTimeout(() => {
  console.log("setTimeout");
}, 0);

Promise.resolve()
  .then(() => console.log("promise then"));

console.log("script end");`;

const usePlaygroundStore = create<PlaygroundState>((set) => ({
  code: starterCode,
  language: "javascript",
  output: ["等待运行代码..."],
  activeFile: "index.js",
  model: "GLM-4.7-Flash",
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setOutput: (output) => set({ output }),
  setActiveFile: (file) => set({ activeFile: file }),
  setModel: (model) => set({ model }),
}));

const navItems = [
  { path: "/", label: "代码编辑", icon: <CodeOutlined /> },
  { path: "/output", label: "运行结果", icon: <ConsoleSqlOutlined /> },
  { path: "/ai", label: "AI分析", icon: <RobotOutlined /> },
  { path: "/visual", label: "可视化执行", icon: <ThunderboltOutlined /> },
  { path: "/history", label: "历史记录", icon: <HistoryOutlined /> },
  { path: "/settings", label: "设置", icon: <SettingOutlined /> },
];

const flowNodes: Node[] = [
  { id: "sync", position: { x: 40, y: 80 }, data: { label: "同步代码" }, type: "default" },
  { id: "stack", position: { x: 260, y: 30 }, data: { label: "Call Stack" } },
  { id: "micro", position: { x: 510, y: 30 }, data: { label: "Microtask Queue" } },
  { id: "macro", position: { x: 510, y: 160 }, data: { label: "Macrotask Queue" } },
  { id: "loop", position: { x: 760, y: 95 }, data: { label: "Event Loop" } },
];

const flowEdges: Edge[] = [
  { id: "e1", source: "sync", target: "stack", animated: true },
  { id: "e2", source: "stack", target: "micro", animated: true },
  { id: "e3", source: "stack", target: "macro", animated: true },
  { id: "e4", source: "micro", target: "loop", animated: true },
  { id: "e5", source: "macro", target: "loop", animated: true },
];

const analysisBlocks = [
  {
    title: "代码解释",
    icon: <CodeOutlined />,
    lines: ["第 1 行立即输出 script start", "setTimeout 注册宏任务", "Promise.then 进入微任务队列", "最后同步输出 script end"],
  },
  {
    title: "执行流程",
    icon: <AppstoreOutlined />,
    lines: ["同步任务先清空", "微任务队列优先执行", "宏任务在下一轮事件循环执行"],
  },
  {
    title: "面试追问",
    icon: <BugOutlined />,
    lines: ["Promise.then 属于什么队列？", "setTimeout 为什么后执行？", "宏任务和微任务的触发时机是什么？"],
  },
  {
    title: "优化建议",
    icon: <ApiOutlined />,
    lines: ["把异步流程拆成独立函数", "对复杂 Promise 链增加错误处理", "避免依赖 setTimeout(0) 作为严格顺序控制"],
  },
];

function runInIframeSandbox(code: string) {
  return new Promise<string[]>((resolve) => {
    const logs: string[] = [];
    const iframe = document.createElement("iframe");
    iframe.sandbox.add("allow-scripts");
    iframe.style.display = "none";

    const html = `
      <script>
        const send = (type, payload) => parent.postMessage({ source: "ai-code-playground", type, payload }, "*");
        console.log = (...args) => send("log", args.map(String).join(" "));
        console.error = (...args) => send("error", args.map(String).join(" "));
        try {
          ${code}
          setTimeout(() => send("done", null), 30);
        } catch (error) {
          send("error", error.message);
          send("done", null);
        }
      </script>
    `;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== "ai-code-playground") return;
      if (event.data.type === "log") logs.push(`> ${event.data.payload}`);
      if (event.data.type === "error") logs.push(`Error: ${event.data.payload}`);
      if (event.data.type === "done") {
        window.removeEventListener("message", handleMessage);
        iframe.remove();
        resolve(logs.length ? logs : ["代码已执行，无 console 输出"]);
      }
    };

    window.addEventListener("message", handleMessage);
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}

async function requestGlmAnalysis(code: string, output: string[], model: ModelName) {
  // 接入真实后端时，把 API Key 放在服务端，前端只请求自己的安全代理接口。
  return axios.post("/api/ai/analyze", {
    model,
    code,
    output,
    questionTypes: ["explain", "flow", "interview", "optimize"],
  });
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">AI</div>
        <div>
          <strong>AI Code</strong>
          <span>Playground</span>
        </div>
      </div>
      <nav>
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `navItem ${isActive ? "active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function EditorWorkspace() {
  const { code, language, output, activeFile, model, setCode, setLanguage, setOutput, setActiveFile } = usePlaygroundStore();
  const files = ["index.js", "utils.js", "demo.html"];

  const handleRun = async () => {
    const startedAt = performance.now();
    const logs = await runInIframeSandbox(code);
    const cost = Math.round(performance.now() - startedAt);
    setOutput([...logs, `执行时间: ${cost}ms`]);
    requestGlmAnalysis(code, logs, model).catch(() => undefined);
  };

  return (
    <main className="workspace">
      <section className="editorPanel glass">
        <div className="toolbar">
          <div className="tabs">
            {files.map((file) => (
              <button key={file} className={file === activeFile ? "tab active" : "tab"} onClick={() => setActiveFile(file)}>
                {file}
              </button>
            ))}
          </div>
          <div className="actions">
            <Select
              value={language}
              onChange={setLanguage}
              options={[
                { value: "javascript", label: "JavaScript" },
                { value: "typescript", label: "TypeScript" },
                { value: "html", label: "HTML" },
              ]}
            />
            <Button>Format</Button>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRun}>
              Run
            </Button>
          </div>
        </div>
        <Editor
          height="470px"
          theme="vs-dark"
          language={language}
          value={code}
          onChange={(value) => setCode(value ?? "")}
          options={{ fontSize: 14, minimap: { enabled: false }, padding: { top: 18 }, smoothScrolling: true }}
        />
      </section>

      <AIInsightPanel />

      <section className="console glass">
        <div className="sectionTitle">
          <ConsoleSqlOutlined />
          Output Console
        </div>
        <div className="consoleLines">
          {output.map((line, index) => (
            <code key={`${line}-${index}`}>{line}</code>
          ))}
        </div>
      </section>
    </main>
  );
}

function AIInsightPanel() {
  return (
    <aside className="aiPanel glass">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">GLM-4.7-Flash</span>
          <h2>AI 分析</h2>
        </div>
        <RobotOutlined />
      </div>
      {analysisBlocks.map((block, index) => (
        <motion.div
          key={block.title}
          className="analysisBlock"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08 }}
        >
          <h3>
            {block.icon}
            {block.title}
          </h3>
          {block.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </motion.div>
      ))}
    </aside>
  );
}

function VisualExecution() {
  return (
    <main className="pageGrid">
      <section className="visualBoard glass">
        <div className="sectionTitle">
          <ThunderboltOutlined />
          Event Loop 可视化执行
        </div>
        <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
          <Background color="#2d3b72" gap={18} />
          <Controls />
        </ReactFlow>
      </section>
      <section className="timeline glass">
        {["script start", "script end", "promise then", "setTimeout"].map((step, index) => (
          <motion.div key={step} className="timeStep" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ repeat: Infinity, delay: index * 0.45 }}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
          </motion.div>
        ))}
      </section>
    </main>
  );
}

function OutputPage() {
  const output = usePlaygroundStore((state) => state.output);
  return (
    <main className="singlePage glass">
      <div className="sectionTitle">
        <ConsoleSqlOutlined />
        运行结果
      </div>
      <div className="consoleLines large">
        {output.map((line, index) => (
          <code key={`${line}-${index}`}>{line}</code>
        ))}
      </div>
    </main>
  );
}

function HistoryPage() {
  const cards = useMemo(
    () => [
      { title: "Event Loop 基础题", result: "script start -> script end -> promise then -> setTimeout", liked: true },
      { title: "Promise 链式调用", result: "微任务连续入队，按 then 注册顺序执行", liked: false },
      { title: "DOM 渲染时机", result: "同步代码完成后进入渲染与下一轮任务", liked: false },
    ],
    [],
  );

  return (
    <main className="historyGrid">
      {cards.map((card) => (
        <article key={card.title} className="historyCard glass">
          <div>
            <span className="eyebrow">JavaScript</span>
            <h3>{card.title}</h3>
          </div>
          <p>{card.result}</p>
          <div className="cardActions">
            <Button>重新打开</Button>
            <Tooltip title="收藏">
              <Button shape="circle" icon={<DatabaseOutlined />} type={card.liked ? "primary" : "default"} />
            </Tooltip>
          </div>
        </article>
      ))}
    </main>
  );
}

function SettingsPage() {
  const { model, setModel } = usePlaygroundStore();

  return (
    <main className="settingsPage glass">
      <div className="sectionTitle">
        <SettingOutlined />
        设置
      </div>
      <div className="settingRow">
        <span>主题</span>
        <Segmented options={["Dark", "Light"]} defaultValue="Dark" />
      </div>
      <div className="settingRow">
        <span>AI 模型</span>
        <Select
          value={model}
          onChange={setModel}
          options={[
            { value: "GLM-4.7-Flash", label: "GLM-4.7-Flash" },
            { value: "DeepSeek", label: "DeepSeek" },
          ]}
        />
      </div>
      <div className="settingRow">
        <span>自动运行</span>
        <Switch />
      </div>
      <div className="settingRow">
        <span>动画效果</span>
        <Switch defaultChecked />
      </div>
      <div className="settingRow">
        <span>IndexedDB 历史缓存</span>
        <Switch defaultChecked />
      </div>
    </main>
  );
}

function Layout() {
  return (
    <div className="appShell">
      <Sidebar />
      <Routes>
        <Route path="/" element={<EditorWorkspace />} />
        <Route path="/output" element={<OutputPage />} />
        <Route path="/ai" element={<EditorWorkspace />} />
        <Route path="/visual" element={<VisualExecution />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#8b5cf6",
          colorBgContainer: "rgba(16, 22, 45, 0.72)",
          borderRadius: 8,
          colorText: "#e6efff",
        },
      }}
    >
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
      <Style />
    </ConfigProvider>
  );
}

function Style() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-width: 1180px;
        color: #e6efff;
        background:
          radial-gradient(circle at 18% 12%, rgba(0, 209, 255, 0.18), transparent 30%),
          radial-gradient(circle at 82% 8%, rgba(139, 92, 246, 0.2), transparent 28%),
          linear-gradient(135deg, #070a16 0%, #0b1023 52%, #111827 100%);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      button, input, textarea { font: inherit; }
      .appShell {
        display: grid;
        grid-template-columns: 236px 1fr;
        min-height: 100vh;
        padding: 18px;
        gap: 18px;
      }
      .glass {
        border: 1px solid rgba(139, 180, 255, 0.18);
        background: linear-gradient(180deg, rgba(18, 26, 54, 0.78), rgba(9, 14, 31, 0.72));
        box-shadow: 0 18px 70px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(22px);
        border-radius: 8px;
      }
      .sidebar {
        position: sticky;
        top: 18px;
        height: calc(100vh - 36px);
        padding: 18px;
        border-radius: 8px;
        border: 1px solid rgba(123, 211, 255, 0.18);
        background: rgba(7, 11, 27, 0.74);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 30px;
      }
      .brandMark {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        background: linear-gradient(135deg, #00d1ff, #8b5cf6);
        color: white;
        font-weight: 900;
        box-shadow: 0 0 28px rgba(0, 209, 255, 0.42);
      }
      .brand strong, .brand span { display: block; }
      .brand span { color: #8ea4ce; font-size: 12px; margin-top: 2px; }
      nav { display: grid; gap: 8px; }
      .navItem {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 44px;
        padding: 0 12px;
        color: #aab9d8;
        text-decoration: none;
        border-radius: 8px;
        border: 1px solid transparent;
      }
      .navItem.active {
        color: white;
        border-color: rgba(0, 209, 255, 0.32);
        background: linear-gradient(90deg, rgba(0, 209, 255, 0.16), rgba(139, 92, 246, 0.18));
        box-shadow: 0 0 24px rgba(0, 209, 255, 0.18);
      }
      .workspace {
        display: grid;
        grid-template-columns: minmax(620px, 1fr) 360px;
        grid-template-rows: 1fr 190px;
        gap: 18px;
      }
      .editorPanel { overflow: hidden; }
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 58px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(139, 180, 255, 0.13);
      }
      .tabs, .actions, .cardActions { display: flex; align-items: center; gap: 8px; }
      .tab {
        height: 34px;
        padding: 0 14px;
        border: 1px solid rgba(139, 180, 255, 0.14);
        border-radius: 8px;
        color: #9fb1d5;
        background: rgba(255, 255, 255, 0.03);
        cursor: pointer;
      }
      .tab.active {
        color: white;
        border-color: rgba(0, 209, 255, 0.38);
        background: rgba(0, 209, 255, 0.12);
      }
      .aiPanel {
        grid-row: span 2;
        padding: 18px;
        overflow: auto;
      }
      .panelHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 18px;
      }
      .panelHeader h2 { margin: 4px 0 0; font-size: 24px; }
      .eyebrow {
        color: #39d8ff;
        font-size: 12px;
        text-transform: uppercase;
      }
      .analysisBlock {
        padding: 14px;
        margin-bottom: 12px;
        border-radius: 8px;
        border: 1px solid rgba(139, 180, 255, 0.14);
        background: rgba(255, 255, 255, 0.035);
      }
      .analysisBlock h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 10px;
        font-size: 15px;
      }
      .analysisBlock p {
        margin: 7px 0;
        color: #b8c6e4;
        line-height: 1.5;
      }
      .console {
        grid-column: 1;
        padding: 16px;
      }
      .sectionTitle {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        color: #f6fbff;
        font-weight: 700;
      }
      .consoleLines {
        display: grid;
        gap: 8px;
        max-height: 125px;
        overflow: auto;
      }
      .consoleLines.large { max-height: 560px; }
      .consoleLines code {
        display: block;
        color: #a8ffcb;
        font-family: "SFMono-Regular", Consolas, monospace;
      }
      .pageGrid {
        display: grid;
        grid-template-rows: 1fr 190px;
        gap: 18px;
      }
      .visualBoard {
        min-height: 560px;
        padding: 16px;
      }
      .visualBoard .react-flow {
        height: 500px;
        border-radius: 8px;
        background: rgba(4, 9, 22, 0.55);
      }
      .react-flow__node {
        color: #e6efff;
        border-color: rgba(0, 209, 255, 0.48);
        background: rgba(20, 27, 55, 0.92);
        box-shadow: 0 0 22px rgba(0, 209, 255, 0.18);
      }
      .timeline {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        padding: 16px;
      }
      .timeStep {
        display: grid;
        align-content: center;
        gap: 10px;
        min-height: 150px;
        padding: 16px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(139, 180, 255, 0.14);
      }
      .timeStep span { color: #39d8ff; font-family: monospace; }
      .singlePage, .settingsPage {
        min-height: calc(100vh - 36px);
        padding: 22px;
      }
      .historyGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(240px, 1fr));
        align-content: start;
        gap: 18px;
      }
      .historyCard {
        min-height: 250px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 18px;
      }
      .historyCard h3 { margin: 6px 0 16px; }
      .historyCard p { color: #aebddd; line-height: 1.7; }
      .settingsPage {
        max-width: 760px;
      }
      .settingRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 66px;
        border-bottom: 1px solid rgba(139, 180, 255, 0.12);
      }
      .ant-btn-primary {
        background: linear-gradient(135deg, #8b5cf6, #00d1ff);
        box-shadow: 0 0 22px rgba(139, 92, 246, 0.36);
      }
    `}</style>
  );
}
