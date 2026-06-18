import type { ReactNode } from "react";

type PageMode = "editor" | "visual" | "history" | "settings";

const titleMap: Record<PageMode, string> = {
  editor: "AI 代码实验台",
  visual: "可视化执行流",
  history: "历史代码片段",
  settings: "偏好设置",
};

export function ShellHeader({ mode, actions }: { mode: PageMode; actions?: ReactNode }) {
  return (
    <header className="shellHeader">
      <div>
        <span className="eyebrow">AI Code Playground</span>
        <h1>{titleMap[mode]}</h1>
      </div>
      {actions}
    </header>
  );
}
