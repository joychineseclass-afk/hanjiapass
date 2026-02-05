// ui/ui-trace-canvas.js
// ✅ Trace Canvas Layer (stable)
// - supports pointer events (mouse/touch/pen)
// - supports toggle(show/hide), enable/disable
// - emits: "trace:strokeend" + legacy "strokeComplete"/"complete"
// - provides API: setPenColor, setPenWidth, setStyle, clear, destroy
// - fixes: no undefined variables (e.g. autoAdvanceIndex), safe null canvas

export function initTraceCanvasLayer(canvas, opts = {}) {
  // =========================
  // ✅ 防御：传 null 不报错
  // =========================
  if (!canvas) {
    return {
      toggle() {},
      clear() {},
      setEnabled() {},
      enable() {},
      disable() {},
      setDrawingEnabled() {},
      isEnabled() {
        return false;
      },
      isTracing() {
        return false;
      },
      getStrokeIndex() {
        return 0;
      },
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
      try {
        fn(payload);
      } catch (e) {
        console.warn("[trace] handler error", name, e);
      }
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
    enabled: initEnabled, // ✅ 是否允许绘制
    tracing: initTracing, // ✅ 是否显示/接收事件
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

  // 当前可变样式（允许后面 setPenWidth / setStyle 调整）
  let currentLineWidth = baseLineWidth;
  let currentAlpha = baseAlpha;

  function applyCtxStyle() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = currentLineWidth;
    ctx.globalAlpha = currentAlpha;
    ctx.strokeStyle = state.penColor;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (!r.width || !r.height) return;

    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);

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
      try {
        canvas.dispatchEvent(new Event(name));
      } catch {}
    }
  }

  // =========================
  // ✅ 事件处理
  // =========================
  function onPointerDown(e) {
    // 必须：开启 tracing + enabled 才允许画
    if (!state.tracing || !state.enabled) return;

    // 多指不画（避免 pinch）
    if (state.pointerId !== null) return;

    state.pointerId = e.pointerId;

    try {
      canvas.setPointerCapture?.(e.pointerId);
    } catch {}

    state.drawing = true;
    state.hasInk = false;

    const p = pos(e);
    state.lastX = p.x;
    state.lastY = p.y;

    e.preventDefault?.();
  }

  function onPointerMove(e) {
    if (!state.tracing || !state.enabled) return;
    if (!state.drawing) return;
    if (state.pointerId !== e.pointerId) return;

    const p = pos(e);

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

    if (wasDrawing && hadInk && state.tracing && state.enabled) {
      const before = state.strokeIndex;

      if (shouldAutoAdvanceIndex) {
        state.strokeIndex += 1;
      }

      // ✅ 主事件：你在 player 里监听的就是这个
      emit("trace:strokeend", {
        strokeIndexBefore: before,
        strokeIndexAfter: state.strokeIndex
      });

      // ✅ 兼容 teaching.js 常见写法（保留）
      emit("strokeComplete", { index: before, nextIndex: state.strokeIndex });
      emit("complete", { index: before, nextIndex: state.strokeIndex });
    }

    state.hasInk = false;
    e.preventDefault?.();
  }

  function onPointerCancel(e) {
    endDrawing(e);
    state.hasInk = false;
    e.preventDefault?.();
  }

  // ✅ 兜底：避免 capture 丢失导致一直 drawing=true
  function onPointerLeave(e) {
    if (!state.drawing) return;
    endDrawing(e);
    state.hasInk = false;
  }

  function onLostPointerCapture(e) {
    if (!state.drawing) return;
    endDrawing(e);
    state.hasInk = false;
  }

  function onResize() {
    if (!state.tracing) return;

    // ✅ 尽量保留已画内容
    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resize();
      try {
        ctx.putImageData(img, 0, 0);
      } catch {}
    } catch {
      resize();
    }
  }

  // =========================
  // ✅ 初次初始化
  // =========================
  resize();

  // 移动端关键：不让页面滚动/缩放手势抢事件
  canvas.style.touchAction = "none";

  // 确保层级在上面（你也可以通过 opts.zIndex 调整）
  canvas.style.zIndex = String(opts.zIndex ?? 50);

  // 绑定事件：move/up/cancel 必须 passive:false 才能 preventDefault 生效
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
    // ✅ 显示/隐藏（只管 tracing）
    toggle(force) {
      if (typeof force === "boolean") state.tracing = force;
      else state.tracing = !state.tracing;

      canvas.classList.toggle("hidden", !state.tracing);

      // ✅ 同步 pointerEvents：可见才接收；不可见就别挡住底下按钮/层
      canvas.style.pointerEvents = state.tracing ? "auto" : "none";

      if (state.tracing) {
        resize();
      } else {
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }

      emit("trace:toggle", { tracing: state.tracing });
      return state.tracing;
    },

    // ✅ 是否允许描红输入（和 player/teaching 对齐）
    setEnabled(on) {
      state.enabled = !!on;

      // 如果关闭，直接中止绘制状态
      if (!state.enabled) {
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }

      emit("trace:enabled", { enabled: state.enabled });
    },

    enable() {
      api.setEnabled(true);
    },
    disable() {
      api.setEnabled(false);
    },
    setDrawingEnabled(on) {
      api.setEnabled(!!on);
    },

    isEnabled() {
      return !!state.enabled;
    },
    isTracing() {
      return !!state.tracing;
    },

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

    // ✅ 你在 player 里用到的：practiceApi.setPenWidth(...)
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

    on(name, fn) {
      return on(name, fn);
    },
    off(name, fn) {
      return off(name, fn);
    },

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

  // ✅ 初始化同步 pointerEvents
  canvas.style.pointerEvents = state.tracing ? "auto" : "none";

  return api;
}
