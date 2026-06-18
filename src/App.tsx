import { ConfigProvider } from "antd";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";

import { Sidebar } from "./components/Sidebar";

const PlaygroundPage = lazy(() => import("./pages/PlaygroundPage").then((module) => ({ default: module.PlaygroundPage })));
const VisualPage = lazy(() => import("./pages/VisualPage").then((module) => ({ default: module.VisualPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function Layout() {
  return (
    <div className="appShell">
      <Sidebar />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<PlaygroundPage />} />
          <Route path="/visual" element={<VisualPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </div>
  );
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
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#8b5cf6",
          colorBgContainer: "rgba(15, 23, 42, 0.86)",
          colorBorder: "rgba(125, 160, 255, 0.18)",
          colorText: "#e6efff",
          colorTextSecondary: "#9db0d2",
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
