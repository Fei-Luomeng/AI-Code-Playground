import Editor from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { Language } from "../store/playgroundStore";
import { usePlaygroundStore } from "../store/playgroundStore";

type MonacoEditorProps = {
  code: string;
  language: Language;
  fontSize: number;
  formatRequest: number;
  onChange: (code: string) => void;
};

export default function MonacoEditor({ code, language, fontSize, formatRequest, onChange }: MonacoEditorProps) {
  const codeMarkers = usePlaygroundStore((state) => state.codeMarkers);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<any>(null);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    decorationsRef.current?.clear();
    decorationsRef.current = editorRef.current.createDecorationsCollection(
      codeMarkers.map((marker) => ({
        range: new monacoRef.current.Range(marker.line, 1, marker.line, 1),
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
    if (!editorRef.current || formatRequest === 0) return;
    editorRef.current.getAction("editor.action.formatDocument")?.run().then(() => {
      onChange(editorRef.current.getValue());
    });
  }, [formatRequest, onChange]);

  return (
    <Editor
      height="520px"
      language={language}
      theme="vs-dark"
      value={code}
      onChange={(value) => onChange(value ?? "")}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
      }}
      options={{
        fontSize,
        glyphMargin: true,
        minimap: { enabled: false },
        padding: { top: 18 },
        smoothScrolling: true,
        scrollBeyondLastLine: false,
      }}
    />
  );
}
