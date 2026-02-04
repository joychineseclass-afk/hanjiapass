// ui/ui-stroke-teaching.js
export function initStrokeTeaching(rootEl, stage, traceApi) {
  let teachingOn = false;
  let demoLock = false;

  const traceCanvas = rootEl.querySelector("#traceCanvas");

  function getStrokeAnims(svg) {
    const list = [...svg.querySelectorAll('[id^="make-me-a-hanzi-animation-"]')];
    if (list.length) return list;
    return [...svg.querySelectorAll('[data-stroke], .stroke, [id*="animation"]')];
  }

  function replayCssAnimation(el) {
    if (!el) return;
    el.style.animation = "none";
    el.getBoundingClientRect();
    el.style.animation = "";
  }

  function redrawStrokeColor({ activeIndex, finished = false } = {}) {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return;

    const total = strokes.length;
    const active = finished ? -1 : Math.max(0, Math.min(activeIndex ?? 0, total - 1));

    strokes.forEach((s, idx) => {
      let color;
      if (finished) color = "#111827";
      else if (idx < active) color = "#FB923C";
      else if (idx === active) color = "#93C5FD";
      else color = "#D1D5DB";

      const targets = [s, ...(s?.querySelectorAll?.("*") || [])];
      targets.forEach((el) => {
        try {
          el.style?.setProperty?.("stroke", color, "important");
          el.style?.setProperty?.("fill", color, "important");
        } catch {}
        try {
          const st = el.getAttribute?.("stroke");
          if (st !== "none") el.setAttribute?.("stroke", color);
          const fi = el.getAttribute?.("fill");
          if (fi !== "none") el.setAttribute?.("fill", color);
        } catch {}
      });
    });
  }

  function glowOnce() {
    if (!traceCanvas) return;
    traceCanvas.classList.add("trace-glow");
    clearTimeout(glowOnce._t);
    glowOnce._t = setTimeout(() => traceCanvas.classList.remove("trace-glow"), 180);
  }

  // ✅ 确保有 glow 的 css（只注入一次）
  try {
    if (!document.getElementById("trace-glow-style")) {
      const st = document.createElement("style");
      st.id = "trace-glow-style";
      st.textContent = `
        .trace-glow { filter: drop-shadow(0 0 10px rgba(251,146,60,.9)); }
      `;
      document.head.appendChild(st);
    }
  } catch {}

  function playDemoOneStroke() {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return false;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return false;

    const i = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;
    const s = strokes[i] || strokes[0];
    if (!s) return false;

    redrawStrokeColor({ activeIndex: i, finished: false });
    replayCssAnimation(s);
    return true;
  }

  function finishWholeChar() {
    redrawStrokeColor({ finished: true });

    // ✅ 完成：通知外层把最后一笔也变黑
    queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));

    // ✅ 完成：自动跳下一个字（page.stroke.js 会接住）
    queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:nextchar")));

    // ✅ 完成后锁定输入，并避免 canvas 继续挡住交互
    traceApi?.setEnabled?.(false);
    if (traceCanvas) traceCanvas.style.pointerEvents = "none";
  }

  function onUserStrokeDone() {
    if (!teachingOn) return;
    if (demoLock) return;

    glowOnce(); // ✅ 写对发光（当前没有“判错”，所以先按完成一笔就奖励）

    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    const total = strokes.length || 0;
    if (!total) return;

    // initTraceCanvasLayer 会在抬笔时 autoAdvanceIndex++，所以这里读到的是“下一笔 index”
    const idx = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;

    if (idx >= total) {
      finishWholeChar();
      return;
    }

    redrawStrokeColor({ activeIndex: idx, finished: false });
  }

  function vibrateWrong() {
    // ✅ 写错震动：目前没有判错信号，预留接口
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {}
  }

  // 你以后如果做“判错”，只要在别处 dispatchEvent(new CustomEvent("trace:wrong"))
  // 这里就会震动
  traceCanvas?.addEventListener?.("trace:wrong", vibrateWrong);

  // ✅ ✅ ✅ 关键：统一确保 tracing 打开 + pointerEvents 打开
  function ensureTracingOn() {
    // 1) 打开 tracing（若有 toggle）
    if (typeof traceApi?.toggle === "function") {
      // 强制打开
      try {
        traceApi.toggle(true);
      } catch {}
    }

    // 2) 双保险：canvas 必须接收指针
    if (traceCanvas) traceCanvas.style.pointerEvents = "auto";
  }

  function start() {
    teachingOn = true;

    // ✅ 重置到第一笔（换字或重新开始）
    traceApi?.setStrokeIndex?.(0);

    // ✅ 先确保 tracing 打开（否则 enabled=true 也写不了）
    ensureTracingOn();

    // 示范时先锁
    traceApi?.setEnabled?.(false);
    demoLock = true;

    playDemoOneStroke();

    setTimeout(() => {
      demoLock = false;

      // ✅ 示范结束 → 解锁允许写
      ensureTracingOn();
      traceApi?.setEnabled?.(true);

      // ✅ 你现场调试用：一眼看出到底能不能写
      try {
        console.log(
          "[TEACHING READY]",
          "enabled:", traceApi?.isEnabled?.?.() ?? traceApi?.isEnabled?.() ?? "(no isEnabled)",
          "tracing:", traceApi?.isTracing?.?.() ?? traceApi?.isTracing?.() ?? "(no isTracing)",
          "pointerEvents:", traceCanvas?.style?.pointerEvents
        );
      } catch {}
    }, 300);
  }

  function stop() {
    teachingOn = false;
    demoLock = false;

    traceApi?.setEnabled?.(false);

    // ✅ 关闭时避免挡住其它交互（拖拽/缩放等）
    if (traceCanvas) traceCanvas.style.pointerEvents = "none";

    redrawStrokeColor({ finished: true });
  }

  // ✅ 返回给 ui-stroke-player.js 使用
  return {
    start,
    stop,
    onUserStrokeDone
  };
}
