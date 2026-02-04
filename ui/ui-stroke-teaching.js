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

    // ✅ 解锁：允许学生继续写
  function unlockInputAfterDemo() {
    demoLock = false;
    if (!teachingOn) return;

    // ✅ 恢复可点可写（traceApi 内部 enabled=true 才会允许 onPointerDown）
    try {
      traceApi?.setEnabled?.(true);
    } catch (e) {
      console.warn("[TEACH] setEnabled(true) failed", e);
    }

    // ✅ DOM 层兜底：必须能接收 pointer
    if (traceCanvas) traceCanvas.style.pointerEvents = "auto";
  }

  // ✅ 上锁：示范期间不允许写
  function lockInputForDemo() {
    demoLock = true;

    try {
      traceApi?.setEnabled?.(false);
    } catch (e) {
      console.warn("[TEACH] setEnabled(false) failed", e);
    }

    if (traceCanvas) traceCanvas.style.pointerEvents = "none";
  }

  // ✅ 示范下一笔 + 强制解锁（不依赖 animationend，避免卡死）
  function demoNextAndUnlock(nextIdx) {
    if (!teachingOn) return;

    // 1) 先锁，避免示范时学生乱写
    lockInputForDemo();

    // 2) 示范：只负责“播放视觉动画 + 更新颜色”
    //    ⚠️ 不再依赖返回的 el / animationend
    try {
      playDemoStrokeAt(nextIdx);
    } catch (e) {
      console.warn("[TEACH] playDemoStrokeAt failed", e);
    }

    // 3) ⭐⭐⭐ 关键：固定时间后强制解锁
    //    这个值不用太大，保证“看得到示范一下”，然后就能写
    clearTimeout(demoNextAndUnlock._t);
    demoNextAndUnlock._t = setTimeout(() => {
       
  // =========================
  // ✅ 保险：去重/防抖/防死锁
  // =========================
  let _lastNextIdx = -1;        // 上一次已处理的“下一笔 idx”
  let _unlockTimer = null;      // 解锁定时器
  let _forceUnlockTimer = null; // 最终兜底（避免任何情况下卡死）

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

  // ✅ 解锁：允许学生继续写
  function unlockInputAfterDemo() {
    demoLock = false;
    if (!teachingOn) return;

    try {
      traceApi?.setEnabled?.(true);
    } catch (e) {
      console.warn("[TEACH] setEnabled(true) failed", e);
    }

    if (traceCanvas) traceCanvas.style.pointerEvents = "auto";
  }

  // ✅ 上锁：示范期间不允许写
  function lockInputForDemo() {
    demoLock = true;

    try {
      traceApi?.setEnabled?.(false);
    } catch (e) {
      console.warn("[TEACH] setEnabled(false) failed", e);
    }

    if (traceCanvas) traceCanvas.style.pointerEvents = "none";
  }

  // ✅ 示范下一笔 + 解锁（不依赖 animationend，避免卡死）
  function demoNextAndUnlock(nextIdx) {
    if (!teachingOn) return;

    // 每次进来都清理旧 timer，避免“叠加导致双示范/锁不释放”
    clearTimers();

    lockInputForDemo();

    try {
      playDemoStrokeAt(nextIdx);
    } catch (e) {
      console.warn("[TEACH] playDemoStrokeAt failed", e);
    }

    // ✅ 常规解锁：给示范一点时间
    _unlockTimer = setTimeout(() => {
      unlockInputAfterDemo();
    }, 450);

    // ✅ 最终兜底：不管发生什么，1.2s 后强制解锁（防卡死）
    _forceUnlockTimer = setTimeout(() => {
      if (teachingOn) unlockInputAfterDemo();
    }, 1200);
  }

  function onUserStrokeDone(detail) {
    if (!teachingOn) return;
    if (demoLock) return;

    glowOnce();

    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    const total = strokes.length || 0;
    if (!total) return;

    // ✅ 用事件 detail 优先（最稳定），没有才读 traceApi
    // traceApi 是 autoAdvanceIndex++，所以这里拿到的是“下一笔 idx”
    const nextIdx =
      Number(detail?.strokeIndexAfter ?? traceApi?.getStrokeIndex?.() ?? 0) || 0;

    // =========================
    // ✅ 关键1：去重（解决“双示范”）
    // - 同一个 nextIdx 不重复处理
    // =========================
    if (nextIdx === _lastNextIdx) return;
    _lastNextIdx = nextIdx;

    // ✅ 整字完成
    if (nextIdx >= total) {
      clearTimers();
      finishWholeChar();
      return;
    }

    // ✅ 推进颜色（当前 nextIdx 为“正在写/下一笔”）
    redrawStrokeColor({ activeIndex: nextIdx, finished: false });

    // ✅ 示范 nextIdx 这一笔，然后解锁继续写
    demoNextAndUnlock(nextIdx);
  }

  function vibrateWrong() {
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {}
  }

  traceCanvas?.addEventListener?.("trace:wrong", vibrateWrong);

  function start() {
    teachingOn = true;
    demoLock = false;

    clearTimers();
    _lastNextIdx = -1;

    // ✅ 从第一笔开始
    try {
      traceApi?.setStrokeIndex?.(0);
    } catch {}

    redrawStrokeColor({ activeIndex: 0, finished: false });

    // ✅ 示范第一笔并解锁
    demoNextAndUnlock(0);
  }

  function stop() {
    teachingOn = false;
    demoLock = false;

    clearTimers();
    _lastNextIdx = -1;

    try {
      traceApi?.setEnabled?.(false);
    } catch {}

    if (traceCanvas) traceCanvas.style.pointerEvents = "none";

    redrawStrokeColor({ finished: true });
  }

  return {
    start,
    stop,
    onUserStrokeDone
  };
}
