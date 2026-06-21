/**
 * 全局侧边栏：根据配置生成导航，并控制可视化入口是否可用。
 */
import { LockOutlined, RobotOutlined } from "@ant-design/icons";
import { message } from "antd";
import { NavLink } from "react-router-dom";
import { navItems } from "../data/appConfig";
import { usePlaygroundStore } from "../store/playgroundStore";
import { iconMap } from "./icons";

export function Sidebar() {
  const apiConfigured = Boolean(import.meta.env.VITE_GLM_API_KEY);
  const { activeFile, code, executedCode, executedFile } = usePlaygroundStore();
  // 当前源码必须与执行快照完全相同，才能查看对应可视化，避免展示旧结果。
  const canOpenVisual = executedFile === activeFile && executedCode !== null && executedCode === code;

  return (
    <aside className="sidebar glass">
      <div className="brand">
        <div className="brandMark">AI</div>
        <div>
          <strong>AI Code</strong>
          <span>Playground</span>
        </div>
      </div>
      <nav>
        {/* NavLink 会根据当前 URL 提供 isActive，用它设置选中样式。 */}
        {navItems.map((item) => {
          const visualLocked = item.path === "/visual" && !canOpenVisual;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={visualLocked ? "请先运行当前代码" : undefined}
              aria-disabled={visualLocked}
              className={({ isActive }) => `navItem ${isActive ? "active" : ""} ${visualLocked ? "locked" : ""}`}
              onClick={(event) => {
                // preventDefault 阻止 NavLink 修改地址，但保留可理解的提示。
                if (!visualLocked) return;
                event.preventDefault();
                message.warning(executedFile === activeFile ? "代码已修改，请重新运行后再查看可视化" : "请先运行当前代码，再查看可视化");
              }}
            >
              {iconMap[item.icon]}
              <span>{item.label}</span>
              {visualLocked && <LockOutlined className="navLock" />}
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebarCard">
        <RobotOutlined />
        <strong>GLM-4.7-Flash</strong>
        <span>{apiConfigured ? "API 已配置" : "等待配置 API Key"}</span>
      </div>
    </aside>
  );
}
