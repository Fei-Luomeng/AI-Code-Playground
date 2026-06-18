import { DatabaseOutlined, SearchOutlined, StarFilled } from "@ant-design/icons";
import { Button, Input, Segmented, Tooltip } from "antd";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { ShellHeader } from "../components/ShellHeader";
import { historyCards, historySummary } from "../data/mockData";

export function HistoryPage() {
  const cards = useMemo(() => historyCards, []);

  return (
    <main className="content">
      <ShellHeader mode="history" />
      <section className="historySummary">
        {historySummary.map((item) => (
          <div key={item.label} className="summaryCard glass">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>
      <div className="historyTools glass">
        <Input prefix={<SearchOutlined />} placeholder="搜索历史代码、运行结果或 AI 摘要" />
        <Segmented options={["全部", "收藏", "JS", "Async"]} defaultValue="全部" />
      </div>
      <section className="historyGrid">
        {cards.map((card, index) => (
          <motion.article
            key={card.title}
            className="historyCard glass"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <div className="historyTop">
              <span className="eyebrow">{card.time}</span>
              {card.favorite && <StarFilled className="star" />}
            </div>
            <h3>{card.title}</h3>
            <div className="historyTags">
              {card.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <pre>{card.result}</pre>
            <p>{card.summary}</p>
            <div className="cardActions">
              <Button>重新打开</Button>
              <Tooltip title="保存到 IndexedDB">
                <Button shape="circle" icon={<DatabaseOutlined />} />
              </Tooltip>
            </div>
          </motion.article>
        ))}
      </section>
    </main>
  );
}
