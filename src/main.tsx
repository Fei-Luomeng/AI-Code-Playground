/**
 * 浏览器启动入口。
 * Vite 首先加载这个文件，再由它把根组件 App 挂载到 index.html 的 #root 节点中。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// createRoot 是 React 18 的挂载 API；感叹号告诉 TypeScript 这里一定能找到 root 元素。
ReactDOM.createRoot(document.getElementById("root")!).render(
  // StrictMode 仅在开发环境帮助发现副作用和不安全写法，不会额外渲染生产页面。
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
