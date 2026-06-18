import { ConsoleSqlOutlined } from "@ant-design/icons";

type OutputConsoleProps = {
  output: string[];
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
