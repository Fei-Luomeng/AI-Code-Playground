/** 纯展示组件：接收 output Props，不直接读取或修改全局状态。 */
import { ConsoleSqlOutlined } from "@ant-design/icons";

type OutputConsoleProps = {
  output: string[];
  // ? 表示可选属性；父组件不传时使用函数参数中的默认值 false。
  compact?: boolean;
};

export function OutputConsole({ output, compact = false }: OutputConsoleProps) {
  return (
    <section className={compact ? "console glass" : "console glass consolePage"}>
      <div className="sectionTitle">
        <ConsoleSqlOutlined />
        Output Console
        <span className="muted">DevTools style</span>
        <span className="consoleStatus">live</span>
      </div>
      <div className={compact ? "consoleLines" : "consoleLines large"}>
        {/* index 只用于展示控制台序号，不代表源码行号。 */}
        {output.map((line, index) => (
          <code key={`${line}-${index}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {line}
          </code>
        ))}
      </div>
    </section>
  );
}
