/**
 * 可视化页面：把执行快照转换成流程图、步骤列表、时间线和队列卡片。
 * React Flow 负责节点图，ECharts 负责时间线，Framer Motion 负责步骤动画。
 */
import { ClockCircleOutlined, FireOutlined, PlayCircleOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { LineChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "react-flow-renderer";
import "react-flow-renderer/dist/style.css";
import "react-flow-renderer/dist/theme-default.css";
import { ShellHeader } from "../components/ShellHeader";
import { usePlaygroundStore } from "../store/playgroundStore";
import { createExecutionVisualization } from "../utils/executionVisualizer";

// ECharts 按需注册模块，避免引入完整图表库。
echarts.use([LineChart, GridComponent, CanvasRenderer]);

export function VisualPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const { code, activeFile, lastRunMs, theme, animation, executedCode, executedOutput, executedFile, runRevision } = usePlaygroundStore();
  // 只有文件和源码都与执行快照一致，页面展示的才是当前代码的真实结果。
  const hasPreviousExecution = executedFile === activeFile && executedCode !== null;
  const codeChangedAfterRun = hasPreviousExecution && executedCode !== code;
  const hasExecution = hasPreviousExecution && !codeChangedAfterRun;
  // 没有有效执行快照时只分析当前源码，不把旧 console 输出混进来。
  const visualCode = hasExecution ? executedCode : code;
  const visualOutput = hasExecution ? executedOutput : [];
  // 解析源码的成本高于普通字符串展示，所以用 useMemo 避免无关渲染时重复计算。
  const visualization = useMemo(() => createExecutionVisualization(visualCode, visualOutput), [visualCode, visualOutput]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [playbackKey, setPlaybackKey] = useState(0);
  const activeStep = visualization.steps[activeStepIndex];
  // React Flow 节点是普通对象；这里复制节点并给当前步骤追加高亮 class。
  const flowNodes = useMemo(
    () => visualization.nodes.map((node) => ({
      ...node,
      className: `${node.className ?? ""}${node.id === activeStep?.id ? " flowNodeActive" : ""}`,
    })),
    [activeStep?.id, visualization.nodes],
  );

  useEffect(() => {
    // 运行快照变化或点击重新播放时，用定时器逐步推进当前高亮步骤。
    setActiveStepIndex(0);
    if (!hasExecution) return;
    if (!animation) {
      setActiveStepIndex(Math.max(visualization.steps.length - 1, 0));
      return;
    }

    let current = 0;
    // interval 每 650ms 推进一步，到最后一步后立即停止。
    const timer = window.setInterval(() => {
      current += 1;
      setActiveStepIndex(Math.min(current, visualization.steps.length - 1));
      if (current >= visualization.steps.length - 1) window.clearInterval(timer);
    }, 650);
    return () => window.clearInterval(timer);
  }, [animation, hasExecution, playbackKey, runRevision, visualization.steps.length]);

  useEffect(() => {
    // ECharts 属于命令式库：React 创建容器，effect 负责初始化和销毁图表实例。
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    const axisColor = theme === "light" ? "#61708f" : "#9eb6df";
    const splitColor = theme === "light" ? "rgba(83, 105, 160, .16)" : "rgba(120, 160, 255, .12)";

    chart.setOption({
      // setOption 使用普通 JavaScript 对象描述坐标轴和折线数据。
      backgroundColor: "transparent",
      grid: { left: 24, right: 18, top: 20, bottom: 28 },
      xAxis: {
        type: "category",
        data: visualization.timeline.map((item) => item.label),
        axisLine: { lineStyle: { color: theme === "light" ? "#c5d2ea" : "#29466c" } },
        axisLabel: { color: axisColor },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: Math.max(...visualization.timeline.map((item) => item.value), 4),
        splitLine: { lineStyle: { color: splitColor } },
        axisLabel: { color: axisColor },
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbolSize: 13,
          data: visualization.timeline.map((item, index) => ({
            // 当前时间点单独换色，和右侧步骤高亮保持同步。
            value: item.value,
            itemStyle: { color: index === Math.max(activeStepIndex - 1, 0) ? "#39e6ff" : "#8b5cf6" },
          })),
          lineStyle: { width: 4, color: "#00d1ff" },
          itemStyle: { color: "#8b5cf6", shadowBlur: 18, shadowColor: "#8b5cf6" },
          areaStyle: { color: "rgba(0, 209, 255, .12)" },
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      // 清理监听和实例，避免反复进入页面后产生内存泄漏。
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [activeStepIndex, theme, visualization.timeline]);

  return (
    <main className="content">
      <ShellHeader
        mode="visual"
        actions={hasExecution ? <Button icon={<PlayCircleOutlined />} onClick={() => setPlaybackKey((value) => value + 1)}>重新播放</Button> : null}
      />
      <div className="visualGrid">
        <section className="visualBoard glass">
          <div className="sectionTitle">
            <ThunderboltOutlined />
            执行流程图
            <span className="muted">{activeFile}</span>
            <span className={hasExecution ? "visualRunStatus success" : codeChangedAfterRun ? "visualRunStatus changed" : "visualRunStatus"}>
              {hasExecution ? "真实执行结果" : codeChangedAfterRun ? "代码已修改，请重新运行" : "静态预览，尚未运行"}
            </span>
          </div>
          <ReactFlow key={`${activeFile}-${runRevision}-${createCodeFingerprint(visualCode)}`} nodes={flowNodes} edges={visualization.edges} fitView>
            {/* key 变化会重建画布，确保新一次运行不会保留旧节点内部状态。 */}
            <Background color={theme === "light" ? "#c5d2ea" : "#26365f"} gap={18} />
            <MiniMap nodeColor="#00d1ff" maskColor={theme === "light" ? "rgba(247, 251, 255, .72)" : "rgba(5, 9, 24, .72)"} />
            <Controls />
          </ReactFlow>
        </section>
        <section className="inspector glass">
          <div className="sectionTitle">
            <ClockCircleOutlined />
            当前执行步骤
          </div>
          {visualization.steps.map((step, index) => (
            // motion.div 的用法和普通 div 相同，只是额外支持 animate/transition。
            <motion.div
              key={step.id}
              className={`stepRow ${index === activeStepIndex ? "active" : ""}`}
              animate={animation && index === activeStepIndex ? { borderColor: "rgba(0, 209, 255, .55)" } : undefined}
              transition={{ repeat: animation ? Infinity : 0, repeatType: "mirror", duration: 1.6 }}
            >
              <span className="stepIndex">{String(index + 1).padStart(2, "0")}</span>
              <div className="stepContent">
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </motion.div>
          ))}
        </section>
        <section className="timelineChart glass">
          <div className="sectionTitle">
            <FireOutlined />
            执行时间线
            <span className="muted">{hasExecution && lastRunMs !== null ? `${lastRunMs}ms` : "未运行"}</span>
          </div>
          <div ref={chartRef} className="chart" />
        </section>
        <section className="queuePanel glass">
          {visualization.queueCards.map((queue) => (
            <article key={queue.title} className="queueCard">
              <h3>{queue.title}</h3>
              <div className="queueItems">
                {queue.items.map((item, index) => (
                  <span key={item} className={index === queue.active ? "active" : ""}>
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
        <section className="tracePanel glass">
          <div className="sectionTitle">
            <ThunderboltOutlined />
            执行轨迹
            <span className="muted">{hasExecution ? "按本次真实执行生成" : "仅分析代码结构，不代表实际执行"}</span>
          </div>
          <div className="traceGrid">
            {visualization.trace.map((item, index) => (
              <div key={`${item.label}-${index}`} className={index === activeStepIndex ? "traceItem active" : "traceItem"}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function createCodeFingerprint(code: string) {
  // 用轻量哈希得到稳定 key，避免把整段源码直接塞进 React key。
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) hash = (hash * 31 + code.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}
