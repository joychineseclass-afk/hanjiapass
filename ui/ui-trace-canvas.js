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
  // ⭐⭐⭐ tracing 初始状态由 DOM 决定（你已跑通：保留）
  const initTracing =
    typeof opts.tracingDefault === "boolean"
      ? opts.tracingDefault
      : !canvas.classList.contains("hidden");

  // ⭐⭐⭐ 和 ui-stroke-player.js 对齐：默认 enabled=false
  const initEnabled =
    typeof opts.enabledDefault === "boolean" ? opts.enabledDefault : false;

  const state = {
    enabled: initEnabled, // ✅ 是否允许描红系统工作（教学示范时会临时关）
    tracing: initTracing, // ✅ 描红开关（显示/隐藏 canvas）
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
  let lineWidth = Number(opts.lineWidth ?? 6);
  let alpha = Number(opts.alpha ?? 0.85);

function applyCtxStyle() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = alpha;
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
    // 必须：开启描红 + enabled 才允许画
    if (!state.enabled || !state.tracing) return;

    // 多指不画（避免 pinch）
    if (state.pointerId !== null) return;

    state.pointerId = e.pointerId;

    // ✅ 很关键：确保 capture 成功（有些浏览器需要 try）
    try {
      canvas.setPointerCapture?.(e.pointerId);
    } catch {}

    state.drawing = true;
    state.hasInk = false;

    const p = pos(e);
    state.lastX = p.x;
    state.lastY = p.y;

    // ✅ 防滚动/防拖拽
    e.preventDefault?.();
  }

  function onPointerMove(e) {
    if (!state.enabled || !state.tracing) return;
    if (!state.drawing) return;
    if (state.pointerId !== e.pointerId) return;

    const p = pos(e);

    if (p.x !== state.lastX || p.y !== state.lastY) {
      ctx.strokeStyle = state.penColor;
      drawLine(state.lastX, state.lastY, p.x, p.y);
      state.hasInk = true;
    }

    state.lastX = p.x;
    state.lastY = p.y;

    // ✅ 移动端/触控板上非常关键：阻止默认手势
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
      if (autoAdvanceIndex) state.strokeIndex += 1;

      // ✅ 你原本事件（保留）
      emit("trace:strokeend", {
        strokeIndexBefore: before,
        strokeIndexAfter: state.strokeIndex
      });

      // ✅ 兼容 teaching.js 常见写法（保留）
      emit("strokeComplete", { index: before, nextIndex: state.strokeIndex });
      emit("complete", { index: before, nextIndex: state.strokeIndex });
    }

    state.hasInk = false;

    // ✅ 防止浏览器把抬笔当点击/选中文本
    e.preventDefault?.();
  }

  function onPointerCancel(e) {
    endDrawing(e);
    state.hasInk = false;
    e.preventDefault?.();
  }

  // ✅ 兜底：按住拖出 canvas / capture 丢失，会导致一直 drawing=true
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

  // ⭐⭐⭐ 防滚动抢事件（移动端关键）
  canvas.style.touchAction = "none";

  // ✅ 最后一公里：确保描红层永远在最上面
  // （有些 SVG/容器会形成新 stacking context）
  canvas.style.zIndex = String(opts.zIndex ?? 50);

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });  // ✅ 改为 false
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });      // ✅ 改为 false
  canvas.addEventListener("pointercancel", onPointerCancel, { passive: false }); // ✅ 改为 false
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

      // ✅ 同步 pointerEvents：可见才接收；不可见就别挡住缩放拖拽
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

      // ✅ 如果 canvas 可见，确保 tracing=true（保留你原逻辑）
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

    setStyle({ width, opacity } = {}) {
  if (Number.isFinite(width)) lineWidth = Number(width);
  if (Number.isFinite(opacity)) alpha = Number(opacity);
  applyCtxStyle();
  emit("trace:style", { width: ctx.lineWidth, opacity: ctx.globalAlpha });
},

    on(name, fn) {
      return on(name, fn);
    },
    off(name, fn) {
      return off(name, fn);
    },

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

  // ✅ 初始化同步交互状态
  canvas.style.pointerEvents = state.tracing ? "auto" : "none";

  // ✅ 初始化 enabled=false 时不允许绘制（状态一致）
  if (!state.enabled) {
    state.drawing = false;
    state.pointerId = null;
    state.hasInk = false;
  }

  return api;
}
