/** 代码概览统计：用轻量正则生成编辑器顶部的四项指标。 */
export type WorkspaceStat = {
  label: string;
  value: string;
  tone: "cyan" | "violet" | "green" | "amber";
};

export function getWorkspaceStats(code: string, runtimeMs: number | null): WorkspaceStat[] {
  // 这些指标是轻量级文本统计，用于快速概览，不等同于编译器的语法分析结果。
  const lines = code.split("\n").map((line) => line.trim()).filter(Boolean);
  const microTaskCount = countMatches(code, [/\.then\s*\(/g, /queueMicrotask\s*\(/g, /await\s+/g, /MutationObserver/g]);
  const macroTaskCount = countMatches(code, [/setTimeout\s*\(/g, /setInterval\s*\(/g, /requestAnimationFrame\s*\(/g, /requestIdleCallback\s*\(/g]);
  const functionCount = countMatches(code, [
    /function\s+\w+\s*\(/g,
    /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
    /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\w+\s*=>/g,
  ]);
  const feature = getCodeFeature(code, microTaskCount, macroTaskCount);
  const complexity = getCodeComplexity(code, lines.length, functionCount, microTaskCount + macroTaskCount);

  return [
    { label: "执行耗时", value: runtimeMs === null ? "--" : `${runtimeMs}ms`, tone: "cyan" },
    { label: "代码行数", value: String(lines.length), tone: "violet" },
    { label: "复杂度", value: complexity, tone: "green" },
    { label: "代码特征", value: feature, tone: "amber" },
  ];
}

function countMatches(input: string, patterns: RegExp[]) {
  // reduce 把多个正则的匹配数量累加成一个总数。
  return patterns.reduce((total, pattern) => total + [...input.matchAll(pattern)].length, 0);
}

function getCodeFeature(code: string, microTaskCount: number, macroTaskCount: number) {
  // 特征按优先级返回一个最能代表当前代码的标签。
  const hasNetwork = /\b(fetch|axios)\s*\(/.test(code);
  const hasDom = /\b(document|window)\./.test(code);
  const hasAsync = microTaskCount > 0 || macroTaskCount > 0 || /\basync\s+function\b|\bawait\s+/.test(code);

  if (hasNetwork) return "网络请求";
  if (microTaskCount > 0 && macroTaskCount > 0) return "异步混合";
  if (microTaskCount > 0) return "Promise";
  if (macroTaskCount > 0) return "定时器";
  if (hasAsync) return "异步函数";
  if (hasDom) return "DOM 操作";
  return "同步代码";
}

function getCodeComplexity(code: string, lineCount: number, functionCount: number, asyncTaskCount: number) {
  // 这是面向学习界面的粗略等级，不是严格的圈复杂度实现。
  const branchCount = countMatches(code, [/\bif\s*\(/g, /\belse\b/g, /\bswitch\s*\(/g, /\bcase\b/g, /\?.+:/g]);
  const loopCount = countMatches(code, [/\bfor\s*\(/g, /\bwhile\s*\(/g, /\.forEach\s*\(/g, /\.map\s*\(/g, /\.reduce\s*\(/g]);
  const score = branchCount + loopCount + functionCount + asyncTaskCount + Math.floor(lineCount / 12);

  if (score >= 7) return "较复杂";
  if (score >= 3) return "中等";
  return "简单";
}
