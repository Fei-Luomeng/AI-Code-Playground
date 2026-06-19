import type { Edge, Node } from "react-flow-renderer";

type StepType = "sync" | "function" | "call" | "micro" | "macro" | "output" | "dom" | "network" | "branch" | "return";

export type VisualStep = {
  id: string;
  label: string;
  detail: string;
  type: StepType;
};

export type QueueCard = {
  title: string;
  items: string[];
  active: number;
};

export type TimelinePoint = {
  label: string;
  value: number;
};

export type TraceItem = {
  label: string;
  type: StepType;
};

export type ExecutionVisualization = {
  nodes: Node[];
  edges: Edge[];
  steps: VisualStep[];
  queueCards: QueueCard[];
  timeline: TimelinePoint[];
  trace: TraceItem[];
};

type CodeLine = {
  line: number;
  text: string;
  owner: string;
};

type FunctionInfo = {
  name: string;
  startLine: number;
  endLine: number;
  async: boolean;
};

type ExecutionAction = CodeLine & {
  id: string;
  title: string;
  detail: string;
  type: StepType;
  phase: "sync" | "micro" | "macro" | "output";
};

const IGNORED_CALLS = new Set(["if", "for", "while", "switch", "catch", "return", "console", "Promise", "setTimeout", "setInterval"]);

type ScheduledTask = {
  actions: ExecutionAction[];
  after?: ScheduledTask[];
  macros?: ExecutionAction[];
};

export function createExecutionVisualization(code: string, output: string[]): ExecutionVisualization {
  const rawLines = getUsefulLines(code);
  const functions = collectFunctions(rawLines);
  const lines = attachFunctionOwner(rawLines, functions);
  const actions = buildExecutionActions(lines, functions);
  const outputItems = getOutputItems(output);
  const outputActions = outputItems.map<ExecutionAction>((item, index) => ({
    id: `output-${index}`,
    line: index + 1,
    text: item,
    owner: "console",
    title: `输出 ${index + 1}`,
    detail: item,
    type: "output",
    phase: "output",
  }));
  const allActions = [...actions, ...outputActions];

  return {
    nodes: buildNodes(allActions, lines.length),
    edges: buildEdges(allActions),
    steps: buildSteps(allActions, functions, outputItems.length),
    queueCards: buildQueueCards(allActions, functions),
    timeline: buildTimeline(allActions),
    trace: allActions.slice(0, 6).map((action) => ({ label: action.title, type: action.type })),
  };
}

function getUsefulLines(code: string): CodeLine[] {
  return code
    .split("\n")
    .map((line, index) => ({ line: index + 1, text: line.trim(), owner: "全局" }))
    .filter((item) => item.text && !item.text.startsWith("//"));
}

function collectFunctions(lines: CodeLine[]): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  lines.forEach((item, index) => {
    const name = getFunctionName(item.text);
    if (!name) return;

    let depth = 0;
    let endLine = item.line;

    for (let cursor = index; cursor < lines.length; cursor += 1) {
      depth += countChar(lines[cursor].text, "{");
      depth -= countChar(lines[cursor].text, "}");
      endLine = lines[cursor].line;
      if (depth <= 0 && cursor > index) break;
    }

    functions.push({ name, startLine: item.line, endLine, async: /^async\s+function\b/.test(item.text) || /=\s*async\b/.test(item.text) });
  });

  return functions;
}

function attachFunctionOwner(lines: CodeLine[], functions: FunctionInfo[]) {
  return lines.map((line) => {
    const owner = functions.find((item) => line.line > item.startLine && line.line <= item.endLine)?.name ?? "全局";
    return { ...line, owner };
  });
}

function buildExecutionActions(lines: CodeLine[], functions: FunctionInfo[]) {
  const actions: ExecutionAction[] = [];
  const microQueue: ScheduledTask[] = [];
  const macroQueue: ExecutionAction[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*[});]+$/.test(line.text)) continue;
    if (line.owner !== "全局") continue;

    const declaredFunction = getFunctionName(line.text);
    if (declaredFunction) {
      actions.push(createAction(line, "function", "sync", declaredFunction, null));
      continue;
    }

    if (isMacroTask(line.text)) {
      macroQueue.push(...extractCallbackOutputs(lines, index, "macro", "宏任务输出"));
      continue;
    }

    if (isPromiseChainStart(line.text)) {
      const promiseTasks = extractPromiseChainTasks(lines, index);
      if (promiseTasks.length) microQueue.push(promiseTasks[0]);
      continue;
    }

    if (/queueMicrotask\s*\(/.test(line.text)) {
      microQueue.push({ actions: extractCallbackOutputs(lines, index, "micro", "queueMicrotask 输出") });
      continue;
    }

    const calledFunction = getCalledFunction(line.text, functions);
    if (calledFunction) {
      actions.push(createAction(line, "call", "sync", null, calledFunction.name));

      if (calledFunction.async) {
        const asyncResult = buildAsyncFunctionSchedule(lines, calledFunction);
        actions.push(...asyncResult.syncActions);
        if (asyncResult.firstMicroTask) microQueue.push(asyncResult.firstMicroTask);
      } else {
        actions.push(...extractFunctionBodyActions(lines, calledFunction, "sync"));
      }
      continue;
    }

    if (isConsoleLine(line.text)) {
      actions.push(createAction(line, "output", "sync", null, null));
      continue;
    }

    if (isMicroTask(line.text)) {
      microQueue.push({ actions: [createAction(line, "micro", "micro", null, null)] });
      continue;
    }

    actions.push(createAction(line, getStepType(line.text, null, null), "sync", null, null));
  }

  const processedMicro = drainMicroQueue(microQueue, macroQueue);

  return [...actions, ...processedMicro, ...macroQueue];
}

function drainMicroQueue(queue: ScheduledTask[], macroQueue: ExecutionAction[]) {
  const actions: ExecutionAction[] = [];

  while (queue.length) {
    const task = queue.shift();
    if (!task) continue;
    actions.push(...task.actions);
    if (task.macros?.length) macroQueue.push(...task.macros);
    if (task.after?.length) queue.push(...task.after);
  }

  return actions;
}

function getStepType(text: string, declaredFunction: string | null, callName: string | null): StepType {
  if (declaredFunction) return "function";
  if (callName) return "call";
  if (/\.then\s*\(|\.catch\s*\(|\.finally\s*\(|queueMicrotask\s*\(|await\s+|Promise\./.test(text)) return "micro";
  if (/setTimeout\s*\(|setInterval\s*\(|requestAnimationFrame\s*\(|requestIdleCallback\s*\(/.test(text)) return "macro";
  if (/\b(fetch|axios)\s*\(/.test(text)) return "network";
  if (/\b(document|window)\./.test(text)) return "dom";
  if (/^if\s*\(|^else\b|^switch\s*\(|^case\b/.test(text)) return "branch";
  if (/^return\b/.test(text)) return "return";
  if (/console\.(log|error|warn|info)\s*\(/.test(text)) return "output";
  return "sync";
}

function getActionTitle(line: CodeLine, type: StepType, declaredFunction: string | null, callName: string | null) {
  const ownerPrefix = line.owner === "全局" ? "" : `${line.owner} 内`;

  if (declaredFunction) return `L${line.line} 声明函数 ${declaredFunction}`;
  if (callName) return `L${line.line} 调用函数 ${callName}`;
  if (type === "micro") return `L${line.line} ${ownerPrefix}加入微任务`;
  if (type === "macro") return `L${line.line} ${ownerPrefix}注册宏任务`;
  if (type === "network") return `L${line.line} ${ownerPrefix}发起请求`;
  if (type === "dom") return `L${line.line} ${ownerPrefix}操作浏览器对象`;
  if (type === "branch") return `L${line.line} ${ownerPrefix}判断分支`;
  if (type === "return") return `L${line.line} ${ownerPrefix}返回结果`;
  if (type === "output") return `L${line.line} ${ownerPrefix}输出到控制台`;
  return `L${line.line} ${ownerPrefix}执行语句`;
}

function getActionDetail(line: CodeLine, type: StepType, declaredFunction: string | null, callName: string | null) {
  const ownerText = line.owner === "全局" ? "全局作用域" : `${line.owner} 函数内部`;
  const source = shorten(line.text, 88);

  if (declaredFunction) return `先在 ${ownerText} 注册 ${declaredFunction}，函数体不会自动执行，只有被调用时才进入。`;
  if (callName) return `在 ${ownerText} 调用 ${callName}，执行顺序会进入这个函数对应的函数体。源码：${source}`;
  const previewText = line.owner === "全局" ? "" : "这是函数体内部顺序预览；只有函数被调用时才会运行。";

  if (type === "micro") return `在 ${ownerText} 创建微任务，当前同步代码结束后、宏任务之前执行。${previewText}源码：${source}`;
  if (type === "macro") return `在 ${ownerText} 注册宏任务，通常会等当前同步代码和微任务结束后再执行。${previewText}源码：${source}`;
  if (type === "network") return `在 ${ownerText} 发起异步请求，结果返回后再继续后续回调或 await。源码：${source}`;
  if (type === "dom") return `在 ${ownerText} 访问 document/window，可能读取或更新页面状态。源码：${source}`;
  if (type === "branch") return `在 ${ownerText} 判断条件，后续执行路径取决于这个条件结果。${previewText}源码：${source}`;
  if (type === "return") return `在 ${ownerText} 返回当前函数结果，调用方会收到这个返回值。${previewText}源码：${source}`;
  if (type === "output") return `在 ${ownerText} 产生 console 输出。源码：${source}`;
  return `在 ${ownerText} 按源码顺序执行。${previewText}源码：${source}`;
}

function createAction(line: CodeLine, type: StepType, phase: ExecutionAction["phase"], declaredFunction: string | null, callName: string | null): ExecutionAction {
  return {
    ...line,
    id: `line-${line.line}-${phase}-${type}`,
    title: getActionTitle(line, type, declaredFunction, callName),
    detail: getActionDetail(line, type, declaredFunction, callName),
    type,
    phase,
  };
}

function buildSteps(actions: ExecutionAction[], functions: FunctionInfo[], outputCount: number): VisualStep[] {
  if (!actions.length) {
    return [
      {
        id: "empty",
        label: "等待代码输入",
        detail: "编辑或上传代码后，这里会显示具体执行顺序。",
        type: "sync",
      },
    ];
  }

  const functionSummary = getFunctionSummary(functions);
  const orderSummary = actions
    .filter((item) => item.phase !== "output")
    .slice(0, 4)
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join(" -> ");

  return [
    {
      id: "overview",
      label: "先看函数和入口",
      detail: shorten(`${functionSummary} 静态顺序：${orderSummary || "暂无可执行语句"}。函数体内部步骤会标出所属函数；只有函数被调用时才会真正执行。`, 210),
      type: "function",
    },
    ...actions.slice(0, 13).map((action, index) => ({
      id: action.id,
      label: `${index + 1}. ${action.title}`,
      detail: action.detail,
      type: action.type,
    })),
    {
      id: "output-summary",
      label: outputCount ? "对照真实输出" : "等待真实输出",
      detail: outputCount ? `已捕获 ${outputCount} 条 console 输出，可与上面的执行顺序对照。` : "点击“解释代码”运行后，会把真实 console 输出合并进可视化。",
      type: "output",
    },
  ];
}

function buildNodes(actions: ExecutionAction[], lineCount: number): Node[] {
  const visibleActions = actions.filter((item) => item.phase !== "output").slice(0, 8);
  const nodes: Node[] = [
    makeNode("source", 20, 170, `当前代码\n${lineCount} 行`, "source"),
    ...visibleActions.map((action, index) => makeNode(action.id, 250 + (index % 4) * 220, index < 4 ? 70 : 270, nodeLabel(action, index), action.type)),
  ];

  const outputCount = actions.filter((item) => item.phase === "output").length;
  nodes.push(makeNode("console", 1140, 170, `控制台输出\n${outputCount} 条`, "output"));

  return nodes;
}

function buildEdges(actions: ExecutionAction[]): Edge[] {
  const visibleActions = actions.filter((item) => item.phase !== "output").slice(0, 8);
  const edges: Edge[] = [];

  if (!visibleActions.length) return [makeEdge("source", "console")];

  edges.push(makeEdge("source", visibleActions[0].id));
  visibleActions.forEach((action, index) => {
    const next = visibleActions[index + 1];
    if (next) edges.push(makeEdge(action.id, next.id, next.phase !== "sync"));
  });
  edges.push(makeEdge(visibleActions[visibleActions.length - 1].id, "console", true));

  return edges;
}

function buildQueueCards(actions: ExecutionAction[], functions: FunctionInfo[]): QueueCard[] {
  const callStack = actions.filter((item) => item.phase === "sync" && item.type !== "function");
  const microItems = actions.filter((item) => item.phase === "micro");
  const macroItems = actions.filter((item) => item.phase === "macro");
  const outputItems = actions.filter((item) => item.phase === "output");

  return [
    { title: "函数声明", items: formatFunctions(functions), active: functions.length ? 0 : -1 },
    { title: "Call Stack", items: formatActions(callStack, "暂无同步调用"), active: callStack.length ? 0 : -1 },
    { title: "Microtask Queue", items: formatActions(microItems, "暂无微任务"), active: microItems.length ? 0 : -1 },
    { title: "Macrotask Queue", items: formatActions(macroItems, "暂无宏任务"), active: macroItems.length ? 0 : -1 },
    { title: "Console Output", items: outputItems.length ? outputItems.map((item) => item.detail) : ["点击解释代码后显示输出"], active: outputItems.length ? outputItems.length - 1 : -1 },
  ];
}

function buildTimeline(actions: ExecutionAction[]): TimelinePoint[] {
  return actions.slice(0, 13).map((action, index) => ({
    label: `${index + 1} ${getShortType(action.type)}`,
    value: getTimelineValue(action, index),
  }));
}

function getTimelineValue(action: ExecutionAction, index: number) {
  const phaseWeight = action.phase === "sync" ? 2 : action.phase === "micro" ? 4 : action.phase === "macro" ? 3 : 1;
  return phaseWeight + index;
}

function makeNode(id: string, x: number, y: number, label: string, className: string): Node {
  return {
    id,
    position: { x, y },
    className: `flowNode ${className}`,
    data: { label },
  };
}

function makeEdge(source: string, target: string, animated = false): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    animated,
  };
}

function nodeLabel(action: ExecutionAction, index: number) {
  const owner = action.owner === "全局" ? "全局" : action.owner;
  return `${index + 1}. ${action.title}\n${owner}\n${shorten(action.text, 36)}`;
}

function getFunctionSummary(functions: FunctionInfo[]) {
  if (!functions.length) return "当前代码没有明显函数声明。";

  const visibleFunctions = functions.slice(0, 5).map((item) => `${item.name}(L${item.startLine})`).join("、");
  const restCount = functions.length - 5;
  return `识别到 ${functions.length} 个函数：${visibleFunctions}${restCount > 0 ? ` 等 ${restCount} 个` : ""}。`;
}

function formatFunctions(functions: FunctionInfo[]) {
  if (!functions.length) return ["暂无函数声明"];

  const visibleFunctions = functions.slice(0, 8).map((item) => `L${item.startLine}: ${item.name}()\n范围：L${item.startLine}-L${item.endLine}`);
  const restCount = functions.length - visibleFunctions.length;
  return restCount > 0 ? [...visibleFunctions, `还有 ${restCount} 个函数未展示`] : visibleFunctions;
}

function formatActions(items: ExecutionAction[], emptyText: string) {
  if (!items.length) return [emptyText];
  return items.slice(0, 6).map((item) => `${item.title}\n${item.owner === "全局" ? "全局作用域" : `${item.owner} 函数`}\n${shorten(item.text, 68)}`);
}

function getShortType(type: StepType) {
  const labels: Record<StepType, string> = {
    sync: "语句",
    function: "函数",
    call: "调用",
    micro: "微任务",
    macro: "宏任务",
    output: "输出",
    dom: "DOM",
    network: "请求",
    branch: "判断",
    return: "返回",
  };

  return labels[type];
}

function getFunctionName(text: string) {
  const functionMatch = text.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (functionMatch) return functionMatch[1];

  const arrowMatch = text.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
  if (arrowMatch) return arrowMatch[1];

  return null;
}

function getCalledFunction(text: string, functions: FunctionInfo[]) {
  const calls = [...text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((match) => match[1]);
  const name = calls.find((item) => functions.some((fn) => fn.name === item) && !IGNORED_CALLS.has(item));
  return name ? functions.find((item) => item.name === name) ?? null : null;
}

function getOutputItems(output: string[]) {
  return output
    .filter((item) => !/^runtime\s+/.test(item) && !/^AI 解释\s+/.test(item) && !/^待执行/.test(item) && !/^已删除/.test(item) && !/^(Opened|Loaded)\s+/.test(item))
    .slice(0, 5);
}

function countChar(input: string, char: string) {
  return input.split(char).length - 1;
}

function shorten(input: string, maxLength: number) {
  return input.length > maxLength ? `${input.slice(0, maxLength - 1)}...` : input;
}

function isConsoleLine(text: string) {
  return /console\.(log|error|warn|info)\s*\(/.test(text);
}

function isPromiseChainStart(text: string) {
  return /Promise\.resolve\s*\(/.test(text) || /^new Promise\s*\(/.test(text);
}

function isMicroTask(text: string) {
  return /\.then\s*\(|\.catch\s*\(|\.finally\s*\(|queueMicrotask\s*\(|await\s+|Promise\./.test(text);
}

function isMacroTask(text: string) {
  return /setTimeout\s*\(|setInterval\s*\(|requestAnimationFrame\s*\(|requestIdleCallback\s*\(/.test(text);
}

function extractCallbackOutputs(lines: CodeLine[], startIndex: number, phase: "micro" | "macro", label: string) {
  const blockEnd = findBlockEnd(lines, startIndex);
  return lines
    .slice(startIndex + 1, blockEnd + 1)
    .filter((item) => isConsoleLine(item.text))
    .map((item) => createAction({ ...item, owner: lines[startIndex].owner }, phase === "micro" ? "micro" : "macro", phase, null, null))
    .map((item) => ({ ...item, title: `L${item.line} ${label}` }));
}

function extractPromiseChainTasks(lines: CodeLine[], startIndex: number): ScheduledTask[] {
  const chainEnd = findChainEnd(lines, startIndex);
  const outputs = lines.slice(startIndex + 1, chainEnd + 1).filter((item) => isConsoleLine(item.text));
  const tasks = outputs.map<ScheduledTask>((item) => ({
    actions: [createAction({ ...item, owner: lines[startIndex].owner }, "micro", "micro", null, null)],
  }));

  tasks.forEach((task, index) => {
    const nextTask = tasks[index + 1];
    if (nextTask) task.after = [nextTask];
  });

  return tasks;
}

function buildAsyncFunctionSchedule(lines: CodeLine[], fn: FunctionInfo) {
  const body = lines.filter((line) => line.line > fn.startLine && line.line < fn.endLine);
  const firstAwaitIndex = body.findIndex((line) => /^await\b/.test(line.text) || /\bawait\s+/.test(line.text));
  const beforeAwait = firstAwaitIndex === -1 ? body : body.slice(0, firstAwaitIndex);
  const syncActions = beforeAwait.filter((line) => isConsoleLine(line.text)).map((line) => createAction(line, "output", "sync", null, null));

  if (firstAwaitIndex === -1) return { syncActions, firstMicroTask: null as ScheduledTask | null };

  const segments: CodeLine[][] = [];
  let currentSegment: CodeLine[] = [];
  const afterFirstAwait = body.slice(firstAwaitIndex + 1);

  for (let index = 0; index < afterFirstAwait.length; index += 1) {
    const line = afterFirstAwait[index];
    if (/^await\b/.test(line.text) || /\bawait\s+/.test(line.text)) {
      if (/await\s+new Promise/.test(line.text)) {
        const promiseEnd = findBlockEnd(afterFirstAwait, index);
        currentSegment.push(...afterFirstAwait.slice(index + 1, promiseEnd + 1).filter((item) => isConsoleLine(item.text)));
        segments.push(currentSegment);
        currentSegment = [];
        index = promiseEnd;
        continue;
      }

      segments.push(currentSegment);
      currentSegment = [];
    } else {
      currentSegment.push(line);
    }
  }
  segments.push(currentSegment);

  const microTasks = segments
    .map((segment) => {
      const macroRanges = getMacroRanges(segment);
      const actions = segment
        .filter((line, index) => isConsoleLine(line.text) && !isIndexInRanges(index, macroRanges))
        .map((line) => createAction(line, "micro", "micro", null, null));
      const macros = macroRanges.flatMap((range) => extractCallbackOutputs(segment, range.start, "macro", `${fn.name} 内宏任务输出`));
      return actions.length || macros.length ? { actions, macros } : null;
    })
    .filter((task): task is ScheduledTask => Boolean(task));

  microTasks.forEach((task, index) => {
    const nextTask = microTasks[index + 1];
    if (nextTask) task.after = [nextTask];
  });

  return { syncActions, firstMicroTask: microTasks[0] ?? null };
}

function extractFunctionBodyActions(lines: CodeLine[], fn: FunctionInfo, phase: ExecutionAction["phase"]) {
  return lines
    .filter((line) => line.line > fn.startLine && line.line < fn.endLine && isConsoleLine(line.text))
    .map((line) => createAction(line, "output", phase, null, null));
}

function findBlockEnd(lines: CodeLine[], startIndex: number) {
  let depth = 0;

  for (let index = startIndex; index < lines.length; index += 1) {
    depth += countChar(lines[index].text, "{");
    depth -= countChar(lines[index].text, "}");
    if (index > startIndex && depth <= 0) return index;
  }

  return Math.min(startIndex + 6, lines.length - 1);
}

function findChainEnd(lines: CodeLine[], startIndex: number) {
  let endIndex = startIndex;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const text = lines[index].text;
    if (getFunctionName(text) || (/^[A-Za-z_$][\w$]*\s*\(/.test(text) && !text.startsWith("."))) break;
    if (isMacroTask(text) || /queueMicrotask\s*\(/.test(text)) break;
    endIndex = index;
    if (index - startIndex > 14) break;
  }

  return endIndex;
}

function getMacroRanges(lines: CodeLine[]) {
  const ranges: Array<{ start: number; end: number }> = [];

  lines.forEach((line, index) => {
    if (!isMacroTask(line.text)) return;
    ranges.push({ start: index, end: findBlockEnd(lines, index) });
  });

  return ranges;
}

function isIndexInRanges(index: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some((range) => index > range.start && index <= range.end);
}
