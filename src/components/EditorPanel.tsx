/**
 * 编辑器外壳：负责文件标签、语言选择、上传、格式化按钮和状态栏。
 * Monaco 本体单独放在 MonacoEditor，避免这个组件承担过多底层编辑器逻辑。
 */
import { CloseOutlined, FormatPainterOutlined, PlayCircleOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Popconfirm, Select } from "antd";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import type { Language, ProjectFile } from "../store/playgroundStore";
import { usePlaygroundStore } from "../store/playgroundStore";

const MonacoEditor = lazy(() => import("./MonacoEditor"));

type EditorPanelProps = {
  // Props 是父组件传给子组件的数据，类似 Vue 组件的 props。
  running: boolean;
  onRun: () => void;
};

export function EditorPanel({ running, onRun }: EditorPanelProps) {
  // 组件同时读取状态和 action；任意相关字段变化都会触发该组件重新渲染。
  const { projectFiles, activeFile, code, language, fontSize, tabSize, codeMarkers, setActiveFile, setCode, setLanguage, addUserFile, removeUserFile } = usePlaygroundStore();
  const [formatRequest, setFormatRequest] = useState(0);
  // useState 保存光标位置，因为它需要实时显示在 JSX 状态栏中。
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // find 可能找不到文件，因此 activeProjectFile 的类型自动包含 undefined。
  const activeProjectFile = projectFiles.find((file) => file.name === activeFile);
  const riskCount = useMemo(() => codeMarkers.filter((marker) => marker.type === "error").length, [codeMarkers]);

  const handleUploadFile = async (file: File) => {
    // File.text() 是浏览器读取本地文本文件的异步 API，不会上传到服务器。
    const content = await file.text();
    addUserFile({
      name: file.name,
      language: getLanguageFromFileName(file.name),
      source: "user",
      content,
    });
  };

  return (
    <section className="editorPanel glass">
      <div className="toolbar">
        {/* JSX 中使用大括号执行 JavaScript；map 会把文件数组渲染成多个标签。 */}
        <div className="tabs" role="tablist">
          {projectFiles.map((file) => (
            <button
              key={file.name}
              className={`${file.name === activeFile ? "tab active" : "tab"} ${file.source === "user" ? "uploaded" : "builtin"}`}
              onClick={() => setActiveFile(file.name)}
            >
              {/* 文件来源会影响标签文字以及是否显示删除按钮。 */}
              <span className="dot" />
              <span className="fileKind">{file.source === "builtin" ? "示例" : "上传"}</span>
              <span className="fileName">{file.name}</span>
              {file.source === "user" && (
                // Popconfirm 先让用户确认，再真正调用删除 action。
                <Popconfirm
                  title="删除这个文件？"
                  description={`删除 ${file.name} 后，需要重新上传才能恢复。`}
                  okText="删除"
                  cancelText="取消"
                  placement="bottom"
                  overlayClassName="deleteFileConfirm"
                  onConfirm={(event) => {
                    // 删除按钮位于文件标签内部，阻止冒泡可避免同时触发文件切换。
                    event?.stopPropagation();
                    removeUserFile(file.name);
                  }}
                  onCancel={(event) => event?.stopPropagation()}
                >
                  <span
                    className="deleteFileButton"
                    role="button"
                    aria-label={`删除 ${file.name}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <CloseOutlined />
                  </span>
                </Popconfirm>
              )}
            </button>
          ))}
        </div>
        <div className="actions">
          <Select
            className="languageSelect"
            popupClassName="darkSelectDropdown"
            value={language}
            onChange={(value: Language) => setLanguage(value)}
            options={[
              { value: "javascript", label: "JavaScript" },
              { value: "typescript", label: "TypeScript" },
              { value: "html", label: "HTML" },
            ]}
          />
          <input
            ref={fileInputRef}
            className="hiddenFileInput"
            type="file"
            accept=".js,.ts,.html"
            onChange={(event) => {
              // input 可再次选择同一个文件，因此处理后要把 value 清空。
              const file = event.target.files?.[0];
              if (file) void handleUploadFile(file);
              event.currentTarget.value = "";
            }}
          />
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
            上传
          </Button>
          <Button icon={<FormatPainterOutlined />} onClick={() => setFormatRequest((value) => value + 1)}>
            {/* 递增数字比 boolean 更合适，因为每次点击都会形成一个新的请求值。 */}
            Format
          </Button>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={onRun}>
            解释代码
          </Button>
        </div>
      </div>
      <div className="editorMeta">
        <span>{activeFile}</span>
        <span>{activeProjectFile?.source === "builtin" ? "示例文件" : "上传文件"}</span>
        <span>{riskCount ? `${riskCount} 个风险标记` : "暂无风险标记"}</span>
        <span>{getLanguageLabel(language)}</span>
        <span>沙箱运行</span>
      </div>
      <Suspense fallback={<div className="editorLoading">Loading Monaco Editor</div>}>
        <MonacoEditor
          code={code}
          language={language}
          fontSize={fontSize}
          formatRequest={formatRequest}
          running={running}
          onChange={setCode}
          onRun={onRun}
          onCursorChange={(line, column) => setCursor({ line, column })}
        />
      </Suspense>
      <div className="editorStatusBar">
        <span>Ln {cursor.line}, Col {cursor.column}</span>
        <span>Spaces: {tabSize}</span>
        <span>UTF-8</span>
        <span>{language}</span>
      </div>
    </section>
  );
}

function getLanguageLabel(language: Language) {
  if (language === "typescript") return "TypeScript";
  if (language === "html") return "HTML";
  return "JavaScript";
}

function getLanguageFromFileName(fileName: string): ProjectFile["language"] {
  // ProjectFile["language"] 会直接复用 ProjectFile 中 language 字段的类型。
  if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) return "typescript";
  if (fileName.endsWith(".html")) return "html";
  return "javascript";
}
