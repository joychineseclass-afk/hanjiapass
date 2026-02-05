// ui/ui-trace-canvas.js
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
      try { fn(payload); } catch (e) { console.warn("[trace] handler error", name, e); }
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
    enabled: initEnabled,
    tracing: initTracing,
    drawing: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,

    strokeIndex: 0,

    penColor: String(opts.penColor || "#FB923C"),
    penWidth: Number(opts.lineWidth ?? 6),
    alpha: Number(opts.alpha ?? 0.85),

    hasInk: false
  };

  // ✅ 是否自动推进笔画索引（自由画布要关掉）
  const AUTO_ADVANCE = opts.autoAdvanceIndex !== false; // default true

  function applyCtxStyle() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = state.penWidth;
    ctx.globalAlpha = state.alpha;
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
      try { canvas.dispatchEvent(new Event(name)); } catch {}
    }
  }

  // =========================
  // ✅ 事件处理
  // =========================
  function onPointerDown(e) {
    if (!state.enabled || !state.tracing) return;
    if (state.pointerId !== null) return;

    state.pointerId = e.pointerId;
    try { canvas.setPointerCapture?.(e.pointerId); } catch {}

    state.drawing = true;
    state.hasInk = false;

    const p = pos(e);
    state.lastX = p.x;
    state.lastY = p.y;

    e.preventDefault?.();
  }

  function onPointerMove(e) {
    if (!state.enabled || !state.tracing) return;
    if (!state.drawing) return;
    if (state.pointerId !== e.pointerId) return;

    const p = pos(e);

    if (p.x !== state.lastX || p.y !== state.lastY) {
      ctx.strokeStyle = state.penColor;
      ctx.lineWidth = state.penWidth;
      ctx.globalAlpha = state.alpha;
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
      if (AUTO_ADVANCE) state.strokeIndex += 1;

      emit("trace:strokeend", {
        strokeIndexBefore: before,
        strokeIndexAfter: state.strokeIndex
      });

      // 兼容旧事件名
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
  resize();
  canvas.style.touchAction = "none";
  canvas.style.zIndex = String(opts.zIndex ?? 50);

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerCancel, { passive: false });
  canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
  canvas.addEventListener("lostpointercapture", onLostPointerCapture, { passive: true });
  window.addEventListener("resize", onResize);

  const api = {
    toggle(force) {
      if (typeof force === "boolean") state.tracing = force;
      else state.tracing = !state.tracing;

      canvas.classList.toggle("hidden", !state.tracing);
      canvas.style.pointerEvents = state.tracing ? "auto" : "none";

      if (state.tracing) resize();
      else {
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }

      emit("trace:toggle", { tracing: state.tracing });
      return state.tracing;
    },

    setEnabled(on) {
      state.enabled = !!on;

      if (!canvas.classList.contains("hidden")) {
        state.tracing = true;
        canvas.style.pointerEvents = "auto";
      }

      if (!state.enabled) {
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }

      emit("trace:enabled", { enabled: state.enabled });
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

    getStrokeIndex() { return state.strokeIndex || 0; },
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

    setPenWidth(w) {
      const n = Number(w);
      if (!Number.isFinite(n)) return;
      state.penWidth = Math.max(1, Math.min(60, n));
      ctx.lineWidth = state.penWidth;
      emit("trace:width", { width: state.penWidth });
    },

    setStyle({ width, opacity } = {}) {
      if (Number.isFinite(width)) api.setPenWidth(width);
      if (Number.isFinite(opacity)) {
        state.alpha = Number(opacity);
        ctx.globalAlpha = state.alpha;
      }
      emit("trace:style", { width: state.penWidth, opacity: state.alpha });
    },

    on(name, fn) { return on(name, fn); },
    off(name, fn) { return off(name, fn); },

    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("lostpointercapture", onLostPointerCapture);
      window.removeEventListener("resize", onResize);
      bus.clear();
    }
  };

  canvas.style.pointerEvents = state.tracing ? "auto" : "none";
  if (!state.enabled) {
    state.drawing = false;
    state.pointerId = null;
    state.hasInk = false;
  }

  return api;
}
