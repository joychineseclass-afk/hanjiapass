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

  function ensureTracingOn() {
    // ✅ 关键兜底：必须让 traceApi 的 state.tracing=true
    // 否则 onPointerDown 会直接 return（看起来能点，实际画不上）
    try {
      if (typeof traceApi?.toggle === "function") traceApi.toggle(true);
    } catch {}

    // ✅ 同步 DOM 层可写（再兜底一次）
    try {
      if (traceCanvas) traceCanvas.style.pointerEvents = "auto";
    } catch {}
  }

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

    // ✅ 收尾：禁止继续写（你如果想写完还能继续描红，就删掉这行）
    traceApi?.setEnabled?.(false);
  }

  function onUserStrokeDone() {
    if (!teachingOn) return;
    if (demoLock) return;

    glowOnce();

    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    const total = strokes.length || 0;
    if (!total) return;

    // initTraceCanvasLayer 在抬笔时 autoAdvanceIndex++，所以这里读到的是“下一笔 index”
    const idx = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;

    if (idx >= total) {
      finishWholeChar();
      return;
    }

    redrawStrokeColor({ activeIndex: idx, finished: false });
  }

  function vibrateWrong() {
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {}
  }
  traceCanvas?.addEventListener?.("trace:wrong", vibrateWrong);

  function start() {
    teachingOn = true;

    // ✅ 关键：开启 tracing（否则你永远画不上）
    ensureTracingOn();

    // ✅ 重置到第一笔（换字或重新开始）
    traceApi?.setStrokeIndex?.(0);

    // ✅ 清空旧笔迹（更像“开始练习”）
    traceApi?.clear?.();

    // ✅ 学生写的颜色（橘色）
    traceApi?.setPenColor?.("#FB923C");

    // 示范时先锁
    traceApi?.setEnabled?.(false);
    demoLock = true;

    playDemoOneStroke();

    // ✅ 示范后允许写
    setTimeout(() => {
      demoLock = false;

      // 再兜底一次：有些时候外层又把 tracing 关掉
      ensureTracingOn();

      traceApi?.setEnabled?.(true);
    }, 300);
  }

  function stop() {
    teachingOn = false;
    demoLock = false;

    // 关闭时禁止写
    traceApi?.setEnabled?.(false);

    // 可选：也把 tracing 关掉（由 player 控制更一致）
    // try { traceApi?.toggle?.(false); } catch {}

    redrawStrokeColor({ finished: true });
  }

  return {
    start,
    stop,
    onUserStrokeDone
  };
}
