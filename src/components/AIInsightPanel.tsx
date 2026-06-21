/** AI 结果面板：根据请求状态展示摘要、错误、解释卡片或空状态。 */
import { RobotOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { motion } from "framer-motion";
import { usePlaygroundStore } from "../store/playgroundStore";
import { iconMap } from "./icons";

export function AIInsightPanel() {
  // 多字段一次解构写法更短；这个组件会订阅整个返回对象中的这些字段。
  const { model, aiBlocks, aiSummary, aiStatus, aiError, animation } = usePlaygroundStore();

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
      {/* && 是 React 常用的条件渲染写法：条件为真时才创建后面的 JSX。 */}
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
        // AI 可能返回多个分析区块，map 为每个区块生成独立卡片。
        aiBlocks.map((block, index) => (
          <motion.article
            key={block.title}
            className="analysisBlock"
            initial={animation ? { opacity: 0, y: 14 } : false}
            // index 用于形成依次出现的轻微错峰动画。
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: animation ? index * 0.08 : 0, duration: animation ? 0.3 : 0 }}
          >
            <div className="blockTitle">
              <h3>
                {iconMap[block.icon]}
                {block.title}
              </h3>
              <Tag>{block.tag}</Tag>
            </div>
            {block.lines.map((line, lineIndex) => (
              <p key={`${block.title}-${lineIndex}`}>{line}</p>
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
  // 把程序内部英文状态转换成用户可读的中文。
  if (status === "loading") return "解释中";
  if (status === "success") return "已更新";
  if (status === "error") return "出错";
  return "待解释";
}
