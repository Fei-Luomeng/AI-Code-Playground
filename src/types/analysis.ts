import type { IconKey } from "../data/mockData";

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
  blocks: AnalysisBlock[];
  summary: AISummaryItem[];
  markers: CodeMarker[];
};
