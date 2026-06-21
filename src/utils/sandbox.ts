/**
 * 浏览器代码沙箱。
 * 用户代码在隐藏 iframe 中执行，外层页面通过 postMessage 收集 console 输出。
 */
import type { Language } from "../store/playgroundStore";

const RUN_TIMEOUT_MS = 5_000;
const ASYNC_SETTLE_MS = 120;

export type SandboxResult = {
  // logs 保持实际产生顺序；durationMs 截止到最后一次活动。
  logs: string[];
  durationMs: number;
};

export async function runInIframeSandbox(code: string, language: Language) {
  // 浏览器不能直接执行 TypeScript，因此先移除类型语法，再交给 iframe。
  const executable = language === "typescript" ? await transpileTypeScript(code) : code;
  return new Promise<SandboxResult>((resolve) => {
    const logs: string[] = [];
    // 每次运行使用独立令牌，避免其他窗口或上一次运行伪造 postMessage。
    const runToken = createRunToken();
    const iframe = document.createElement("iframe");
    iframe.sandbox.add("allow-scripts");
    iframe.style.display = "none";

    let finished = false;
    // finish 可能被正常完成和超时同时触发，finished 保证 Promise 只清理一次。
    let lastActivityMs = 0;
    const finish = (fallback?: string) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      // 清理 iframe 和事件监听，避免每次运行都积累隐藏节点。
      window.removeEventListener("message", handleMessage);
      iframe.remove();
      resolve({
        logs: logs.length ? logs : [fallback ?? "代码已执行，无 console 输出"],
        durationMs: Math.max(0, Math.round(lastActivityMs)),
      });
    };

    const handleMessage = (event: MessageEvent) => {
      // 同时检查窗口来源和令牌；只接收当前 iframe 发出的消息。
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.source !== "ai-code-playground" || event.data?.runToken !== runToken) return;
      if (event.data.type !== "done" && typeof event.data.elapsedMs === "number") lastActivityMs = event.data.elapsedMs;
      // 把不同 console 方法保存成可辨认的文本前缀。
      if (event.data.type === "log") logs.push(`console.log  ${event.data.payload}`);
      if (event.data.type === "warn") logs.push(`console.warn  ${event.data.payload}`);
      if (event.data.type === "info") logs.push(`console.info  ${event.data.payload}`);
      if (event.data.type === "error") logs.push(`Error  ${event.data.payload}`);
      if (event.data.type === "done") finish();
    };

    const timeoutId = window.setTimeout(() => {
      lastActivityMs = RUN_TIMEOUT_MS;
      finish(`Error  执行超过 ${RUN_TIMEOUT_MS / 1000} 秒，已停止等待输出`);
    }, RUN_TIMEOUT_MS);
    window.addEventListener("message", handleMessage);
    document.body.appendChild(iframe);
    // HTML 作为完整页面加载；JS/TS 则作为脚本在最小 HTML 文档中运行。
    iframe.srcdoc = language === "html" ? createHtmlDocument(executable, runToken) : createScriptDocument(executable, runToken);
  });
}

async function transpileTypeScript(code: string) {
  // 动态 import 只有运行 TS 时才加载较大的 TypeScript 编译器资源。
  const ts = await import("typescript");
  return ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: false,
  }).outputText;
}

function createScriptDocument(code: string, runToken: string) {
  // 把源码序列化成字符串后再 eval，可避免用户代码中的 </script> 提前结束标签。
  const serializedCode = JSON.stringify(code).replace(/</g, "\\u003c");
  return `<!doctype html><html><body><script>${createBridge(runToken)}
    try {
      (0, eval)(${serializedCode});
      send("checkpoint", null);
      finishWhenIdle();
    } catch (error) {
      send("error", error instanceof Error ? error.message : String(error));
      send("done", null);
    }
  </script></body></html>`;
}

function createHtmlDocument(code: string, runToken: string) {
  // HTML 模式把通信桥插入 head，保证用户自己的 script 执行前 console 已被代理。
  const bridge = `<script>${createBridge(runToken)}
    window.addEventListener("load", () => {
      send("checkpoint", null);
      finishWhenIdle();
    });
  <\/script>`;

  if (/<head[\s>]/i.test(code)) return code.replace(/<head([^>]*)>/i, `<head$1>${bridge}`);
  if (/<html[\s>]/i.test(code)) return code.replace(/<html([^>]*)>/i, `<html$1><head>${bridge}</head>`);
  return `<!doctype html><html><head>${bridge}</head><body>${code}</body></html>`;
}

function createBridge(runToken: string) {
  // 这段字符串会运行在 iframe 内部：代理 console 和定时器，再把结果发回 React 页面。
  return `
    const startedAt = performance.now();
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const nativePostMessage = window.parent.postMessage.bind(window.parent);
    const send = (type, payload) => nativePostMessage({ source: "ai-code-playground", runToken: ${JSON.stringify(runToken)}, type, payload, elapsedMs: performance.now() - startedAt }, "*");
    const stringify = (value) => {
      // console.log 可能接收对象；优先 JSON 化，循环引用时回退为 String。
      if (typeof value === "string") return value;
      try { return JSON.stringify(value); } catch { return String(value); }
    };
    console.log = (...args) => send("log", args.map(stringify).join(" "));
    console.warn = (...args) => send("warn", args.map(stringify).join(" "));
    console.info = (...args) => send("info", args.map(stringify).join(" "));
    console.error = (...args) => send("error", args.map(stringify).join(" "));
    window.onerror = (message, _source, _line, _column, error) => send("error", error?.message || String(message));
    window.onunhandledrejection = (event) => send("error", event.reason?.message || String(event.reason));
    let pendingTimeouts = 0;
    const pendingTimerIds = new Set();
    let executionReady = false;
    let doneTimer = null;
    const scheduleDone = () => {
      // 只有主脚本结束且没有待执行定时器时，才开始最终静默等待。
      if (!executionReady || pendingTimeouts > 0) return;
      if (doneTimer !== null) nativeClearTimeout(doneTimer);
      doneTimer = nativeSetTimeout(() => send("done", null), ${ASYNC_SETTLE_MS});
    };
    const finishWhenIdle = () => {
      executionReady = true;
      scheduleDone();
    };
    // 追踪用户创建的 setTimeout，等异步回调执行完再通知外层结束。
    window.setTimeout = (callback, delay = 0, ...args) => {
      if (doneTimer !== null) nativeClearTimeout(doneTimer);
      pendingTimeouts += 1;
      const timerId = nativeSetTimeout(() => {
        try {
          if (typeof callback === "function") callback(...args);
          else (0, eval)(String(callback));
        } finally {
          pendingTimerIds.delete(timerId);
          pendingTimeouts -= 1;
          scheduleDone();
        }
      }, delay);
      pendingTimerIds.add(timerId);
      return timerId;
    };
    window.clearTimeout = (timerId) => {
      // 用户取消定时器后同步减少计数，否则沙箱会误以为仍有任务未完成。
      nativeClearTimeout(timerId);
      if (!pendingTimerIds.delete(timerId)) return;
      pendingTimeouts -= 1;
      scheduleDone();
    };
  `;
}

function createRunToken() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
