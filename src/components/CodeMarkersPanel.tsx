/** 展示 AI 返回的逐行代码标记，与 Monaco 中的行高亮使用同一份数据。 */
import { AimOutlined } from "@ant-design/icons";
import { usePlaygroundStore } from "../store/playgroundStore";

export function CodeMarkersPanel() {
  const codeMarkers = usePlaygroundStore((state) => state.codeMarkers);

  return (
    <section className="codeMarkers glass">
      <div className="sectionTitle">
        <AimOutlined />
        代码标记
        <span className="muted">execution notes</span>
      </div>
      {codeMarkers.length ? (
        // marker.type 同时参与 className，使不同类型拥有不同颜色。
        <div className="markerList">
          {codeMarkers.map((marker) => (
            <article key={`${marker.type}-${marker.line}-${marker.title}`} className={`markerItem ${marker.type}`}>
              <span className="markerLine">L{marker.line}</span>
              <div>
                <strong>{marker.title}</strong>
                <p>{marker.detail}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="emptyState">运行代码后，AI 会根据真实源码生成逐行标记。</div>
      )}
    </section>
  );
}
