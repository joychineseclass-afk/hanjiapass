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

  // ✅ 确保 glow CSS 只注入一次
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

  // ✅ 示范指定笔（核心：后续每一笔都要示范）
  function playDemoStrokeAt(index) {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return false;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return false;

    const i = Math.max(0, Math.min(Number(index ?? 0) || 0, strokes.length - 1));
    const s = strokes[i];
    if (!s) return false;

    // 当前笔浅蓝，其它灰，已完成橘
    redrawStrokeColor({ activeIndex: i, finished: false });

    // 触发该笔 CSS 动画（显示“路线/示范”）
    replayCssAnimation(s);
    return true;
  }

  function finishWholeChar() {
    redrawStrokeColor({ finished: true });

    // ✅ 完成：通知外层把最后一笔也变黑
    queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));

    // ✅ 完成：自动跳下一个字（page.stroke.js 会接住）
    queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:nextchar")));

    // ✅ 完成后关闭写入（下一字会重新 start）
    traceApi?.setEnabled?.(false);
  }

  // ✅ 每一笔完成后：示范下一笔 → 解锁 → 允许写
  function demoNextAndUnlock(nextIdx) {
    // 锁住用户输入
    demoLock = true;
    traceApi?.setEnabled?.(false);

    // 示范下一笔（如果失败就直接解锁）
    const ok = playDemoStrokeAt(nextIdx);

    // 300ms 后允许写（你想更慢就改 450/600）
    setTimeout(() => {
      demoLock = false;
      // teachingOn 还在才解锁，避免用户中途关掉
      if (teachingOn) traceApi?.setEnabled?.(true);
    }, ok ? 300 : 0);
  }

  function onUserStrokeDone() {
    if (!teachingOn) return;
    if (demoLock) return;

    glowOnce(); // ✅ 写完发光（先按完成一笔就奖励）

    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    const total = strokes.length || 0;
    if (!total) return;

    // ✅ traceApi 在 pointerup 已经 autoAdvanceIndex++，
    // 所以这里读到的是“下一笔 index”
    const idx = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;

    // ✅ 已经写完最后一笔
    if (idx >= total) {
      finishWholeChar();
      return;
    }

    // ✅ 推进颜色（当前 idx 变浅蓝）
    redrawStrokeColor({ activeIndex: idx, finished: false });

    // ✅ 🔥 关键：示范下一笔，然后解锁让用户写
    demoNextAndUnlock(idx);
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

  function start() {
    teachingOn = true;

    // ✅ 重置到第一笔
    traceApi?.setStrokeIndex?.(0);

    // ✅ 第一笔先示范，再允许写
    demoLock = true;
    traceApi?.setEnabled?.(false);

    // 示范第一笔
    playDemoStrokeAt(0);

    setTimeout(() => {
      demoLock = false;
      if (teachingOn) traceApi?.setEnabled?.(true);
    }, 300);
  }

  function stop() {
    teachingOn = false;
    demoLock = false;
    traceApi?.setEnabled?.(false);
    redrawStrokeColor({ finished: true });
  }

  return {
    start,
    stop,
    onUserStrokeDone
  };
}
