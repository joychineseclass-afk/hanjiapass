// ui/ui-stroke-teaching.js
export function initStrokeTeaching(rootEl, stage, traceApi) {
  let teachingOn = false;
  let demoLock = false;

  const traceCanvas = rootEl.querySelector("#traceCanvas");

  // =========================
  // Helpers
  // =========================
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

  // ✅ glow CSS（只注入一次）
  try {
    if (!document.getElementById("trace-glow-style")) {
      const st = document.createElement("style");
      st.id = "trace-glow-style";
      st.textContent = `.trace-glow { filter: drop-shadow(0 0 10px rgba(251,146,60,.9)); }`;
      document.head.appendChild(st);
    }
  } catch {}

  // =========================
  // Demo play
  // =========================
  function playDemoStrokeAt(index) {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return;

    const i = Math.max(0, Math.min(Number(index ?? 0) || 0, strokes.length - 1));
    const s = strokes[i];
    if (!s) return;

    redrawStrokeColor({ activeIndex: i, finished: false });
    replayCssAnimation(s);
  }

  function finishWholeChar() {
    redrawStrokeColor({ finished: true });

    // 完成事件：给外部（player）用
    queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));
    queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:nextchar")));

    // 完成后禁写
    try { traceApi?.setEnabled?.(false); } catch (e) {}
    if (traceCanvas) traceCanvas.style.pointerEvents = "none";
  }

  // =========================
  // Timers & anti-deadlock
  // =========================
  let _lastNextIdx = -1;
  let _unlockTimer = null;
  let _forceUnlockTimer = null;

  function clearTimers() {
    if (_unlockTimer) {
      clearTimeout(_unlockTimer);
      _unlockTimer = null;
    }
    if (_forceUnlockTimer) {
      clearTimeout(_forceUnlockTimer);
      _forceUnlockTimer = null;
    }
  }

  function lockInputForDemo() {
    demoLock = true;
    try { traceApi?.setEnabled?.(false); } catch (e) {}
    if (traceCanvas) traceCanvas.style.pointerEvents = "none";
  }

  function unlockInputAfterDemo() {
    demoLock = false;
    if (!teachingOn) return;

    try { traceApi?.setEnabled?.(true); } catch (e) {}
    if (traceCanvas) traceCanvas.style.pointerEvents = "auto";
  }

  function demoNextAndUnlock(nextIdx) {
    if (!teachingOn) return;

    clearTimers();
    lockInputForDemo();

    try {
      playDemoStrokeAt(nextIdx);
    } catch (e) {}

    // 给示范一点点时间
    _unlockTimer = setTimeout(() => {
      unlockInputAfterDemo();
    }, 450);

    // 最终兜底：不管发生什么都强制解锁（防卡死）
    _forceUnlockTimer = setTimeout(() => {
      if (teachingOn) unlockInputAfterDemo();
    }, 1200);
  }

  // =========================
  // Main hook: user stroke done
  // =========================
  function onUserStrokeDone(detail) {
    if (!teachingOn) return;
    if (demoLock) return;

    glowOnce();

    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    const total = strokes.length || 0;
    if (!total) return;

    // nextIdx = “下一笔 index”
    const nextIdx = Number(detail?.strokeIndexAfter ?? traceApi?.getStrokeIndex?.() ?? 0) || 0;

    // ✅ 去重：同一个 nextIdx 不重复处理
    if (nextIdx === _lastNextIdx) return;
    _lastNextIdx = nextIdx;

    // ✅ 整字完成
    if (nextIdx >= total) {
      clearTimers();
      finishWholeChar();
      return;
    }

    // ✅ 推进颜色
    redrawStrokeColor({ activeIndex: nextIdx, finished: false });

    // ✅ 示范下一笔并解锁
    demoNextAndUnlock(nextIdx);
  }

  // wrong 震动（可选）
  function vibrateWrong() {
    try { navigator.vibrate?.([60, 40, 60]); } catch {}
  }
  traceCanvas?.addEventListener?.("trace:wrong", vibrateWrong);

  // =========================
  // Public API
  // =========================
  function start() {
    teachingOn = true;
    demoLock = false;

    clearTimers();
    _lastNextIdx = -1;

    // 从第一笔开始
    try { traceApi?.setStrokeIndex?.(0); } catch (e) {}

    redrawStrokeColor({ activeIndex: 0, finished: false });

    // 示范第一笔并解锁
    demoNextAndUnlock(0);
  }

  function stop() {
    teachingOn = false;
    demoLock = false;

    clearTimers();
    _lastNextIdx = -1;

    try { traceApi?.setEnabled?.(false); } catch (e) {}
    if (traceCanvas) traceCanvas.style.pointerEvents = "none";

    redrawStrokeColor({ finished: true });
  }

  return {
    start,
    stop,
    onUserStrokeDone,
  };
}
