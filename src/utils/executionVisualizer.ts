/**
 * 教学型执行流程解析器。
 * 输入是源码与真实 console 输出，返回 React Flow 和 ECharts 可以直接消费的数据。
 */
import type { Edge, Node } from "react-flow-renderer";

type StepType = "sync" | "function" | "call" | "micro" | "macro" | "output" | "dom" | "network" | "branch" | "return";
// StepType 同时决定节点文字、颜色和时间线分类。

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
  // 一个解析结果服务于页面上的五个不同区域。
  nodes: Node[];
  edges: Edge[];
  steps: VisualStep[];
  queueCards: QueueCard[];
  timeline: TimelinePoint[];
  trace: TraceItem[];
};

type CodeLine = {
  // line 保存原始行号；text 是去除首尾空白后的源码；owner 表示所属函数。
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
  // & 表示交叉类型：ExecutionAction 包含 CodeLine 的全部字段以及下面新增字段。
  id: string;
  title: string;
  detail: string;
  type: StepType;
  phase: "sync" | "micro" | "macro" | "output";
};

const IGNORED_CALLS = new Set(["if", "for", "while", "switch", "catch", "return", "console", "Promise", "setTimeout", "setInterval"]);
// Set 的 has 查询适合快速排除“看起来像函数调用但其实是语法关键字”的名称。

type ScheduledTask = {
  actions: ExecutionAction[];
  after?: ScheduledTask[];
  macros?: ExecutionAction[];
};

export function createExecutionVisualization(code: string, output: string[]): ExecutionVisualization {
  // 先推导源码中的执行动作，再把 iframe 的真实输出按顺序合并进去。
  // 这里是教学可视化解析器，并不是浏览器引擎级别的指令追踪器。
  const rawLines = getUsefulLines(code);
  const functions = collectFunctions(rawLines);
  const lines = attachFunctionOwner(rawLines, functions);
  const actions = buildExecutionActions(lines, functions);
  const outputItems = getOutputItems(output);
  const visualActions = attachRuntimeOutputs(actions, outputItems);

  return {
    nodes: buildNodes(visualActions, lines.length, outputItems.length),
    edges: buildEdges(visualActions),
    steps: buildSteps(visualActions, functions, outputItems.length),
    queueCards: buildQueueCards(visualActions, functions, outputItems),
    timeline: buildTimeline(visualActions, outputItems),
    trace: buildTrace(visualActions, outputItems),
  };
}

function attachRuntimeOutputs(actions: ExecutionAction[], outputItems: string[]) {
  // 不重新创建执行顺序，只把真实输出补充到对应 console 动作的详情中。
  let outputIndex = 0;
  return actions.map((action) => {
    if (!isConsoleLine(action.text) || outputIndex >= outputItems.length) return action;
    const runtimeOutput = formatRuntimeOutput(outputItems[outputIndex]);
    outputIndex += 1;
    return { ...action, detail: `${action.detail} 真实输出：${runtimeOutput}` };
  });
}

function getUsefulLines(code: string): CodeLine[] {
  // 保留真实行号，但过滤空行和整行注释，减少后续扫描噪音。
  return code
    .split("\n")
    .map((line, index) => ({ line: index + 1, text: line.trim(), owner: "全局" }))
    .filter((item) => item.text && !item.text.startsWith("//"));
}

function collectFunctions(lines: CodeLine[]): FunctionInfo[] {
  // 扫描普通函数和箭头函数，并用花括号深度估算函数结束行。
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
  // 给函数体内每一行标记 owner，后面生成“某函数内部执行”说明。
  return lines.map((line) => {
    const owner = functions.find((item) => line.line > item.startLine && line.line <= item.endLine)?.name ?? "全局";
    return { ...line, owner };
  });
}

function buildExecutionActions(lines: CodeLine[], functions: FunctionInfo[]) {
  // 用数组模拟事件循环中的同步流程、微任务队列和宏任务队列。
  const actions: ExecutionAction[] = [];
  const microQueue: ScheduledTask[] = [];
  const macroQueue: ExecutionAction[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    // for 而不是 forEach，是因为识别到回调块后需要主动跳过若干行。
    const line = lines[index];
    if (/^\s*[});]+$/.test(line.text)) continue;
    if (line.owner !== "全局") continue;

    const declaredFunction = getFunctionName(line.text);
    if (declaredFunction) {
      actions.push(createAction(line, "function", "sync", declaredFunction, null));
      continue;
    }

    if (isMacroTask(line.text)) {
      // 注册时先进入宏任务队列，回调体不能在这里按同步代码重复处理。
      const blockEnd = findBlockEnd(lines, index);
      macroQueue.push(...extractCallbackOutputs(lines, index, "macro", "异步宏任务执行并输出"));
      index = blockEnd;
      continue;
    }

    if (isPromiseChainStart(line.text)) {
      // Promise.then 回调按照链式关系放入微任务队列。
      const promiseTasks = extractPromiseChainTasks(lines, index);
      if (promiseTasks.length) microQueue.push(promiseTasks[0]);
      index = findChainEnd(lines, index);
      continue;
    }

    if (/queueMicrotask\s*\(/.test(line.text)) {
      const blockEnd = findBlockEnd(lines, index);
      microQueue.push({ actions: extractCallbackOutputs(lines, index, "micro", "异步微任务执行并输出") });
      index = blockEnd;
      continue;
    }

    const calledFunction = getCalledFunction(line.text, functions);
    if (calledFunction) {
      // 函数声明与函数调用是两件事；只有找到调用才展开函数体动作。
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
  // 微任务按先进先出执行；执行微任务时还可能继续追加微任务或宏任务。
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
  // 按更具体到更普通的顺序匹配，最后无法识别的语句归为 sync。
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
  if (type === "micro") return isConsoleLine(line.text) ? `L${line.line} ${ownerPrefix}执行异步微任务并输出` : `L${line.line} ${ownerPrefix}加入异步微任务`;
  if (type === "macro") return isConsoleLine(line.text) ? `L${line.line} ${ownerPrefix}执行异步宏任务并输出` : `L${line.line} ${ownerPrefix}注册异步宏任务`;
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
  // 所有动作都从这里创建，保证 id、标题和详情格式统一。
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
  // 右侧步骤栏除了具体动作，还会增加开头概览和结尾输出总结。
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

function buildNodes(actions: ExecutionAction[], lineCount: number, runtimeOutputCount: number): Node[] {
  // 为避免大文件把画布撑爆，流程图最多展示前八个主要动作。
  const visibleActions = actions.filter((item) => item.phase !== "output").slice(0, 8);
  const nodes: Node[] = [
    makeNode("source", 20, 170, `当前代码\n${lineCount} 行`, "source"),
    ...visibleActions.map((action, index) => makeNode(action.id, 250 + (index % 4) * 220, index < 4 ? 70 : 270, nodeLabel(action, index), action.type)),
  ];

  nodes.push(makeNode("console", 1140, 170, `控制台输出\n${runtimeOutputCount} 条`, "output"));

  return nodes;
}

function buildEdges(actions: ExecutionAction[]): Edge[] {
  // 边把源码入口、动作节点和控制台按执行顺序连接起来。
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

function buildQueueCards(actions: ExecutionAction[], functions: FunctionInfo[], outputItems: string[]): QueueCard[] {
  // 同一批 action 按 phase 分类后，分别填入调用栈、微任务和宏任务卡片。
  const callStack = actions.filter((item) => item.phase === "sync" && item.type !== "function");
  const microItems = actions.filter((item) => item.phase === "micro");
  const macroItems = actions.filter((item) => item.phase === "macro");

  return [
    { title: "函数声明", items: formatFunctions(functions), active: functions.length ? 0 : -1 },
    { title: "Call Stack", items: formatActions(callStack, "暂无同步调用"), active: callStack.length ? 0 : -1 },
    { title: "Microtask Queue", items: formatActions(microItems, "暂无微任务"), active: microItems.length ? 0 : -1 },
    { title: "Macrotask Queue", items: formatActions(macroItems, "暂无宏任务"), active: macroItems.length ? 0 : -1 },
    { title: "Console Output", items: outputItems.length ? outputItems.map(formatRuntimeOutput) : ["点击解释代码后显示输出"], active: outputItems.length ? outputItems.length - 1 : -1 },
  ];
}

function buildTimeline(actions: ExecutionAction[], outputItems: string[]): TimelinePoint[] {
  // 运行后以真实输出数量为准；尚未运行时才展示静态推导动作。
  if (outputItems.length) {
    const consoleActions = actions.filter((action) => isConsoleLine(action.text));
    return outputItems.map((_, index) => {
      const action = consoleActions[index];
      return {
        label: `${index + 1} ${action ? getPhaseLabel(action.phase) : "输出"}`,
        value: index + 1,
      };
    });
  }

  return actions.slice(0, 13).map((action, index) => ({
    label: `${index + 1} ${getShortType(action.type)}`,
    value: getTimelineValue(action, index),
  }));
}

function buildTrace(actions: ExecutionAction[], outputItems: string[]): TraceItem[] {
  // 执行轨迹优先展示真实 console 顺序，并附带推导出的同步/异步分类。
  if (!outputItems.length) return actions.slice(0, 6).map((action) => ({ label: action.title, type: action.type }));

  const consoleActions = actions.filter((action) => isConsoleLine(action.text));
  return outputItems.slice(0, 12).map((item, index) => {
    const action = consoleActions[index];
    return {
      label: `${action ? getPhaseLabel(action.phase) : "输出"}：${formatRuntimeOutput(item)}`,
      type: action?.type ?? "output",
    };
  });
}

function getPhaseLabel(phase: ExecutionAction["phase"]) {
  if (phase === "micro") return "异步·微任务";
  if (phase === "macro") return "异步·宏任务";
  if (phase === "sync") return "同步";
  return "输出";
}

function getTimelineValue(action: ExecutionAction, index: number) {
  const phaseWeight = action.phase === "sync" ? 2 : action.phase === "micro" ? 4 : action.phase === "macro" ? 3 : 1;
  return phaseWeight + index;
}

function makeNode(id: string, x: number, y: number, label: string, className: string): Node {
  // React Flow 的节点本质是包含 id、坐标和 data 的普通对象。
  return {
    id,
    position: { x, y },
    className: `flowNode ${className}`,
    data: { label },
  };
}

function makeEdge(source: string, target: string, animated = false): Edge {
  // source/target 必须引用已存在的节点 id。
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
  // matchAll 可能找出一行中的多个调用，再与已声明函数列表做交集。
  const calls = [...text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((match) => match[1]);
  const name = calls.find((item) => functions.some((fn) => fn.name === item) && !IGNORED_CALLS.has(item));
  return name ? functions.find((item) => item.name === name) ?? null : null;
}

function getOutputItems(output: string[]) {
  // runtime 和 AI 状态是控制台附加信息，不属于用户代码的真实 console 输出。
  return output
    .filter((item) => !/^runtime\s+/.test(item) && !/^AI 解释\s+/.test(item) && !/^待执行/.test(item) && !/^已删除/.test(item) && !/^代码已执行，无 console 输出/.test(item) && !/^(Opened|Loaded)\s+/.test(item))
    .slice(0, 20);
}

function formatRuntimeOutput(output: string) {
  return output.replace(/^console\.(?:log|error|warn|info)\s+/, "").replace(/^Error\s+/, "错误：");
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
    .map<ScheduledTask | null>((segment) => {
      const macroRanges = getMacroRanges(segment);
      const actions = segment
        .filter((line, index) => isConsoleLine(line.text) && !isIndexInRanges(index, macroRanges))
        .map((line) => createAction(line, "micro", "micro", null, null));
      const macros = macroRanges.flatMap((range) => extractCallbackOutputs(segment, range.start, "macro", `${fn.name} 内宏任务输出`));
      return actions.length || macros.length ? { actions, macros } : null;
    })
    .filter((task): task is ScheduledTask => task !== null);

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
  // 通过花括号计数找到 setTimeout、函数等代码块的结束位置。
  let depth = 0;

  for (let index = startIndex; index < lines.length; index += 1) {
    depth += countChar(lines[index].text, "{");
    depth -= countChar(lines[index].text, "}");
    if (index > startIndex && depth <= 0) return index;
  }

  return Math.min(startIndex + 6, lines.length - 1);
}

function findChainEnd(lines: CodeLine[], startIndex: number) {
  // Promise 链可能跨越多行，通过括号深度判断链何时真正结束。
  let endIndex = startIndex;
  let depth = getDelimiterDepth(lines[startIndex].text);

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const text = lines[index].text;
    if (depth <= 0 && !text.startsWith(".")) break;
    endIndex = index;
    depth += getDelimiterDepth(text);
    if (index - startIndex > 14) break;
  }

  return endIndex;
}

function getDelimiterDepth(text: string) {
  // 同时统计圆括号、花括号和方括号，支持多行 Promise 回调。
  return countChar(text, "(") + countChar(text, "{") + countChar(text, "[")
    - countChar(text, ")") - countChar(text, "}") - countChar(text, "]");
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
