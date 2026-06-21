/**
 * 代码编辑主页面。
 * 一次“解释代码”包含：沙箱执行 -> AI 请求 -> 历史保存 -> 登记执行快照。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "antd";
import { CheckOutlined, RobotOutlined } from "@ant-design/icons";
import { AIInsightPanel } from "../components/AIInsightPanel";
import { CodeMarkersPanel } from "../components/CodeMarkersPanel";
import { EditorPanel } from "../components/EditorPanel";
import { OutputConsole } from "../components/OutputConsole";
import { ShellHeader } from "../components/ShellHeader";
import { questionTypes } from "../data/appConfig";
import { usePlaygroundStore } from "../store/playgroundStore";
import { analyzeCodeWithGlm } from "../services/glmApi";
import { saveHistoryRecord } from "../services/historyStorage";
import { getWorkspaceStats } from "../utils/codeMetrics";
import { runInIframeSandbox } from "../utils/sandbox";
import type { AIAnalysisResult } from "../types/analysis";

export function PlaygroundPage() {
  // 解构 store 后，JSX 可以直接使用 code、output 和各种更新方法。
  const {
    code,
    activeFile,
    language,
    projectFiles,
    output,
    model,
    selectedQuestionTypes,
    customQuestion,
    setOutput,
    setAIStatus,
    setAIError,
    setAIAnalysis,
    setLastRunMs,
    setExecutionSnapshot,
    setCustomQuestion,
    toggleQuestionType,
    lastRunMs,
  } = usePlaygroundStore();
  const [running, setRunning] = useState(false);
  // state 更新会触发渲染；ref 更新不会。这里用 ref 立即阻止快速重复提交。
  const runningRef = useRef(false);
  const questionInputRef = useRef<import("antd").InputRef>(null);
  // 依赖数组中的值不变时，React 会复用上一次统计结果。
  const workspaceStats = useMemo(() => getWorkspaceStats(code, lastRunMs), [code, lastRunMs]);

  useEffect(() => {
    // useEffect 适合注册浏览器事件；return 中的函数会在组件卸载时清理事件。
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        questionInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleRun = async () => {
    // 浏览器事件可能在 React 完成下一次渲染前连续触发，ref 能同步拦截第二次调用。
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setAIStatus("loading");
    // 新运行开始时清理旧 AI 内容，防止用户误认为旧解释属于新代码。
    setAIError("");
    setAIAnalysis([], [], []);
    // 第一步：在 iframe 沙箱中执行当前代码并收集真实输出。
    let logs: string[];
    let cost = 0;
    // 第二步：把源码和真实输出交给 GLM，生成解释、摘要和代码标记。
    try {
      const execution = await runInIframeSandbox(code, language);
      logs = execution.logs;
      cost = execution.durationMs;
    } catch (error) {
      // TypeScript 转译等沙箱外错误也转换成控制台输出，页面不会直接崩溃。
      logs = [`Error  ${error instanceof Error ? error.message : "代码无法执行"}`];
    }
    setLastRunMs(cost);
    setOutput([...logs, `runtime        ${cost}ms`, "AI 解释        正在请求"]);

    let historyOutput = [...logs, `runtime        ${cost}ms`];
    let historyStatus: "success" | "error" = "error";
    let historyError = "";
    let historyAnalysis: AIAnalysisResult = { blocks: [], summary: [], markers: [] };

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
      historyAnalysis = result;
      historyStatus = "success";
      historyOutput = [...logs, `runtime        ${cost}ms`, "AI 解释        已返回"];
      setOutput(historyOutput);
    } catch (error) {
      // AI 失败不影响前面已经完成的代码执行，真实日志仍会保留。
      const message = error instanceof Error ? error.message : "AI 解释请求失败。";
      setAIError(message);
      setAIStatus("error");
      historyStatus = "error";
      historyError = message;
      historyOutput = [...logs, `runtime        ${cost}ms`, `AI 解释        ${message}`];
      setOutput(historyOutput);
    }

    // 第三步：把这次运行完整保存到 IndexedDB，供历史页面读取。
    const currentFile = projectFiles.find((file) => file.name === activeFile);
    try {
      await saveHistoryRecord({
        fileName: activeFile,
        fileSource: currentFile?.source ?? "user",
        language,
        code,
        output: historyOutput,
        durationMs: cost,
        status: historyStatus,
        questionTypes: selectedQuestionTypes,
        customQuestion,
        aiBlocks: historyAnalysis.blocks,
        aiSummary: historyAnalysis.summary,
        codeMarkers: historyAnalysis.markers,
        aiError: historyError,
      });
    } catch (error) {
      // 本地存储失败只记录到开发者控制台，不覆盖用户已经拿到的执行和 AI 结果。
      console.error("保存历史记录失败", error);
    }

    // 最后登记执行快照；只有源码没有继续变化时，可视化入口才会开放。
    setExecutionSnapshot(activeFile, code, historyOutput, cost);
    runningRef.current = false;
    setRunning(false);
  };

  return (
    <main className="content">
      <ShellHeader
        mode="editor"
        actions={
          // actions 作为 ReactNode 传给公共头部，实现页面专属操作区。
          <div className="askBar">
            <Input
              ref={questionInputRef}
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
        {/* 统计卡片由数组驱动，后续增加指标无需复制整段 JSX。 */}
        {workspaceStats.map((item) => (
          <div key={item.label} className={`statCard glass ${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
        <div className="questionTypes glass">
          {/* 解释重点会随 AI 请求一起发送，不会改变代码的实际执行。 */}
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
        {/* 左侧编辑器、右侧 AI、底部输出共同组成工作区网格。 */}
        <EditorPanel running={running} onRun={handleRun} />
        <AIInsightPanel />
        <div className="bottomWorkspace">
          <OutputConsole output={output} compact />
          <CodeMarkersPanel />
        </div>
      </div>
      {running && (
        // 运行期间显示全局遮罩，也避免用户在同一次请求中途切换操作。
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
