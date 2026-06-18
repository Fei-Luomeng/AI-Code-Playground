import { RobotOutlined } from "@ant-design/icons";
import { NavLink } from "react-router-dom";
import { navItems } from "../data/mockData";
import { iconMap } from "./icons";

export function Sidebar() {
  const apiConfigured = Boolean(import.meta.env.VITE_GLM_API_KEY);

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
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `navItem ${isActive ? "active" : ""}`}>
            {iconMap[item.icon]}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebarCard">
        <RobotOutlined />
        <strong>GLM-4.7-Flash</strong>
        <span>{apiConfigured ? "API 已配置" : "等待配置 API Key"}</span>
      </div>
    </aside>
  );
}
