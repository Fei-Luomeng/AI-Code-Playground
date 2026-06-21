import type { AISummaryItem, AnalysisBlock, CodeMarker } from "./analysis";

export type HistoryLanguage = "javascript" | "typescript" | "html";
export type HistoryStatus = "success" | "error";

// type 只存在于开发和编译阶段，用来保证写入和读取的历史记录结构一致。
export type HistoryRecord = {
  // id 是 IndexedDB 主键，createdAt 使用毫秒时间戳，便于排序和日期统计。
  id: string;
  createdAt: number;
  fileName: string;
  fileSource: "builtin" | "user";
  language: HistoryLanguage;
  code: string;
  output: string[];
  durationMs: number;
  status: HistoryStatus;
  favorite: boolean;
  // 保存当次请求条件，恢复记录时右侧 AI 内容与当时保持一致。
  questionTypes: string[];
  customQuestion: string;
  aiBlocks: AnalysisBlock[];
  aiSummary: AISummaryItem[];
  codeMarkers: CodeMarker[];
  aiError: string;
};

export type NewHistoryRecord = Omit<HistoryRecord, "id" | "createdAt" | "favorite">;
// Omit 从完整类型中排除由存储层自动生成的三个字段。
