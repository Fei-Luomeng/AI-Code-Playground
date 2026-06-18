import { ClockCircleOutlined, FireOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { LineChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "react-flow-renderer";
import "react-flow-renderer/dist/style.css";
import "react-flow-renderer/dist/theme-default.css";
import { ShellHeader } from "../components/ShellHeader";
import { flowEdges, flowNodes, queueCards, visualSteps } from "../data/mockData";

echarts.use([LineChart, GridComponent, CanvasRenderer]);

export function VisualPage() {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      backgroundColor: "transparent",
      grid: { left: 24, right: 18, top: 20, bottom: 28 },
      xAxis: {
        type: "category",
        data: ["sync start", "sync end", "microtask", "macrotask"],
        axisLine: { lineStyle: { color: "#29466c" } },
        axisLabel: { color: "#9eb6df" },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 4,
        splitLine: { lineStyle: { color: "rgba(120, 160, 255, .12)" } },
        axisLabel: { color: "#7f94bd" },
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbolSize: 13,
          data: [1, 2, 3, 4],
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
  }, []);

  return (
    <main className="content">
      <ShellHeader mode="visual" />
      <div className="visualGrid">
        <section className="visualBoard glass">
          <div className="sectionTitle">
            <ThunderboltOutlined />
            Event Loop Flow
            <span className="muted">React Flow</span>
          </div>
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
            <Background color="#26365f" gap={18} />
            <MiniMap nodeColor="#00d1ff" maskColor="rgba(5, 9, 24, .72)" />
            <Controls />
          </ReactFlow>
        </section>
        <section className="inspector glass">
          <div className="sectionTitle">
            <ClockCircleOutlined />
            当前执行步骤
          </div>
          {visualSteps.map((step, index) => (
            <motion.div
              key={step}
              className="stepRow"
              animate={{ borderColor: index === 2 ? "rgba(0, 209, 255, .55)" : "rgba(122, 150, 210, .15)" }}
              transition={{ repeat: Infinity, repeatType: "mirror", duration: 1.6 }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </motion.div>
          ))}
        </section>
        <section className="timelineChart glass">
          <div className="sectionTitle">
            <FireOutlined />
            Timeline
            <span className="muted">ECharts</span>
          </div>
          <div ref={chartRef} className="chart" />
        </section>
        <section className="queuePanel glass">
          {queueCards.map((queue) => (
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
            Execution Trace
            <span className="muted">step-by-step</span>
          </div>
          <div className="traceGrid">
            {["parse source", "push global", "register timer", "flush microtask", "paint output"].map((item, index) => (
              <div key={item} className={index === 3 ? "traceItem active" : "traceItem"}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
