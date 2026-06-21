export type IconKey = "api" | "app" | "bug" | "code" | "console" | "history" | "robot" | "settings" | "thunder";

// 与业务状态无关、不会在运行时变化的选项统一放在配置文件中。
export const navItems: Array<{ path: string; label: string; icon: IconKey }> = [
  { path: "/", label: "代码编辑", icon: "code" },
  { path: "/visual", label: "可视化执行", icon: "thunder" },
  { path: "/history", label: "历史记录", icon: "history" },
  { path: "/settings", label: "设置", icon: "settings" },
];

export const questionTypes = ["逐行解释", "关键逻辑", "错误风险", "优化建议", "面试追问"];
