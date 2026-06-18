import { SettingOutlined } from "@ant-design/icons";
import { Segmented, Select, Slider, Switch } from "antd";
import { ModelName, usePlaygroundStore } from "../store/playgroundStore";
import { ShellHeader } from "../components/ShellHeader";

export function SettingsPage() {
  const { model, fontSize, autoRun, animation, setModel, setFontSize, setAutoRun, setAnimation } = usePlaygroundStore();
  const apiConfigured = Boolean(import.meta.env.VITE_GLM_API_KEY);

  return (
    <main className="content">
      <ShellHeader mode="settings" />
      <section className="settingsLayout">
        <div className="settingsPage glass">
          <div className="sectionTitle">
            <SettingOutlined />
            Preferences
          </div>
          <div className="settingRow">
            <div>
              <strong>主题</strong>
              <span>Dark / Light 外观切换</span>
            </div>
            <Segmented options={["Dark", "Light"]} defaultValue="Dark" />
          </div>
          <div className="settingRow">
            <div>
              <strong>字体大小</strong>
              <span>Monaco Editor font size</span>
            </div>
            <Slider min={12} max={20} value={fontSize} onChange={setFontSize} className="settingSlider" />
          </div>
          <div className="settingRow">
            <div>
              <strong>AI 模型</strong>
              <span>代码解释会直连本地环境变量配置的 API</span>
            </div>
            <Select
              value={model}
              onChange={(value: ModelName) => setModel(value)}
              options={[
                { value: "GLM-4.7-Flash", label: "GLM-4.7-Flash" },
                { value: "DeepSeek", label: "DeepSeek" },
              ]}
            />
          </div>
          <div className="settingRow">
            <div>
              <strong>自动运行</strong>
              <span>代码变更后自动刷新输出</span>
            </div>
            <Switch checked={autoRun} onChange={setAutoRun} />
          </div>
          <div className="settingRow">
            <div>
              <strong>动画效果</strong>
              <span>控制 Framer Motion 与流程高亮</span>
            </div>
            <Switch checked={animation} onChange={setAnimation} />
          </div>
          <div className="settingRow">
            <div>
              <strong>历史存储</strong>
              <span>localStorage / IndexedDB 静态占位</span>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
        <div className="previewCard glass">
          <span className="eyebrow">Preview</span>
          <h3>Neon Cyber Theme</h3>
          <p>玻璃拟态卡片、霓虹蓝紫高光、低亮度网格背景，以及面向开发者的高密度工作台布局。</p>
          <div className="previewCode">
            <span>theme.dark = true</span>
            <span>model = "{model}"</span>
            <span>sandbox = "iframe"</span>
          </div>
        </div>
        <div className="apiCard glass">
          <span className="eyebrow">API</span>
          <h3>GLM-4.7-Flash</h3>
          <p>代码编辑页会使用 .env.local 中的 VITE_GLM_API_KEY 请求 GLM，生成解释、标记和建议。</p>
          <div className="apiStatus">
            <span>Endpoint</span>
            <strong>{apiConfigured ? "Configured" : "Not connected"}</strong>
          </div>
        </div>
        <div className="shortcutCard glass">
          <span className="eyebrow">Shortcuts</span>
          <div className="shortcutList">
            <span>Run</span>
            <kbd>⌘ Enter</kbd>
            <span>Format</span>
            <kbd>⌥ ⇧ F</kbd>
            <span>AI Explain</span>
            <kbd>⌘ I</kbd>
          </div>
        </div>
      </section>
    </main>
  );
}
