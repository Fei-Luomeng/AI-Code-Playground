import axios from "axios";
import type { ModelName } from "../store/playgroundStore";
import type { AIAnalysisResult, AnalysisBlock, CodeMarker } from "../types/analysis";

type AnalyzeCodeParams = {
  code: string;
  output: string[];
  model: ModelName;
  questionTypes: string[];
  customQuestion?: string;
};

type GlmResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const GLM_API_URL = import.meta.env.VITE_GLM_API_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

export async function analyzeCodeWithGlm(params: AnalyzeCodeParams): Promise<AIAnalysisResult> {
  const apiKey = import.meta.env.VITE_GLM_API_KEY;

  if (!apiKey) {
    throw new Error("缺少 VITE_GLM_API_KEY，请在 .env.local 中配置。");
  }

  const response = await axios.post<GlmResponse>(
    GLM_API_URL,
    {
      model: getApiModelName(params.model),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是一个前端代码学习平台的 AI 解释助手。请基于用户源码、控制台输出和自定义问题做通用代码解释，不要只解释事件循环。请只返回 JSON，不要输出 Markdown。JSON 格式为：{\"summary\":[{\"label\":\"复杂度\",\"value\":\"中\"}],\"markers\":[{\"line\":1,\"type\":\"sync\",\"title\":\"入口逻辑\",\"detail\":\"...\"}],\"blocks\":[{\"title\":\"代码解释\",\"tag\":\"Line by line\",\"icon\":\"code\",\"lines\":[\"...\"]}]}。icon 只能使用 code、app、bug、api。markers 的 type 只能使用 sync、micro、macro、error、output，line 必须是源码真实行号。面试追问 block 必须包含 2 到 3 个追问，每个追问都要紧跟一条简短参考答案，lines 使用“问：...”和“答：...”交替输出。",
        },
        {
          role: "user",
          content: JSON.stringify({
            code: params.code,
            output: params.output,
            questionTypes: params.questionTypes,
            customQuestion: params.customQuestion,
            requiredSections: ["代码解释", "关键逻辑", "错误风险", "优化建议", "面试追问"],
            markerRequirement: "请根据源码生成有用的代码标记，不限于同步异步；可以标出入口逻辑、关键分支、状态变化、输出语句、错误风险、异步任务、性能风险。",
            interviewRequirement: "面试追问不要只给问题，必须给参考答案。格式示例：问：闭包是什么？答：闭包是函数可以访问其词法作用域外层变量的能力，常用于封装状态和延迟执行。",
          }),
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  const content = response.data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 没有返回可解析内容。");
  }

  return normalizeAIResult(content);
}

function normalizeAIResult(content: string): AIAnalysisResult {
  try {
    const parsed = JSON.parse(stripJsonFence(content)) as Partial<AIAnalysisResult>;

    return {
      summary: normalizeSummary(parsed.summary),
      blocks: normalizeBlocks(parsed.blocks),
      markers: normalizeMarkers(parsed.markers),
    };
  } catch {
    return {
      summary: [],
      blocks: [
        {
          title: "代码解释",
          icon: "code",
          tag: "AI Text",
          lines: content.split("\n").filter(Boolean).slice(0, 6),
        },
      ],
      markers: [],
    };
  }
}

function stripJsonFence(content: string) {
  return content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function getApiModelName(model: ModelName) {
  if (model === "GLM-4.7-Flash") return "glm-4.7-flash";
  return "deepseek-chat";
}

function normalizeSummary(summary: unknown): AIAnalysisResult["summary"] {
  if (!Array.isArray(summary)) return [];
  return summary
    .filter((item) => item && typeof item.label === "string" && typeof item.value === "string")
    .map((item) => ({ label: item.label, value: item.value }));
}

function normalizeBlocks(blocks: unknown): AnalysisBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((block) => block && typeof block.title === "string" && Array.isArray(block.lines))
    .map((block) => ({
      title: block.title,
      icon: isValidIcon(block.icon) ? block.icon : "code",
      tag: typeof block.tag === "string" ? block.tag : "AI",
      lines: block.lines.filter((line: unknown) => typeof line === "string"),
    }));
}

function normalizeMarkers(markers: unknown): CodeMarker[] {
  if (!Array.isArray(markers)) return [];
  return markers
    .filter((marker) => marker && Number.isInteger(marker.line) && typeof marker.title === "string" && typeof marker.detail === "string")
    .map((marker) => ({
      line: Math.max(1, marker.line),
      type: isValidMarkerType(marker.type) ? marker.type : "sync",
      title: marker.title,
      detail: marker.detail,
    }));
}

function isValidIcon(icon: unknown): icon is AnalysisBlock["icon"] {
  return icon === "code" || icon === "app" || icon === "bug" || icon === "api";
}

function isValidMarkerType(type: unknown): type is CodeMarker["type"] {
  return type === "sync" || type === "micro" || type === "macro" || type === "error" || type === "output";
}
