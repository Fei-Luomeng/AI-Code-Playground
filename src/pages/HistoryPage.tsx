/**
 * 历史记录页面。
 * 页面状态保存在 React 中，持久数据由 historyStorage 负责读写 IndexedDB。
 */
import {
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";
import { Button, Empty, Input, Modal, Popconfirm, Segmented, Spin, Tooltip, message } from "antd";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShellHeader } from "../components/ShellHeader";
import {
  clearHistoryRecords,
  deleteHistoryRecord,
  getHistoryRecords,
  setHistoryFavorite,
} from "../services/historyStorage";
import { usePlaygroundStore } from "../store/playgroundStore";
import type { HistoryLanguage, HistoryRecord } from "../types/history";

type HistoryFilter = "all" | "favorite" | HistoryLanguage;

// Segmented 的 label 是显示文字，value 是程序实际保存的筛选值。
const filterOptions = [
  { label: "全部", value: "all" },
  { label: "收藏", value: "favorite" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "HTML", value: "html" },
];

export function HistoryPage() {
  // useNavigate 返回编程式跳转函数，适合在恢复代码完成后跳转。
  const navigate = useNavigate();
  const restoreHistoryRecord = usePlaygroundStore((state) => state.restoreHistoryRecord);
  const theme = usePlaygroundStore((state) => state.theme);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  // 页面临时状态留在组件中，不需要放入全局 Zustand。
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  // contextHolder 必须渲染到 JSX，messageApi 才能继承当前 Ant Design 上下文。

  useEffect(() => {
    // 空依赖数组 [] 表示组件首次挂载时读取一次 IndexedDB。
    void loadRecords();
  }, []);

  // useMemo 缓存搜索结果，只有筛选条件或原始记录变化时才重新计算。
  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return records.filter((record) => {
      const matchesFilter = filter === "all" || (filter === "favorite" ? record.favorite : record.language === filter);
      if (!matchesFilter) return false;
      if (!keyword) return true;
      const searchable = [
        record.fileName,
        record.code,
        record.output.join(" "),
        record.customQuestion,
        record.aiSummary.map((item) => `${item.label} ${item.value}`).join(" "),
        record.aiBlocks.flatMap((block) => [block.title, ...block.lines]).join(" "),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(keyword);
    });
  }, [filter, query, records]);

  const summary = useMemo(() => {
    // setHours 返回今天零点的时间戳，便于统计 createdAt 是否属于今天。
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    return [
      { label: "运行记录", value: records.length },
      { label: "已收藏", value: records.filter((record) => record.favorite).length },
      { label: "今日运行", value: records.filter((record) => record.createdAt >= startOfToday).length },
    ];
  }, [records]);

  async function loadRecords() {
    // finally 无论成功失败都会执行，因此 loading 一定能恢复为 false。
    setLoading(true);
    try {
      setRecords(await getHistoryRecords());
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "读取历史记录失败。为了保护浏览器数据，本页不会展示模拟记录。");
    } finally {
      setLoading(false);
    }
  }

  async function handleFavorite(record: HistoryRecord) {
    // 先写数据库，成功后再更新 React 状态，避免界面与数据库不一致。
    const favorite = !record.favorite;
    try {
      await setHistoryFavorite(record.id, favorite);
      setRecords((current) => current.map((item) => (item.id === record.id ? { ...item, favorite } : item)));
      setSelectedRecord((current) => (current?.id === record.id ? { ...current, favorite } : current));
    } catch (error) {
      messageApi.error(getStorageError(error, "更新收藏失败"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHistoryRecord(id);
      setRecords((current) => current.filter((record) => record.id !== id));
      // 详情弹窗正在展示被删除项时，同时将它关闭。
      setSelectedRecord((current) => (current?.id === id ? null : current));
      messageApi.success("这条运行记录已删除");
    } catch (error) {
      messageApi.error(getStorageError(error, "删除历史记录失败"));
    }
  }

  async function handleClear() {
    try {
      await clearHistoryRecords();
      setRecords([]);
      setSelectedRecord(null);
      messageApi.success("历史记录已清空");
    } catch (error) {
      messageApi.error(getStorageError(error, "清空历史记录失败"));
    }
  }

  function handleRestore(record: HistoryRecord) {
    // Zustand 负责恢复编辑器数据，React Router 负责切回代码编辑页面。
    restoreHistoryRecord(record);
    messageApi.success(`已载入 ${record.fileName}，重新运行后可查看可视化`);
    navigate("/");
  }

  return (
    <main className="content historyPageContent">
      {contextHolder}
      <ShellHeader
        mode="history"
        actions={
          records.length ? (
            <Popconfirm
              // 清空属于不可恢复操作，因此必须经过确认框。
              title="清空全部历史记录？"
              description="清空后无法恢复，已收藏的记录也会一并删除。"
              okText="清空"
              cancelText="取消"
              onConfirm={handleClear}
              overlayClassName="deleteFileConfirm"
            >
              <Button className="historyDeleteButton historyClearButton" icon={<DeleteOutlined />}>清空记录</Button>
            </Popconfirm>
          ) : null
        }
      />

      <section className="historySummary">
        {summary.map((item) => (
          <div key={item.label} className="summaryCard glass">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>

      <div className="historyTools glass">
        {/* Input 与 query 绑定，输入变化后 filteredRecords 会自动重新计算。 */}
        <Input
          prefix={<SearchOutlined />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索文件名、源码、运行输出或 AI 分析"
          allowClear
        />
        <Segmented options={filterOptions} value={filter} onChange={(value) => setFilter(value as HistoryFilter)} />
      </div>

      {loading ? (
        // 三段式条件渲染：加载中、有数据、空状态。
        <div className="historyState glass"><Spin /><span>正在读取本地历史记录</span></div>
      ) : filteredRecords.length ? (
        <section className="historyGrid">
          {/* motion.article 是带入场动画的普通 article，数据仍来自真实 IndexedDB。 */}
          {filteredRecords.map((record, index) => (
            <motion.article
              key={record.id}
              className="historyCard glass"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.24) }}
            >
              <div className="historyTop">
                <span className="eyebrow"><ClockCircleOutlined /> {formatRecordTime(record.createdAt)}</span>
                <button
                  className={`historyIconButton ${record.favorite ? "active" : ""}`}
                  onClick={() => void handleFavorite(record)}
                  aria-label={record.favorite ? "取消收藏" : "收藏"}
                >
                  {record.favorite ? <StarFilled /> : <StarOutlined />}
                </button>
              </div>
              <h3>{record.fileName}</h3>
              <div className="historyTags">
                <span>{getLanguageLabel(record.language)}</span>
                <span>{record.durationMs}ms</span>
                <span className={record.status === "success" ? "historySuccess" : "historyError"}>
                  {record.status === "success" ? "解释成功" : "解释失败"}
                </span>
              </div>
              <pre className="historyCodePreview">{createCodePreview(record.code)}</pre>
              <p>{getRecordSummary(record)}</p>
              <div className="cardActions historyActions">
                <Button type="primary" icon={<ReloadOutlined />} onClick={() => handleRestore(record)}>载入编辑器</Button>
                <Tooltip title="查看完整记录">
                  <Button icon={<EyeOutlined />} onClick={() => setSelectedRecord(record)} />
                </Tooltip>
                <Popconfirm
                  title="删除这条记录？"
                  description="删除后无法恢复。"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => handleDelete(record.id)}
                  overlayClassName="deleteFileConfirm"
                >
                  <Tooltip title="删除记录"><Button className="historyDeleteButton" icon={<DeleteOutlined />} /></Tooltip>
                </Popconfirm>
              </div>
            </motion.article>
          ))}
        </section>
      ) : (
        <div className="historyState glass">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={records.length ? "没有符合搜索条件的记录" : "还没有运行记录，解释一次代码后会自动保存在这里"}
          />
        </div>
      )}

      <Modal
        // selectedRecord 为 null 时关闭弹窗，为对象时展示对应详情。
        open={Boolean(selectedRecord)}
        onCancel={() => setSelectedRecord(null)}
        width={860}
        footer={
          selectedRecord ? [
            <Button key="favorite" icon={selectedRecord.favorite ? <StarFilled /> : <StarOutlined />} onClick={() => void handleFavorite(selectedRecord)}>
              {selectedRecord.favorite ? "取消收藏" : "收藏"}
            </Button>,
            <Button key="restore" type="primary" icon={<ReloadOutlined />} onClick={() => handleRestore(selectedRecord)}>载入编辑器</Button>,
          ] : null
        }
        title={selectedRecord ? `${selectedRecord.fileName} · ${formatRecordTime(selectedRecord.createdAt)}` : "运行详情"}
        className={`historyDetailModal theme-${theme}`}
      >
        {selectedRecord && (
          <div className="historyDetail">
            <div className="historyDetailMeta">
              <span><CodeOutlined /> {getLanguageLabel(selectedRecord.language)}</span>
              <span><ClockCircleOutlined /> {selectedRecord.durationMs}ms</span>
              <span>{selectedRecord.status === "success" ? "AI 解释成功" : selectedRecord.aiError}</span>
            </div>
            <section><h4>源码</h4><pre>{selectedRecord.code}</pre></section>
            <section><h4>控制台输出</h4><pre>{selectedRecord.output.join("\n")}</pre></section>
            <section>
              <h4>AI 分析</h4>
              {selectedRecord.aiBlocks.length ? selectedRecord.aiBlocks.map((block) => (
                <div key={`${block.title}-${block.tag}`} className="historyAnalysisBlock">
                  <strong>{block.title}</strong>
                  {block.lines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
                </div>
              )) : <p className="muted">本次运行没有可用的 AI 分析结果。</p>}
            </section>
          </div>
        )}
      </Modal>
    </main>
  );
}

function createCodePreview(code: string) {
  // 卡片只显示前六行，完整源码仍保存在详情弹窗中。
  const lines = code.trim().split("\n");
  return `${lines.slice(0, 6).join("\n")}${lines.length > 6 ? "\n..." : ""}`;
}

function getRecordSummary(record: HistoryRecord) {
  // 优先使用 AI 第一条解释；没有 AI 结果时再回退到错误或控制台输出。
  const summary = record.aiBlocks.find((block) => block.lines.length)?.lines[0];
  if (summary) return summary;
  if (record.aiError) return `AI 解释失败：${record.aiError}`;
  return record.output[0] ?? "代码已运行，无控制台输出。";
}

function getLanguageLabel(language: HistoryLanguage) {
  if (language === "typescript") return "TypeScript";
  if (language === "html") return "HTML";
  return "JavaScript";
}

function formatRecordTime(timestamp: number) {
  // Intl.DateTimeFormat 会按中文环境生成统一日期格式。
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getStorageError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
