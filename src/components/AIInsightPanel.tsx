import { RobotOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { motion } from "framer-motion";
import { usePlaygroundStore } from "../store/playgroundStore";
import { iconMap } from "./icons";

export function AIInsightPanel() {
  const { model, aiBlocks, aiSummary, aiStatus, aiError } = usePlaygroundStore();

  return (
    <aside className="aiPanel glass">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">{model}</span>
          <h2>AI 解释</h2>
          <span className={`aiState ${aiStatus}`}>{getStatusText(aiStatus)}</span>
        </div>
        <div className="panelOrb">
          <RobotOutlined />
        </div>
      </div>
      {aiSummary.length > 0 && (
        <div className="aiSummary">
          {aiSummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      )}
      {aiError && <div className="aiError">{aiError}</div>}
      {aiBlocks.length ? (
        aiBlocks.map((block, index) => (
          <motion.article
            key={block.title}
            className="analysisBlock"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <div className="blockTitle">
              <h3>
                {iconMap[block.icon]}
                {block.title}
              </h3>
              <Tag>{block.tag}</Tag>
            </div>
            {block.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </motion.article>
        ))
      ) : (
        <div className="emptyState">点击“解释代码”后，AI 会基于真实代码和控制台输出生成解释。</div>
      )}
    </aside>
  );
}

function getStatusText(status: string) {
  if (status === "loading") return "解释中";
  if (status === "success") return "已更新";
  if (status === "error") return "出错";
  return "待解释";
}
