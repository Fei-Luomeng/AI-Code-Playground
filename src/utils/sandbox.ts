export function runInIframeSandbox(code: string) {
  return new Promise<string[]>((resolve) => {
    const logs: string[] = [];
    const iframe = document.createElement("iframe");
    iframe.sandbox.add("allow-scripts");
    iframe.style.display = "none";

    const html = `
      <script>
        const send = (type, payload) => parent.postMessage({ source: "ai-code-playground", type, payload }, "*");
        console.log = (...args) => send("log", args.map(String).join(" "));
        console.error = (...args) => send("error", args.map(String).join(" "));
        window.onerror = (_message, _source, _line, _column, error) => {
          send("error", error?.message || String(_message));
        };
        window.onunhandledrejection = (event) => {
          send("error", event.reason?.message || String(event.reason));
        };
        try {
          ${code}
          setTimeout(() => send("done", null), 40);
        } catch (error) {
          send("error", error.message);
          send("done", null);
        }
      </script>
    `;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== "ai-code-playground") return;
      if (event.data.type === "log") logs.push(`console.log  ${event.data.payload}`);
      if (event.data.type === "error") logs.push(`Error  ${event.data.payload}`);
      if (event.data.type === "done") {
        window.removeEventListener("message", handleMessage);
        iframe.remove();
        resolve(logs.length ? logs : ["代码已执行，无 console 输出"]);
      }
    };

    window.addEventListener("message", handleMessage);
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}
