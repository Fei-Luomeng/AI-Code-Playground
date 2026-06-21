/**
 * GLM API 服务层。
 * 负责组织提示词、发送 Axios 请求，并把不稳定的 AI 输出整理成稳定前端类型。
 */
import axios from "axios";
import type { ModelName } from "../store/playgroundStore";
import type { AIAnalysisResult, AnalysisBlock, CodeMarker } from "../types/analysis";

type AnalyzeCodeParams = {
  // 这是函数调用方必须提供的输入结构。
  code: string;
  output: string[];
  model: ModelName;
  questionTypes: string[];
  customQuestion?: string;
};

type GlmResponse = {
  // API 字段使用 ?，因为网络返回可能缺少任意一层数据。
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const GLM_API_URL = import.meta.env.VITE_GLM_API_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";
// || 后面是默认地址，只有环境变量为空时才使用。

export async function analyzeCodeWithGlm(params: AnalyzeCodeParams): Promise<AIAnalysisResult> {
  // Vite 只会把 VITE_ 开头的环境变量暴露给前端代码。
  const apiKey = import.meta.env.VITE_GLM_API_KEY;

  if (!apiKey) {
    throw new Error("缺少 VITE_GLM_API_KEY，请在 .env.local 中配置。");
  }

  // <GlmResponse> 是 Axios 响应的 TypeScript 泛型，只参与类型检查，不会发送给服务端。
  const response = await axios.post<GlmResponse>(
    GLM_API_URL,
    {
      model: getApiModelName(params.model),
      temperature: 0.2,
      messages: [
        // system 规定 AI 的角色和 JSON 输出格式。
        {
          role: "system",
          content:
            "你是一个前端代码学习平台的 AI 解释助手。请基于用户源码、控制台输出和自定义问题做通用代码解释，不要只解释事件循环。请只返回 JSON，不要输出 Markdown。JSON 格式为：{\"summary\":[{\"label\":\"复杂度\",\"value\":\"中\"}],\"markers\":[{\"line\":1,\"type\":\"sync\",\"title\":\"入口逻辑\",\"detail\":\"...\"}],\"blocks\":[{\"title\":\"代码解释\",\"tag\":\"Line by line\",\"icon\":\"code\",\"lines\":[\"...\"]}]}。icon 只能使用 code、app、bug、api。markers 的 type 只能使用 sync、micro、macro、error、output，line 必须是源码真实行号。面试追问 block 必须包含 2 到 3 个追问，每个追问都要紧跟一条简短参考答案，lines 使用“问：...”和“答：...”交替输出。",
        },
        {
          // user 放入本次真实源码、输出和用户选择，JSON.stringify 可减少提示词歧义。
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
      // timeout 防止网络异常时页面一直保持加载状态。
      timeout: 45_000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  const content = response.data.choices?.[0]?.message?.content;
  // ?. 是可选链：中间任意字段不存在都会得到 undefined，而不是抛异常。
  if (!content) {
    throw new Error("AI 没有返回可解析内容。");
  }

  return normalizeAIResult(content, params.code.split("\n").length);
}

function normalizeAIResult(content: string, maxLine: number): AIAnalysisResult {
  // AI 输出属于外部数据，不能直接相信；解析失败时降级成普通文本解释。
  try {
    const parsed = JSON.parse(stripJsonFence(content)) as Partial<AIAnalysisResult>;

    return {
      summary: normalizeSummary(parsed.summary),
      blocks: normalizeBlocks(parsed.blocks),
      markers: normalizeMarkers(parsed.markers, maxLine),
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
  // 有些模型会忽略要求并包一层 Markdown 代码块，这里先去掉围栏再 JSON.parse。
  return content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function getApiModelName(model: ModelName) {
  if (model === "GLM-4.7-Flash") return "glm-4.7-flash";
  return "deepseek-chat";
}

function normalizeSummary(summary: unknown): AIAnalysisResult["summary"] {
  // filter 负责验证，map 负责只保留页面真正需要的字段。
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

function normalizeMarkers(markers: unknown, maxLine: number): CodeMarker[] {
  // unknown 强制我们先检查字段类型，也阻止越界行号传给 Monaco。
  if (!Array.isArray(markers)) return [];
  return markers
    .filter((marker) => marker && Number.isInteger(marker.line) && marker.line >= 1 && marker.line <= maxLine && typeof marker.title === "string" && typeof marker.detail === "string")
    .map((marker) => ({
      line: marker.line,
      type: isValidMarkerType(marker.type) ? marker.type : "sync",
      title: marker.title,
      detail: marker.detail,
    }));
}

function isValidIcon(icon: unknown): icon is AnalysisBlock["icon"] {
  // “icon is ...” 是 TypeScript 类型谓词，返回 true 后类型会自动收窄。
  return icon === "code" || icon === "app" || icon === "bug" || icon === "api";
}

function isValidMarkerType(type: unknown): type is CodeMarker["type"] {
  return type === "sync" || type === "micro" || type === "macro" || type === "error" || type === "output";
}
