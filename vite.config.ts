import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "monaco-vendor";
          if (id.includes("echarts")) return "echarts-vendor";
          if (id.includes("react-flow-renderer")) return "react-flow-vendor";
          if (id.includes("antd") || id.includes("@ant-design")) return "antd-vendor";
        },
      },
    },
  },
});
