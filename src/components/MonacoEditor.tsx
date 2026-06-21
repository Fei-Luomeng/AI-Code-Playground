/**
 * Monaco 与 React 的适配层。
 * 这里把 Monaco 的命令式 API 转换成 React Props 和 effect。
 */
import Editor from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";
import type { Language } from "../store/playgroundStore";
import { usePlaygroundStore } from "../store/playgroundStore";

type MonacoEditorProps = {
  // 父组件拥有 code，Monaco 通过 onChange 请求父组件更新，属于受控组件模式。
  code: string;
  language: Language;
  fontSize: number;
  formatRequest: number;
  running: boolean;
  onChange: (code: string) => void;
  onRun: () => void;
  onCursorChange: (line: number, column: number) => void;
};

export default function MonacoEditor({ code, language, fontSize, formatRequest, running, onChange, onRun, onCursorChange }: MonacoEditorProps) {
  const codeMarkers = usePlaygroundStore((state) => state.codeMarkers);
  const theme = usePlaygroundStore((state) => state.theme);
  const tabSize = usePlaygroundStore((state) => state.tabSize);
  const wordWrap = usePlaygroundStore((state) => state.wordWrap);
  const minimap = usePlaygroundStore((state) => state.minimap);
  // Monaco 实例不是页面展示数据，放在 ref 中可避免每次变化都触发 React 重渲染。
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const onRunRef = useRef(onRun);

  useEffect(() => {
    // 保持快捷键调用的是父组件最新一轮渲染产生的 onRun 函数。
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    // AI 标记变化时，把对应行转换成 Monaco 的行高亮和左侧图标。
    if (!editorRef.current || !monacoRef.current) return;
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    decorationsRef.current?.clear();
    // createDecorationsCollection 返回集合对象，下一次更新前要清理旧装饰。
    decorationsRef.current = editorInstance.createDecorationsCollection(
      codeMarkers.map((marker) => ({
        range: new monaco.Range(marker.line, 1, marker.line, 1),
        options: {
          isWholeLine: true,
          className: `markerLineHighlight marker-${marker.type}`,
          glyphMarginClassName: `markerGlyph marker-${marker.type}`,
          glyphMarginHoverMessage: { value: marker.detail },
        },
      })),
    );
  }, [codeMarkers]);

  useEffect(() => {
    // 父组件递增 formatRequest，子组件收到变化后调用 Monaco 内置格式化命令。
    if (!editorRef.current || formatRequest === 0) return;
    const editorInstance = editorRef.current;
    editorInstance.getAction("editor.action.formatDocument")?.run().then(() => {
      onChange(editorInstance.getValue());
    });
  }, [formatRequest, onChange]);

  return (
    <Editor
      height="520px"
      language={language}
      theme={theme === "light" ? "vs" : "vs-dark"}
      value={code}
      onChange={(value) => onChange(value ?? "")}
      onMount={(editor, monaco) => {
        // onMount 只在编辑器实例创建完成后调用，此时才能访问 Monaco API。
        editorRef.current = editor;
        monacoRef.current = monaco;
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current());
        // Monaco 自己管理订阅生命周期，编辑器销毁时监听也会一起释放。
        editor.onDidChangeCursorPosition((event) => onCursorChange(event.position.lineNumber, event.position.column));
      }}
      options={{
        // options 直接对应 Monaco 官方编辑器配置。
        fontSize,
        tabSize,
        insertSpaces: true,
        wordWrap: wordWrap ? "on" : "off",
        glyphMargin: true,
        minimap: { enabled: minimap },
        padding: { top: 18 },
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        readOnly: running,
      }}
    />
  );
}
