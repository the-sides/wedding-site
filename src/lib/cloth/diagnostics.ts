/** Phone troubleshooting only: opt in with ?cloth-debug=1. Nothing is sent anywhere. */
export function enableClothDiagnostics(stage: HTMLElement) {
  if (!new URLSearchParams(location.search).has("cloth-debug")) return;
  const key = "cloth-graphics-diagnostics";
  let history: object[] = [];
  try {
    history = JSON.parse(sessionStorage.getItem(key) ?? "[]");
  } catch {
    /* Storage can be disabled. */
  }
  const panel = document.createElement("details");
  panel.style.cssText =
    "position:fixed;z-index:1000;bottom:12px;left:12px;right:12px;max-height:42svh;overflow:auto;padding:12px;background:#221812ed;color:#fff8e9;font:12px/1.5 monospace;border:1px solid #a18b72;border-radius:6px";
  const summary = document.createElement("summary");
  summary.textContent = "Graphics diagnostics";
  const copy = document.createElement("button");
  copy.textContent = "Copy diagnostics";
  copy.style.cssText = "margin:10px 0;padding:8px;cursor:pointer";
  const output = document.createElement("pre");
  output.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;margin:0";
  panel.append(summary, copy, output);
  document.body.append(panel);
  const report = () =>
    JSON.stringify({ browser: navigator.userAgent, events: history }, null, 2);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(report());
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select the report below to copy";
    }
  });
  function record() {
    const status = stage.dataset.clothStatus;
    if (!status) return;
    const canvas = stage.querySelector<HTMLCanvasElement>(
      "[data-cloth-canvas] canvas",
    );
    const gl = canvas?.getContext("webgl2");
    const debug =
      gl && !gl.isContextLost()
        ? gl.getExtension("WEBGL_debug_renderer_info")
        : null;
    history.push({
      at: new Date().toISOString(),
      status,
      detail: stage.dataset.clothDetail || undefined,
      renderer: debug
        ? gl!.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : undefined,
      contextLost: gl?.isContextLost(),
      antialias: gl?.getContextAttributes()?.antialias,
      drawingBuffer: canvas ? [canvas.width, canvas.height] : undefined,
    });
    history = history.slice(-20);
    output.textContent = report();
    try {
      sessionStorage.setItem(key, JSON.stringify(history));
    } catch {
      /* Report still works in memory. */
    }
  }
  new MutationObserver(record).observe(stage, {
    attributes: true,
    attributeFilter: ["data-cloth-status", "data-cloth-detail"],
  });
}
