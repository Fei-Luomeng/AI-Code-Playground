import { FileTextOutlined, FormatPainterOutlined, PlayCircleOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Select } from "antd";
import { lazy, Suspense, useRef, useState } from "react";
import { Language, ProjectFile, usePlaygroundStore } from "../store/playgroundStore";

const MonacoEditor = lazy(() => import("./MonacoEditor"));

type EditorPanelProps = {
  running: boolean;
  onRun: () => void;
};

export function EditorPanel({ running, onRun }: EditorPanelProps) {
  const { projectFiles, activeFile, code, language, fontSize, setActiveFile, setCode, setLanguage, addUserFile } = usePlaygroundStore();
  const [formatRequest, setFormatRequest] = useState(0);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("user-code.js");
  const [pasteCode, setPasteCode] = useState("");
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

  const handleCreateFromPaste = () => {
    if (!pasteCode.trim()) return;
    addUserFile({
      name: pasteName.trim() || "user-code.js",
      language: getLanguageFromFileName(pasteName),
      source: "user",
      content: pasteCode,
    });
    setPasteOpen(false);
    setPasteCode("");
  };

  return (
    <section className="editorPanel glass">
      <div className="toolbar">
        <div className="tabs" role="tablist">
          {projectFiles.map((file) => (
            <button key={file.name} className={file.name === activeFile ? "tab active" : "tab"} onClick={() => setActiveFile(file.name)}>
              <span className="dot" />
              {file.name}
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
          <Button icon={<FileTextOutlined />} onClick={() => setPasteOpen(true)}>
            粘贴
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
        <span>{activeProjectFile?.source === "builtin" ? "内置示例" : "用户代码"}</span>
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
      <Modal
        title="粘贴代码"
        open={pasteOpen}
        onOk={handleCreateFromPaste}
        onCancel={() => setPasteOpen(false)}
        okText="创建文件"
        cancelText="取消"
        className="darkModal"
      >
        <Input value={pasteName} onChange={(event) => setPasteName(event.target.value)} placeholder="文件名，例如 solution.js" />
        <Input.TextArea
          className="pasteTextarea"
          value={pasteCode}
          onChange={(event) => setPasteCode(event.target.value)}
          placeholder="把需要解释的代码粘贴到这里"
          autoSize={{ minRows: 10, maxRows: 16 }}
        />
      </Modal>
    </section>
  );
}

function getLanguageFromFileName(fileName: string): ProjectFile["language"] {
  if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) return "typescript";
  if (fileName.endsWith(".html")) return "html";
  return "javascript";
}
