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
