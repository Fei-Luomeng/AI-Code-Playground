import type { IconKey } from "../data/appConfig";

// 联合类型把可选值限制在固定集合中，写错字符串时编辑器会立即提示。
export type MarkerType = "sync" | "micro" | "macro" | "error" | "output";

export type CodeMarker = {
  line: number;
  type: MarkerType;
  title: string;
  detail: string;
};

export type AnalysisBlock = {
  title: string;
  icon: IconKey;
  tag: string;
  lines: string[];
};

export type AISummaryItem = {
  label: string;
  value: string;
};

export type AIAnalysisResult = {
  // 一个接口响应被拆成右侧解释卡片、顶部摘要和 Monaco 行标记三部分。
  blocks: AnalysisBlock[];
  summary: AISummaryItem[];
  markers: CodeMarker[];
};
