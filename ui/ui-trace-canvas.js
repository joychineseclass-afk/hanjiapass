// ui/ui-trace-canvas.js
// ✅ Trace Canvas Layer (stable+enhanced)
// - supports pointer events (mouse/touch/pen)
// - supports toggle(show/hide), setTracing(show/hide), enable/disable, setHitTest
// - emits: "trace:strokeend" + legacy "strokeComplete"/"complete"
// - provides API: setPenColor, setPenWidth, setStyle, clear, destroy
// - fixes: no undefined variables, safe null canvas, robust tracing/enabled/pointerEvents sync

export function initTraceCanvasLayer(canvas, opts = {}) {
  // =========================
  // ✅ 防御：传 null 不报错
  // =========================
  if (!canvas) {
    return {
      toggle() {},
      setTracing() {},
      setHitTest() {},
      clear() {},
      setEnabled() {},
      enable() {},
      disable() {},
      setDrawingEnabled() {},
      isEnabled() { return false; },
      isTracing() { return false; },
      getStrokeIndex() { return 0; },
      setStrokeIndex() {},
      setPenColor() {},
      setPenWidth() {},
      setStyle() {},
      on() {},
      off() {},
      destroy() {}
    };
  }

  const ctx = canvas.getContext("2d");
  const debug = !!opts.debug;

  // =========================
  // ✅ 事件总线（兼容 teaching.js / 其他模块）
  // =========================
  const bus = new Map(); // name -> Set<fn>

  function on(name, fn) {
    if (!name || typeof fn !== "function") return () => {};
    if (!bus.has(name)) bus.set(name, new Set());
    bus.get(name).add(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const set = bus.get(name);
    if (!set) return;
    set.delete(fn);
    if (!set.size) bus.delete(name);
  }

  function fire(name, payload) {
    const set = bus.get(name);
    if (!set) return;
    set.forEach((fn) => {
      try { fn(payload); }
      catch (e) { console.warn("[trace] handler error", name, e); }
    });
  }

  // =========================
  // ✅ 状态
  // =========================
  const initTracing =
    typeof opts.tracingDefault === "boolean"
      ? opts.tracingDefault
      : !canvas.classList.contains("hidden");

  const initEnabled =
    typeof opts.enabledDefault === "boolean" ? opts.enabledDefault : false;

  const state = {
    enabled: initEnabled,   // ✅ 是否允许绘制
    tracing: initTracing,   // ✅ 是否显示
    hitTest: initTracing,   // ✅ 是否吃事件（默认跟 tracing 同步）
    drawing: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,

    strokeIndex: 0,
    penColor: opts.penColor || "#FB923C",
    hasInk: false
  };

  // =========================
  // ✅ 可配置：线宽/透明度
  // =========================
  const baseLineWidth = Number.isFinite(Number(opts.lineWidth))
    ? Number(opts.lineWidth)
    : 6;

  const baseAlpha = Number.isFinite(Number(opts.alpha)) ? Number(opts.alpha) : 0.85;

  // ✅ 是否每次抬笔自动 +1（自由画布要关掉）
  const shouldAutoAdvanceIndex = opts.autoAdvanceIndex !== false; // 默认 true

  let currentLineWidth = baseLineWidth;
  let currentAlpha = baseAlpha;

  function applyCtxStyle() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = currentLineWidth;
    ctx.globalAlpha = currentAlpha;
    ctx.strokeStyle = state.penColor;
  }

  function syncVisibilityAndHitTest() {
    // tracing 控制显示
    canvas.classList.toggle("hidden", !state.tracing);
    // 保险：有些 CSS 会对 hidden 之外的 display 做覆盖，这里强行给 display
    canvas.style.display = state.tracing ? "block" : "none";

    // hitTest 控制 pointer-events（能显示但不挡按钮）
    canvas.style.pointerEvents = (state.tracing && state.hitTest) ? "auto" : "none";
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // 若还没布局（刚插入 DOM），延迟重试一次
    if (!r.width || !r.height) {
      queueMicrotask(() => {
        const rr = canvas.getBoundingClientRect();
        if (!rr.width || !rr.height) return;
        resize();
      });
      return;
    }

    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    // 坐标系归一到 CSS 像素
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    applyCtxStyle();
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // =========================
  // ✅ 对外派发事件（DOM + bus 双通道）
  // =========================
  function emit(name, detail) {
    fire(name, detail);
    try {
      canvas.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {
      try { canvas.dispatchEvent(new Event(name)); } catch {}
    }
  }

  // =========================
  // ✅ 事件处理
  // =========================
  function onPointerDown(e) {
    if (!state.tracing || !state.hitTest || !state.enabled) return;
    if (state.pointerId !== null) return; // 多指不画

    // 某些设备上 pointerdown 会出现 buttons=0 的怪情况，仍允许开始
    state.pointerId = e.pointerId;

    try { canvas.setPointerCapture?.(e.pointerId); } catch {}

    state.drawing = true;
    state.hasInk = false;

    const p = pos(e);
    state.lastX = p.x;
    state.lastY = p.y;

    if (debug) {
      console.log("[trace] down", {
        enabled: state.enabled,
        tracing: state.tracing,
        hitTest: state.hitTest,
        pointerId: e.pointerId
      });
    }

    e.preventDefault?.();
  }

  function onPointerMove(e) {
    if (!state.tracing || !state.hitTest || !state.enabled) return;
    if (!state.drawing) return;
    if (state.pointerId !== e.pointerId) return;

    const p = pos(e);

    // 兜底：如果系统认为没有按键了（buttons=0），当作结束
    if (typeof e.buttons === "number" && e.buttons === 0) {
      onPointerUp(e);
      return;
    }

    if (p.x !== state.lastX || p.y !== state.lastY) {
      // ✅ 每次 move 都确保当前样式生效
      ctx.strokeStyle = state.penColor;
      ctx.lineWidth = currentLineWidth;
      ctx.globalAlpha = currentAlpha;

      drawLine(state.lastX, state.lastY, p.x, p.y);
      state.hasInk = true;
    }

    state.lastX = p.x;
    state.lastY = p.y;

    e.preventDefault?.();
  }

  function endDrawing(e) {
    if (state.pointerId === e.pointerId) {
      state.drawing = false;
      state.pointerId = null;
    }
  }

  function onPointerUp(e) {
    const wasDrawing = state.drawing;
    const hadInk = state.hasInk;

    endDrawing(e);

    if (wasDrawing && hadInk && state.tracing && state.hitTest && state.enabled) {
      const before = state.strokeIndex;

      if (shouldAutoAdvanceIndex) {
        state.strokeIndex += 1;
      }

      emit("trace:strokeend", {
        strokeIndexBefore: before,
        strokeIndexAfter: state.strokeIndex
      });

      // ✅ legacy
      emit("strokeComplete", { index: before, nextIndex: state.strokeIndex });
      emit("complete", { index: before, nextIndex: state.strokeIndex });

      if (debug) {
        console.log("[trace] strokeend", { before, after: state.strokeIndex });
      }
    }

    state.hasInk = false;
    e.preventDefault?.();
  }

  function onPointerCancel(e) {
    endDrawing(e);
    state.hasInk = false;
    e.preventDefault?.();
  }

  function onPointerLeave() {
    if (!state.drawing) return;
    state.drawing = false;
    state.pointerId = null;
    state.hasInk = false;
  }

  function onLostPointerCapture() {
    if (!state.drawing) return;
    state.drawing = false;
    state.pointerId = null;
    state.hasInk = false;
  }

  function onResize() {
    if (!state.tracing) return;
    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resize();
      try { ctx.putImageData(img, 0, 0); } catch {}
    } catch {
      resize();
    }
  }

  // =========================
  // ✅ 初次初始化
  // =========================
  // 移动端关键：不让页面滚动/缩放手势抢事件
  canvas.style.touchAction = "none";
  // 层级
  canvas.style.zIndex = String(opts.zIndex ?? 50);

  // 同步可见/可点
  syncVisibilityAndHitTest();
  resize();

  // passive:false 才能 preventDefault 生效
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerCancel, { passive: false });
  canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
  canvas.addEventListener("lostpointercapture", onLostPointerCapture, { passive: true });
  window.addEventListener("resize", onResize);

  // =========================
  // ✅ 对外 API（兼容 + 扩展）
  // =========================
  const api = {
    // ✅ toggle = 只管 tracing（显示/隐藏），hitTest 默认跟随
    toggle(force) {
      if (typeof force === "boolean") state.tracing = force;
      else state.tracing = !state.tracing;

      // 默认：显示就能点，隐藏就不挡
      state.hitTest = state.tracing;

      syncVisibilityAndHitTest();

      if (state.tracing) {
        resize();
      } else {
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }

      emit("trace:toggle", { tracing: state.tracing, hitTest: state.hitTest });
      if (debug) console.log("[trace] toggle", state.tracing, "hitTest", state.hitTest);
      return state.tracing;
    },

    // ✅ 新增：只设置显示/隐藏，不改变 hitTest（更精细控制）
    setTracing(on) {
      state.tracing = !!on;
      syncVisibilityAndHitTest();
      if (state.tracing) resize();
      emit("trace:toggle", { tracing: state.tracing, hitTest: state.hitTest });
      if (debug) console.log("[trace] setTracing", state.tracing);
    },

    // ✅ 新增：是否吃事件（显示但不挡按钮/或显示且可写）
    setHitTest(on) {
      state.hitTest = !!on;
      syncVisibilityAndHitTest();
      emit("trace:hittest", { hitTest: state.hitTest });
      if (debug) console.log("[trace] setHitTest", state.hitTest);
    },

    // ✅ 是否允许描红输入（和 player/teaching 对齐）
    setEnabled(on) {
      state.enabled = !!on;

      if (!state.enabled) {
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }

      emit("trace:enabled", { enabled: state.enabled });
      if (debug) console.log("[trace] enabled", state.enabled);
    },

    enable() { api.setEnabled(true); },
    disable() { api.setEnabled(false); },
    setDrawingEnabled(on) { api.setEnabled(!!on); },

    isEnabled() { return !!state.enabled; },
    isTracing() { return !!state.tracing; },

    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.hasInk = false;
      emit("trace:clear", {});
    },

    getStrokeIndex() {
      return state.strokeIndex || 0;
    },

    setStrokeIndex(i) {
      const n = Number(i);
      state.strokeIndex = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      emit("trace:index", { strokeIndex: state.strokeIndex });
    },

    setPenColor(color) {
      if (!color) return;
      state.penColor = String(color);
      ctx.strokeStyle = state.penColor;
      emit("trace:color", { color: state.penColor });
    },

    setPenWidth(width) {
      const w = Number(width);
      if (!Number.isFinite(w)) return;
      currentLineWidth = Math.max(1, w);
      ctx.lineWidth = currentLineWidth;
      emit("trace:style", { width: currentLineWidth, opacity: currentAlpha });
    },

    setStyle({ width, opacity } = {}) {
      if (Number.isFinite(Number(width))) {
        currentLineWidth = Math.max(1, Number(width));
        ctx.lineWidth = currentLineWidth;
      }
      if (Number.isFinite(Number(opacity))) {
        currentAlpha = Math.max(0, Math.min(1, Number(opacity)));
        ctx.globalAlpha = currentAlpha;
      }
      emit("trace:style", { width: currentLineWidth, opacity: currentAlpha });
    },

    on(name, fn) { return on(name, fn); },
    off(name, fn) { return off(name, fn); },

    destroy() {
      try { canvas.removeEventListener("pointerdown", onPointerDown); } catch {}
      try { canvas.removeEventListener("pointermove", onPointerMove); } catch {}
      try { canvas.removeEventListener("pointerup", onPointerUp); } catch {}
      try { canvas.removeEventListener("pointercancel", onPointerCancel); } catch {}
      try { canvas.removeEventListener("pointerleave", onPointerLeave); } catch {}
      try { canvas.removeEventListener("lostpointercapture", onLostPointerCapture); } catch {}
      try { window.removeEventListener("resize", onResize); } catch {}
      bus.clear();
    }
  };

  return api;
}
