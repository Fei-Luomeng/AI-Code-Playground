import { create } from "zustand";
import { questionTypes } from "../data/mockData";
import type { AISummaryItem, AnalysisBlock, CodeMarker } from "../types/analysis";

export type Language = "javascript" | "typescript" | "html";
export type ModelName = "GLM-4.7-Flash";
export type AIStatus = "idle" | "loading" | "success" | "error";
export type ThemeMode = "dark" | "light";

export type ProjectFile = {
  name: string;
  language: Language;
  content: string;
  source: "builtin" | "user";
};

type PlaygroundState = {
  projectFiles: ProjectFile[];
  activeFile: string;
  code: string;
  language: Language;
  output: string[];
  model: ModelName;
  theme: ThemeMode;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  animation: boolean;
  aiStatus: AIStatus;
  aiError: string;
  aiBlocks: AnalysisBlock[];
  aiSummary: AISummaryItem[];
  codeMarkers: CodeMarker[];
  selectedQuestionTypes: string[];
  customQuestion: string;
  setActiveFile: (file: string) => void;
  setCode: (code: string) => void;
  setLanguage: (language: Language) => void;
  setOutput: (output: string[]) => void;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (fontSize: number) => void;
  setTabSize: (tabSize: number) => void;
  setWordWrap: (wordWrap: boolean) => void;
  setMinimap: (minimap: boolean) => void;
  setAnimation: (animation: boolean) => void;
  setAIStatus: (status: AIStatus) => void;
  setAIError: (error: string) => void;
  setAIAnalysis: (blocks: AnalysisBlock[], summary: AISummaryItem[], markers: CodeMarker[]) => void;
  toggleQuestionType: (type: string) => void;
  setLastRunMs: (lastRunMs: number | null) => void;
  setCustomQuestion: (customQuestion: string) => void;
  addUserFile: (file: ProjectFile) => void;
  removeUserFile: (fileName: string) => void;
  lastRunMs: number | null;
};

const projectFiles: ProjectFile[] = [
  {
    name: "index.js",
    language: "javascript",
    source: "builtin",
    content: `console.log("script start");

setTimeout(() => {
  console.log("setTimeout");
}, 0);

Promise.resolve()
  .then(() => console.log("promise then"));

console.log("script end");`,
  },
];

export const usePlaygroundStore = create<PlaygroundState>((set) => ({
  projectFiles,
  activeFile: "index.js",
  code: projectFiles[0].content,
  language: "javascript",
  output: ["待执行。点击“解释代码”运行当前代码片段。"],
  model: "GLM-4.7-Flash",
  theme: "dark",
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  minimap: false,
  animation: true,
  aiStatus: "idle",
  aiError: "",
  aiBlocks: [],
  aiSummary: [],
  codeMarkers: [],
  selectedQuestionTypes: questionTypes,
  customQuestion: "",
  lastRunMs: null,
  setActiveFile: (activeFile) =>
    set((state) => {
      const file = state.projectFiles.find((item) => item.name === activeFile);
      if (!file) return { activeFile };
      return {
        activeFile,
        code: file.content,
        language: file.language,
        aiBlocks: [],
        aiSummary: [],
        codeMarkers: [],
        aiError: "",
        aiStatus: "idle",
        lastRunMs: null,
        output: [`Opened ${file.name}`],
      };
    }),
  setCode: (code) =>
    set((state) => ({
      code,
      projectFiles: state.projectFiles.map((file) => (file.name === state.activeFile ? { ...file, content: code } : file)),
    })),
  setLanguage: (language) =>
    set((state) => ({
      language,
      projectFiles: state.projectFiles.map((file) => (file.name === state.activeFile ? { ...file, language } : file)),
    })),
  setOutput: (output) => set({ output }),
  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize }),
  setTabSize: (tabSize) => set({ tabSize }),
  setWordWrap: (wordWrap) => set({ wordWrap }),
  setMinimap: (minimap) => set({ minimap }),
  setAnimation: (animation) => set({ animation }),
  setAIStatus: (aiStatus) => set({ aiStatus }),
  setAIError: (aiError) => set({ aiError }),
  setAIAnalysis: (aiBlocks, aiSummary, codeMarkers) => set({ aiBlocks, aiSummary, codeMarkers, aiError: "" }),
  setLastRunMs: (lastRunMs) => set({ lastRunMs }),
  setCustomQuestion: (customQuestion) => set({ customQuestion }),
  addUserFile: (file) =>
    set((state) => {
      const nextFiles = state.projectFiles.some((item) => item.name === file.name)
        ? state.projectFiles.map((item) => (item.name === file.name ? file : item))
        : [...state.projectFiles, file];

      return {
        projectFiles: nextFiles,
        activeFile: file.name,
        code: file.content,
        language: file.language,
        aiBlocks: [],
        aiSummary: [],
        codeMarkers: [],
        aiError: "",
        aiStatus: "idle",
        lastRunMs: null,
        output: [`Loaded ${file.name}`],
      };
    }),
  removeUserFile: (fileName) =>
    set((state) => {
      const file = state.projectFiles.find((item) => item.name === fileName);
      if (!file || file.source === "builtin") return state;

      const nextFiles = state.projectFiles.filter((item) => item.name !== fileName);
      const fallbackFile = nextFiles.find((item) => item.name === state.activeFile) ?? nextFiles[0] ?? projectFiles[0];

      return {
        projectFiles: nextFiles.length ? nextFiles : projectFiles,
        activeFile: fallbackFile.name,
        code: fallbackFile.content,
        language: fallbackFile.language,
        aiBlocks: [],
        aiSummary: [],
        codeMarkers: [],
        aiError: "",
        aiStatus: "idle",
        lastRunMs: null,
        output: [`已删除 ${fileName}`],
      };
    }),
  toggleQuestionType: (type) =>
    set((state) => {
      const exists = state.selectedQuestionTypes.includes(type);
      const nextTypes = exists ? state.selectedQuestionTypes.filter((item) => item !== type) : [...state.selectedQuestionTypes, type];
      return { selectedQuestionTypes: nextTypes.length ? nextTypes : state.selectedQuestionTypes };
    }),
}));
