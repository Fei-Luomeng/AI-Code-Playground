import { ClockCircleOutlined, FireOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { LineChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "react-flow-renderer";
import "react-flow-renderer/dist/style.css";
import "react-flow-renderer/dist/theme-default.css";
import { ShellHeader } from "../components/ShellHeader";
import { usePlaygroundStore } from "../store/playgroundStore";
import { createExecutionVisualization } from "../utils/executionVisualizer";

echarts.use([LineChart, GridComponent, CanvasRenderer]);

export function VisualPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const { code, output, activeFile, lastRunMs, theme, animation } = usePlaygroundStore();
  const visualization = useMemo(() => createExecutionVisualization(code, output), [code, output]);
  const activeStepIndex = lastRunMs === null ? 0 : Math.max(visualization.steps.length - 1, 0);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    const axisColor = theme === "light" ? "#61708f" : "#9eb6df";
    const splitColor = theme === "light" ? "rgba(83, 105, 160, .16)" : "rgba(120, 160, 255, .12)";

    chart.setOption({
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
          data: visualization.timeline.map((item) => item.value),
          lineStyle: { width: 4, color: "#00d1ff" },
          itemStyle: { color: "#8b5cf6", shadowBlur: 18, shadowColor: "#8b5cf6" },
          areaStyle: { color: "rgba(0, 209, 255, .12)" },
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [theme, visualization.timeline]);

  return (
    <main className="content">
      <ShellHeader mode="visual" />
      <div className="visualGrid">
        <section className="visualBoard glass">
          <div className="sectionTitle">
            <ThunderboltOutlined />
            执行流程图
            <span className="muted">{activeFile}</span>
          </div>
          <ReactFlow key={`${activeFile}-${code.length}`} nodes={visualization.nodes} edges={visualization.edges} fitView>
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
            <motion.div
              key={step.id}
              className={`stepRow ${index === activeStepIndex ? "active" : ""}`}
              animate={animation && index === activeStepIndex ? { borderColor: "rgba(0, 209, 255, .55)" } : undefined}
              transition={{ repeat: animation ? Infinity : 0, repeatType: "mirror", duration: 1.6 }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </motion.div>
          ))}
        </section>
        <section className="timelineChart glass">
          <div className="sectionTitle">
            <FireOutlined />
            执行时间线
            <span className="muted">{lastRunMs === null ? "未运行" : `${lastRunMs}ms`}</span>
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
            <span className="muted">由当前代码生成</span>
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
