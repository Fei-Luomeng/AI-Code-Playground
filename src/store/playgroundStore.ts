/**
 * 全局状态中心。
 * 编辑器、AI 面板、可视化和设置页都通过这个 store 共享数据。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { questionTypes } from "../data/appConfig";
import type { AISummaryItem, AnalysisBlock, CodeMarker } from "../types/analysis";
import type { HistoryRecord } from "../types/history";

export type Language = "javascript" | "typescript" | "html";
// 联合类型比普通 string 更严格，只允许列出的三个语言值。
export type ModelName = "GLM-4.7-Flash";
export type AIStatus = "idle" | "loading" | "success" | "error";
export type ThemeMode = "dark" | "light";

export type ProjectFile = {
  // 文件名同时作为标签页的唯一标识。
  name: string;
  language: Language;
  content: string;
  source: "builtin" | "user";
};

// 这里集中描述全局状态的“数据”和可调用的“修改方法”。
// TypeScript 会检查组件读取的字段是否存在、传入参数类型是否正确。
type PlaygroundState = {
  // ===== 编辑器数据 =====
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
  // ===== AI 返回结果 =====
  aiStatus: AIStatus;
  aiError: string;
  aiBlocks: AnalysisBlock[];
  aiSummary: AISummaryItem[];
  codeMarkers: CodeMarker[];
  selectedQuestionTypes: string[];
  customQuestion: string;
  // ===== 最近一次真实执行快照 =====
  executedCode: string | null;
  executedOutput: string[];
  executedFile: string | null;
  runRevision: number;
  // ===== 修改状态的方法（actions） =====
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
  setExecutionSnapshot: (fileName: string, code: string, output: string[], durationMs: number) => void;
  setCustomQuestion: (customQuestion: string) => void;
  addUserFile: (file: ProjectFile) => void;
  removeUserFile: (fileName: string) => void;
  restoreHistoryRecord: (record: HistoryRecord) => void;
  lastRunMs: number | null;
};

const projectFiles: ProjectFile[] = [
  // 项目始终保留一个内置示例，用户删除上传文件后可以安全回退到这里。
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

// Zustand store 类似 Vue 的 Pinia：任何组件都可以通过 usePlaygroundStore 读写共享状态。
export const usePlaygroundStore = create<PlaygroundState>()(persist((set) => ({
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
  executedCode: null,
  executedOutput: [],
  executedFile: null,
  runRevision: 0,
  setActiveFile: (activeFile) =>
    set((state) => {
      // 使用函数形式的 set 可以安全读取修改前的最新 state。
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
      // code 和 projectFiles 中的文件内容必须同步，否则切换标签会丢失编辑结果。
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
  setExecutionSnapshot: (executedFile, executedCode, executedOutput, lastRunMs) =>
    set((state) => ({
      // 快照用于判断当前代码是否真的运行过，而不是仅仅在编辑器里出现过。
      executedFile,
      executedCode,
      executedOutput,
      lastRunMs,
      runRevision: state.runRevision + 1,
    })),
  setCustomQuestion: (customQuestion) => set({ customQuestion }),
  addUserFile: (file) =>
    set((state) => {
      // 同名文件选择覆盖，避免 React 标签出现重复 key。
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
      // 内置示例不允许删除，因此这里先检查 source。
      const file = state.projectFiles.find((item) => item.name === fileName);
      if (!file || file.source === "builtin") return state;

      const nextFiles = state.projectFiles.filter((item) => item.name !== fileName);
      // 如果删除的是当前文件，优先切换到剩余第一个文件。
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
        ...(state.executedFile === fileName
          ? { executedFile: null, executedCode: null, executedOutput: [], runRevision: state.runRevision + 1 }
          : {}),
      };
    }),
  restoreHistoryRecord: (record) =>
    set((state) => {
      // 历史记录只负责把代码载入编辑器，不把旧记录伪装成本次刚运行的结果。
      const restoredFile: ProjectFile = {
        name: record.fileName,
        language: record.language,
        content: record.code,
        source: record.fileSource,
      };
      const projectFiles = state.projectFiles.some((file) => file.name === record.fileName)
        ? state.projectFiles.map((file) => (file.name === record.fileName ? restoredFile : file))
        : [...state.projectFiles, restoredFile];

      return {
        projectFiles,
        activeFile: record.fileName,
        code: record.code,
        language: record.language,
        output: record.output,
        aiBlocks: record.aiBlocks,
        aiSummary: record.aiSummary,
        codeMarkers: record.codeMarkers,
        aiError: record.aiError,
        aiStatus: record.status,
        lastRunMs: null,
        selectedQuestionTypes: record.questionTypes,
        customQuestion: record.customQuestion,
        executedFile: null,
        executedCode: null,
        executedOutput: [],
        runRevision: state.runRevision + 1,
      };
    }),
  toggleQuestionType: (type) =>
    set((state) => {
      // 这里实现多选切换，同时保证至少保留一个解释重点。
      const exists = state.selectedQuestionTypes.includes(type);
      const nextTypes = exists ? state.selectedQuestionTypes.filter((item) => item !== type) : [...state.selectedQuestionTypes, type];
      return { selectedQuestionTypes: nextTypes.length ? nextTypes : state.selectedQuestionTypes };
    }),
}), {
  // persist 中间件把指定设置写入 localStorage，刷新页面后仍然保留。
  name: "ai-code-playground-settings",
  partialize: (state) => ({
    // 只持久化偏好设置；代码和运行结果有各自的生命周期，不写进 localStorage。
    theme: state.theme,
    fontSize: state.fontSize,
    tabSize: state.tabSize,
    wordWrap: state.wordWrap,
    minimap: state.minimap,
    animation: state.animation,
  }),
}));
