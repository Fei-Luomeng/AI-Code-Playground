import { CloseOutlined, FormatPainterOutlined, PlayCircleOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Popconfirm, Select } from "antd";
import { lazy, Suspense, useRef, useState } from "react";
import { Language, ProjectFile, usePlaygroundStore } from "../store/playgroundStore";

const MonacoEditor = lazy(() => import("./MonacoEditor"));

type EditorPanelProps = {
  running: boolean;
  onRun: () => void;
};

export function EditorPanel({ running, onRun }: EditorPanelProps) {
  const { projectFiles, activeFile, code, language, fontSize, setActiveFile, setCode, setLanguage, addUserFile, removeUserFile } =
    usePlaygroundStore();
  const [formatRequest, setFormatRequest] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProjectFile = projectFiles.find((file) => file.name === activeFile);

  const handleUploadFile = async (file: File) => {
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
        <div className="tabs" role="tablist">
          {projectFiles.map((file) => (
            <button
              key={file.name}
              className={`${file.name === activeFile ? "tab active" : "tab"} ${file.source === "user" ? "uploaded" : "builtin"}`}
              onClick={() => setActiveFile(file.name)}
            >
              <span className="dot" />
              <span className="fileKind">{file.source === "builtin" ? "示例" : "上传"}</span>
              <span className="fileName">{file.name}</span>
              {file.source === "user" && (
                <Popconfirm
                  title="删除这个文件？"
                  description={`删除 ${file.name} 后，需要重新上传才能恢复。`}
                  okText="删除"
                  cancelText="取消"
                  placement="bottom"
                  overlayClassName="deleteFileConfirm"
                  onConfirm={(event) => {
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
            accept=".js,.ts,.tsx,.jsx,.html,.css,.json,.txt"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUploadFile(file);
              event.currentTarget.value = "";
            }}
          />
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
            上传
          </Button>
          <Button icon={<FormatPainterOutlined />} onClick={() => setFormatRequest((value) => value + 1)}>
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
        <span>暂无错误</span>
        <span>JavaScript ES2024</span>
        <span>沙箱运行</span>
      </div>
      <Suspense fallback={<div className="editorLoading">Loading Monaco Editor</div>}>
        <MonacoEditor code={code} language={language} fontSize={fontSize} formatRequest={formatRequest} onChange={setCode} />
      </Suspense>
      <div className="editorStatusBar">
        <span>Ln 9, Col 21</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>{language}</span>
      </div>
    </section>
  );
}

function getLanguageFromFileName(fileName: string): ProjectFile["language"] {
  if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) return "typescript";
  if (fileName.endsWith(".html")) return "html";
  return "javascript";
}
