import {
  ApiOutlined,
  AppstoreOutlined,
  BugOutlined,
  CodeOutlined,
  ConsoleSqlOutlined,
  HistoryOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { IconKey } from "../data/appConfig";

// Record<IconKey, JSX.Element> 保证配置里出现的每种图标名称都有对应组件。
export const iconMap: Record<IconKey, JSX.Element> = {
  api: <ApiOutlined />,
  app: <AppstoreOutlined />,
  bug: <BugOutlined />,
  code: <CodeOutlined />,
  console: <ConsoleSqlOutlined />,
  history: <HistoryOutlined />,
  robot: <RobotOutlined />,
  settings: <SettingOutlined />,
  thunder: <ThunderboltOutlined />,
};
