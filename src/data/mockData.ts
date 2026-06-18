import type { Edge, Node } from "react-flow-renderer";

export type IconKey = "api" | "app" | "bug" | "code" | "console" | "history" | "robot" | "settings" | "thunder";

export const navItems: Array<{ path: string; label: string; icon: IconKey }> = [
  { path: "/", label: "代码编辑", icon: "code" },
  { path: "/visual", label: "可视化执行", icon: "thunder" },
  { path: "/history", label: "历史记录", icon: "history" },
  { path: "/settings", label: "设置", icon: "settings" },
];

export const files = [
  { name: "index.js", language: "javascript" },
  { name: "utils.js", language: "javascript" },
  { name: "demo.html", language: "html" },
];

export const questionTypes = ["逐行解释", "关键逻辑", "错误风险", "优化建议", "面试追问"];

export const queueCards = [
  { title: "Call Stack", items: ["global()", "console.log()", "Promise.resolve()"], active: 1 },
  { title: "Microtask Queue", items: ["promise.then callback"], active: 0 },
  { title: "Macrotask Queue", items: ["setTimeout callback"], active: 0 },
];

export const flowNodes: Node[] = [
  { id: "code", position: { x: 20, y: 130 }, data: { label: "Code Runner" } },
  { id: "stack", position: { x: 250, y: 42 }, data: { label: "Call Stack" } },
  { id: "webapi", position: { x: 250, y: 218 }, data: { label: "Web APIs" } },
  { id: "micro", position: { x: 520, y: 40 }, data: { label: "Microtask Queue" } },
  { id: "macro", position: { x: 520, y: 218 }, data: { label: "Macrotask Queue" } },
  { id: "loop", position: { x: 800, y: 128 }, data: { label: "Event Loop" } },
  { id: "console", position: { x: 1030, y: 128 }, data: { label: "Console Output" } },
];

export const flowEdges: Edge[] = [
  { id: "e-code-stack", source: "code", target: "stack", animated: true },
  { id: "e-code-webapi", source: "code", target: "webapi", animated: true },
  { id: "e-stack-micro", source: "stack", target: "micro", animated: true },
  { id: "e-webapi-macro", source: "webapi", target: "macro", animated: true },
  { id: "e-micro-loop", source: "micro", target: "loop", animated: true },
  { id: "e-macro-loop", source: "macro", target: "loop", animated: true },
  { id: "e-loop-console", source: "loop", target: "console", animated: true },
];

export const visualSteps = ["Call Stack 执行 console.log", "Promise.then 排入微任务", "setTimeout 进入宏任务", "微任务优先刷新输出"];

export const historyCards = [
  {
    title: "Event Loop 基础题",
    time: "Today 14:20",
    tags: ["JavaScript", "Event Loop"],
    result: "script start -> script end -> promise then -> setTimeout",
    summary: "识别同步任务、微任务与宏任务的执行顺序。",
    favorite: true,
  },
  {
    title: "Promise 链式调用",
    time: "Yesterday 21:08",
    tags: ["Promise", "Microtask"],
    result: "then 回调按注册顺序进入微任务队列",
    summary: "适合解释 Promise 返回值穿透与链式排队。",
    favorite: false,
  },
  {
    title: "异步错误处理",
    time: "Jun 16 09:41",
    tags: ["Async", "Error"],
    result: "try/catch 无法捕获异步宏任务内部异常",
    summary: "建议用 Promise.catch 或全局错误监听兜底。",
    favorite: false,
  },
  {
    title: "DOM 更新时机",
    time: "Jun 15 18:35",
    tags: ["DOM", "Render"],
    result: "同步代码后执行微任务，再进入渲染机会",
    summary: "用于串联 JS 执行、渲染和任务队列。",
    favorite: true,
  },
];

export const historySummary = [
  { label: "总片段", value: "24" },
  { label: "已收藏", value: "8" },
  { label: "本周运行", value: "56" },
];
