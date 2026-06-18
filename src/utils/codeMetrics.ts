export type WorkspaceStat = {
  label: string;
  value: string;
  tone: "cyan" | "violet" | "green" | "amber";
};

export function getWorkspaceStats(code: string, runtimeMs: number | null): WorkspaceStat[] {
  const lines = code.split("\n").map((line) => line.trim()).filter(Boolean);
  const microTaskCount = countMatches(code, [/\.then\s*\(/g, /queueMicrotask\s*\(/g, /await\s+/g, /MutationObserver/g]);
  const macroTaskCount = countMatches(code, [/setTimeout\s*\(/g, /setInterval\s*\(/g, /requestAnimationFrame\s*\(/g, /requestIdleCallback\s*\(/g]);
  const asyncLines = lines.filter((line) => /Promise|\.then\s*\(|await\s+|setTimeout\s*\(|setInterval\s*\(/.test(line)).length;
  const syncCount = Math.max(lines.length - asyncLines, 0);

  return [
    { label: "执行耗时", value: runtimeMs === null ? "--" : `${runtimeMs}ms`, tone: "cyan" },
    { label: "同步行", value: String(syncCount), tone: "violet" },
    { label: "微任务", value: String(microTaskCount), tone: "green" },
    { label: "宏任务", value: String(macroTaskCount), tone: "amber" },
  ];
}

function countMatches(input: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => total + [...input.matchAll(pattern)].length, 0);
}
