import { useMemo, useState } from "react";
import { Button, Input } from "antd";
import { CheckOutlined, RobotOutlined } from "@ant-design/icons";
import { AIInsightPanel } from "../components/AIInsightPanel";
import { CodeMarkersPanel } from "../components/CodeMarkersPanel";
import { EditorPanel } from "../components/EditorPanel";
import { OutputConsole } from "../components/OutputConsole";
import { ShellHeader } from "../components/ShellHeader";
import { questionTypes } from "../data/mockData";
import { usePlaygroundStore } from "../store/playgroundStore";
import { analyzeCodeWithGlm } from "../services/glmApi";
import { getWorkspaceStats } from "../utils/codeMetrics";
import { runInIframeSandbox } from "../utils/sandbox";

export function PlaygroundPage() {
  const {
    code,
    output,
    model,
    selectedQuestionTypes,
    customQuestion,
    setOutput,
    setAIStatus,
    setAIError,
    setAIAnalysis,
    setLastRunMs,
    setCustomQuestion,
    toggleQuestionType,
    lastRunMs,
  } = usePlaygroundStore();
  const [running, setRunning] = useState(false);
  const workspaceStats = useMemo(() => getWorkspaceStats(code, lastRunMs), [code, lastRunMs]);

  const handleRun = async () => {
    setRunning(true);
    setAIStatus("loading");
    setAIError("");
    setAIAnalysis([], [], []);
    const startedAt = performance.now();
    const logs = await runInIframeSandbox(code);
    const cost = Math.round(performance.now() - startedAt);
    setLastRunMs(cost);
    setOutput([...logs, `runtime        ${cost}ms`, "AI 解释        正在请求"]);

    try {
      const result = await analyzeCodeWithGlm({
        code,
        output: logs,
        model,
        questionTypes: selectedQuestionTypes,
        customQuestion,
      });
      setAIAnalysis(result.blocks, result.summary, result.markers);
      setAIStatus("success");
      setOutput([...logs, `runtime        ${cost}ms`, "AI 解释        已返回"]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 解释请求失败。";
      setAIError(message);
      setAIStatus("error");
      setOutput([...logs, `runtime        ${cost}ms`, `AI 解释        ${message}`]);
    }

    setRunning(false);
  };

  return (
    <main className="content">
      <ShellHeader
        mode="editor"
        actions={
          <div className="askBar">
            <Input
              className="askInput"
              prefix={<RobotOutlined />}
              value={customQuestion}
              onChange={(event) => setCustomQuestion(event.target.value)}
              onPressEnter={handleRun}
              placeholder="可选：补充你想让 AI 解释的问题，例如：这段代码有什么 bug？"
              allowClear
            />
            <Button type="primary" icon={<RobotOutlined />} loading={running} onClick={handleRun}>
              解释代码
            </Button>
          </div>
        }
      />
      <section className="workspaceOverview">
        {workspaceStats.map((item) => (
          <div key={item.label} className={`statCard glass ${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
        <div className="questionTypes glass">
          <div className="questionTypesHeader">
            <strong>解释重点</strong>
            <span>可多选，点击“解释代码”后生效</span>
          </div>
          <div className="questionTypeButtons">
            {questionTypes.map((type) => {
              const selected = selectedQuestionTypes.includes(type);

              return (
                <button key={type} className={selected ? "active" : ""} onClick={() => toggleQuestionType(type)}>
                  {selected && <CheckOutlined />}
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <div className="workspace">
        <EditorPanel running={running} onRun={handleRun} />
        <AIInsightPanel />
        <div className="bottomWorkspace">
          <OutputConsole output={output} compact />
          <CodeMarkersPanel />
        </div>
      </div>
      {running && (
        <div className="runOverlay">
          <div className="runOverlayPanel glass">
            <span className="runSpinner" />
            <strong>正在解释你的代码</strong>
            <p>系统会先运行代码，读取控制台结果，然后生成逐行解释、问题提示和优化建议。</p>
          </div>
        </div>
      )}
    </main>
  );
}
