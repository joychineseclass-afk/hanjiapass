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

  // ✅ glow CSS（只注入一次）
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

  // =========================
  // ✅ 核心：示范某一笔，并返回该笔元素（用于 animationend 解锁）
  // =========================
  function playDemoStrokeAt(index) {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return null;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return null;

    const i = Math.max(0, Math.min(Number(index ?? 0) || 0, strokes.length - 1));
    const s = strokes[i];
    if (!s) return null;

    redrawStrokeColor({ activeIndex: i, finished: false });
    replayCssAnimation(s);
    return s;
  }

  function finishWholeChar() {
    redrawStrokeColor({ finished: true });

    queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));
    queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:nextchar")));

    // ✅ 完成后禁写，等下一字 start 再开
    traceApi?.setEnabled?.(false);
    if (traceCanvas) traceCanvas.style.pointerEvents = "none";
  }

  // =========================
  // ✅ 最稳的“示范→解锁”流程：
  // - 示范时：禁写 + 禁 pointer（避免 pointer capture 卡死）
  // - 等 animationend 解锁（再加超时兜底）
  // =========================
  function lockInputForDemo() {
    demoLock = true;

    // ✅ 先关 pointerEvents，避免用户在示范期间点下去导致 capture 卡住
    if (traceCanvas) traceCanvas.style.pointerEvents = "none";

    // ✅ 再禁写（内部也会清掉 drawing/pointerId，安全）
    traceApi?.setEnabled?.(false);
  }

  function unlockInputAfterDemo() {
    demoLock = false;
    if (!teachingOn) return;

    // ✅ 恢复可点可写
    traceApi?.setEnabled?.(true);
    if (traceCanvas) traceCanvas.style.pointerEvents = "auto";
  }

  function demoNextAndUnlock(nextIdx) {
    lockInputForDemo();

    const el = playDemoStrokeAt(nextIdx);

    // ✅ 如果拿不到动画元素，就立刻解锁
    if (!el) {
      unlockInputAfterDemo();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        el.removeEventListener("animationend", finish);
      } catch {}
      unlockInputAfterDemo();
    };

    // ✅ 监听动画结束后解锁
    try {
      el.addEventListener("animationend", finish, { once: true });
    } catch {}

    // ✅ 兜底：如果 animationend 不触发，最多等 900ms
    setTimeout(finish, 900);
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

    // ✅ traceApi 在 pointerup 已 autoAdvanceIndex++，所以这里是“下一笔 index”
    const idx = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;

    if (idx >= total) {
      finishWholeChar();
      return;
    }

    // ✅ 推进颜色
    redrawStrokeColor({ activeIndex: idx, finished: false });

    // ✅ 示范下一笔 -> 解锁继续写
    demoNextAndUnlock(idx);
  }

  function vibrateWrong() {
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {}
  }

  traceCanvas?.addEventListener?.("trace:wrong", vibrateWrong);

  function start() {
    teachingOn = true;

    // ✅ 从第一笔开始
    traceApi?.setStrokeIndex?.(0);

    // ✅ 示范第一笔，然后解锁让写
    demoNextAndUnlock(0);
  }

  function stop() {
    teachingOn = false;
    demoLock = false;

    traceApi?.setEnabled?.(false);
    if (traceCanvas) traceCanvas.style.pointerEvents = "none";

    redrawStrokeColor({ finished: true });
  }

  return {
    start,
    stop,
    onUserStrokeDone
  };
}
