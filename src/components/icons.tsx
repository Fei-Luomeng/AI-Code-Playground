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
import type { IconKey } from "../data/mockData";

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
