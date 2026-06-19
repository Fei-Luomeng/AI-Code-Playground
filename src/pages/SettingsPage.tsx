import { SettingOutlined } from "@ant-design/icons";
import { Segmented, Slider, Switch, Tag } from "antd";
import { ThemeMode, usePlaygroundStore } from "../store/playgroundStore";
import { ShellHeader } from "../components/ShellHeader";

export function SettingsPage() {
  const {
    model,
    theme,
    fontSize,
    tabSize,
    wordWrap,
    minimap,
    animation,
    setTheme,
    setFontSize,
    setTabSize,
    setWordWrap,
    setMinimap,
    setAnimation,
  } = usePlaygroundStore();
  const apiConfigured = Boolean(import.meta.env.VITE_GLM_API_KEY);

  return (
    <main className="content">
      <ShellHeader mode="settings" />
      <section className="settingsLayout">
        <div className="settingsPage glass">
          <div className="sectionTitle">
            <SettingOutlined />
            设置
          </div>
          <div className="settingRow">
            <div>
              <strong>主题</strong>
              <span>切换整体背景、卡片、文字和代码编辑器主题</span>
            </div>
            <Segmented
              value={theme}
              onChange={(value) => setTheme(value as ThemeMode)}
              options={[
                { label: "深色", value: "dark" },
                { label: "浅色", value: "light" },
              ]}
            />
          </div>
          <div className="settingRow">
            <div>
              <strong>字体大小</strong>
              <span>只影响中间代码编辑器的字号，当前 {fontSize}px</span>
            </div>
            <Slider min={12} max={20} value={fontSize} onChange={setFontSize} className="settingSlider" />
          </div>
          <div className="settingRow">
            <div>
              <strong>Tab 空格</strong>
              <span>控制格式化和缩进宽度，当前 {tabSize} 个空格</span>
            </div>
            <Segmented
              value={tabSize}
              onChange={(value) => setTabSize(Number(value))}
              options={[
                { label: "2", value: 2 },
                { label: "4", value: 4 },
              ]}
            />
          </div>
          <div className="settingRow">
            <div>
              <strong>自动换行</strong>
              <span>长代码行会在编辑器宽度内折行，减少横向滚动</span>
            </div>
            <Switch checked={wordWrap} onChange={setWordWrap} />
          </div>
          <div className="settingRow">
            <div>
              <strong>代码小地图</strong>
              <span>在编辑器右侧显示代码缩略图，适合浏览长文件</span>
            </div>
            <Switch checked={minimap} onChange={setMinimap} />
          </div>
          <div className="settingRow">
            <div>
              <strong>AI 模型</strong>
              <span>当前解释、标记和建议都会使用这个模型生成</span>
            </div>
            <Tag className="modelTag">{model}</Tag>
          </div>
          <div className="settingRow">
            <div>
              <strong>动画效果</strong>
              <span>控制 AI 解释卡片的入场动效</span>
            </div>
            <Switch checked={animation} onChange={setAnimation} />
          </div>
        </div>
        <div className="previewCard glass">
          <span className="eyebrow">当前效果</span>
          <h3>代码编辑体验</h3>
          <p>主题和字号会立即作用到工作台；深色偏沉浸，浅色更适合白天阅读代码。</p>
          <div className="previewCode">
            <span>主题：{theme === "dark" ? "深色霓虹" : "浅色清爽"}</span>
            <span>编辑器字号：{fontSize}px</span>
            <span>缩进：{tabSize} 个空格</span>
            <span>自动换行：{wordWrap ? "开启" : "关闭"}</span>
            <span>代码小地图：{minimap ? "开启" : "关闭"}</span>
            <span>运行环境：iframe 沙箱</span>
          </div>
        </div>
        <div className="apiCard glass">
          <span className="eyebrow">API</span>
          <h3>GLM-4.7-Flash</h3>
          <p>点击“解释代码”后，会先运行代码拿到控制台输出，再把源码、输出和解释重点一起发送给 GLM。</p>
          <div className="apiStatus">
            <span>API Key</span>
            <strong>{apiConfigured ? "已配置" : "未配置"}</strong>
          </div>
        </div>
        <div className="shortcutCard glass">
          <span className="eyebrow">快捷操作</span>
          <div className="shortcutList">
            <span>解释代码</span>
            <kbd>⌘ Enter</kbd>
            <span>格式化</span>
            <kbd>⌥ ⇧ F</kbd>
            <span>补充问题</span>
            <kbd>⌘ I</kbd>
          </div>
        </div>
      </section>
    </main>
  );
}
