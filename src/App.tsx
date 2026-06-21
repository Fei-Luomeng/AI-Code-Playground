/**
 * 应用入口组件：配置 Ant Design 主题、路由和公共页面骨架。
 * 真正的业务页面通过 React Router 挂载到 Layout 中。
 */
import { ConfigProvider } from "antd";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { usePlaygroundStore } from "./store/playgroundStore";

// React.lazy 会把页面拆成独立资源，用户进入对应路由时才下载，减少首屏体积。
const PlaygroundPage = lazy(() => import("./pages/PlaygroundPage").then((module) => ({ default: module.PlaygroundPage })));
const VisualPage = lazy(() => import("./pages/VisualPage").then((module) => ({ default: module.VisualPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function Layout() {
  // Zustand Hook：组件只要读取到的 theme 变化，就会自动重新渲染。
  const theme = usePlaygroundStore((state) => state.theme);

  return (
    // className 带上 theme-dark/theme-light，普通 CSS 也能跟随主题变化。
    <div className={`appShell theme-${theme}`}>
      <Sidebar />
      {/* Suspense 在懒加载页面尚未下载完成时展示统一 loading。 */}
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<PlaygroundPage />} />
          <Route path="/visual" element={<VisualRoute />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function VisualRoute() {
  // 可视化必须对应“当前代码的最近一次执行快照”，代码改变后旧结果立即失效。
  const canOpenVisual = usePlaygroundStore(
    (state) => state.executedFile === state.activeFile && state.executedCode !== null && state.executedCode === state.code,
  );

  // replace 会替换当前浏览历史，避免用户点击“返回”又进入无效可视化地址。
  return canOpenVisual ? <VisualPage /> : <Navigate to="/" replace />;
}

function PageLoading() {
  return (
    <main className="content">
      <div className="pageLoading glass">
        <span />
        Loading workspace
      </div>
    </main>
  );
}

export default function App() {
  const theme = usePlaygroundStore((state) => state.theme);
  const isLight = theme === "light";

  return (
    // ConfigProvider 是 Ant Design 的全局主题入口，内部组件会继承这些颜色变量。
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#8b5cf6",
          colorBgContainer: isLight ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.86)",
          colorBorder: isLight ? "rgba(83, 105, 160, 0.22)" : "rgba(125, 160, 255, 0.18)",
          colorText: isLight ? "#162033" : "#e6efff",
          colorTextSecondary: isLight ? "#61708f" : "#9db0d2",
          borderRadius: 8,
        },
      }}
    >
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </ConfigProvider>
  );
}
