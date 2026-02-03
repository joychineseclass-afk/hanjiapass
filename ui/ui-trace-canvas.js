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
  // ⭐⭐⭐ 关键修复：默认 tracing 状态不要永远 false
  // - 如果 canvas 初始不是 hidden，则认为 tracing=true
  // - 如果你通过 opts.tracingDefault 明确指定，则以它为准
  const initTracing =
    typeof opts.tracingDefault === "boolean"
      ? opts.tracingDefault
      : !canvas.classList.contains("hidden");

  const state = {
    enabled: true, // ✅ 是否允许描红系统工作（教学模式示范时会临时关）
    tracing: initTracing, // ✅ 描红开关（显示/隐藏 canvas）
    drawing: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,

    // ✅ 给 teaching / UI 用：当前第几笔
    strokeIndex: 0,

    // ✅ 当前画笔颜色（默认橘色更符合你“学生写=橘色”）
    penColor: opts.penColor || "#FB923C",

    // ✅ 是否在一次 stroke 中真的画了线（避免轻触就算一笔）
    hasInk: false
  };

  // =========================
  // ✅ 可配置：线宽/透明度
  // =========================
  const lineWidth = Number(opts.lineWidth ?? 6);
  const alpha = Number(opts.alpha ?? 0.85);

  // 是否在抬笔时自动 strokeIndex++
  const autoAdvanceIndex = opts.autoAdvanceIndex !== false; // 默认 true

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

    // ⚠️ 注意：canvas resize 会清空内容，这是 canvas 特性
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

  // ✅ 封装：画线（未来易扩展）
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
    // 1) 先走 bus（更适合 JS 监听）
    fire(name, detail);

    // 2) 再走 DOM 事件（给你现有系统用）
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

    // 多指情况下不画（避免 pinch 误触）
    if (state.pointerId !== null) return;

    state.pointerId = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);

    state.drawing = true;
    state.hasInk = false;

    const p = pos(e);
    state.lastX = p.x;
    state.lastY = p.y;

    // 防止页面滚动
    e.preventDefault?.();
  }

  function onPointerMove(e) {
    if (!state.enabled || !state.tracing) return;
    if (!state.drawing) return;
    if (state.pointerId !== e.pointerId) return;

    const p = pos(e);

    // ✅ 只有移动形成线段才算真正写了
    if (p.x !== state.lastX || p.y !== state.lastY) {
      // 确保使用最新笔色（教学过程中可能会 setPenColor）
      ctx.strokeStyle = state.penColor;

      drawLine(state.lastX, state.lastY, p.x, p.y);
      state.hasInk = true;
    }

    state.lastX = p.x;
    state.lastY = p.y;
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

    // ✅ 只有“真的写了线”才算一笔完成
    if (wasDrawing && hadInk && state.tracing && state.enabled) {
      const before = state.strokeIndex;

      if (autoAdvanceIndex) state.strokeIndex += 1;

      // ✅ 你原本事件（保留不动）
      emit("trace:strokeend", {
        strokeIndexBefore: before,
        strokeIndexAfter: state.strokeIndex
      });

      // ✅ 兼容 teaching.js 常见写法：strokeComplete/complete
      // 这样 teaching.js 不需要改事件名也能收到
      emit("strokeComplete", { index: before, nextIndex: state.strokeIndex });
      emit("complete", { index: before, nextIndex: state.strokeIndex });
    }

    state.hasInk = false;
  }

  function onPointerCancel(e) {
    endDrawing(e);
    state.hasInk = false;
  }

  function onResize() {
    if (!state.tracing) return;

    // ⚠️ resize 会清空内容，所以这里尝试保存再恢复
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

  // ⭐⭐⭐ 很关键：防止触摸设备滚动抢事件
  // 不影响鼠标
  canvas.style.touchAction = "none";

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerup", onPointerUp, { passive: true });
  canvas.addEventListener("pointercancel", onPointerCancel, { passive: true });
  window.addEventListener("resize", onResize);

  // =========================
  // ✅ 对外 API（兼容 + 扩展）
  // =========================
  const api = {
    // ✅ 兼容：点击“描红”按钮 toggle 显示/隐藏
    toggle(force) {
      if (typeof force === "boolean") state.tracing = force;
      else state.tracing = !state.tracing;

      // 显隐
      canvas.classList.toggle("hidden", !state.tracing);

      // ✅ 同步 pointerEvents（避免“看得到但点不到/写不了”）
      canvas.style.pointerEvents = state.tracing ? "auto" : "none";

      if (state.tracing) {
        resize();
      } else {
        // 关闭时停止 drawing
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }

      // 方便调试
      emit("trace:toggle", { tracing: state.tracing });
      return state.tracing;
    },

    // ✅ 教学模式需要：临时禁用/启用描红输入
    setEnabled(on) {
      state.enabled = !!on;

      // ✅ enabled 打开时，如果 tracing 关着，会导致“启用了也不能写”
      // 这里不强行打开 tracing（避免破坏你其他页面逻辑），只做安全兜底：
      // 如果 canvas 当前可见(非 hidden)，那 tracing 至少应为 true
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

    // ✅ 兼容别名（很多地方会用）
    enable() {
      api.setEnabled(true);
    },
    disable() {
      api.setEnabled(false);
    },
    setDrawingEnabled(on) {
      api.setEnabled(!!on);
    },

    // ✅ 给调试/teaching 用：是否允许写
    isEnabled() {
      return !!state.enabled;
    },

    // ✅ 给 teaching / UI 判定
    isTracing() {
      return !!state.tracing;
    },

    // ✅ 清空
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.hasInk = false;
      emit("trace:clear", {});
    },

    // ✅ 给 teaching 用：当前第几笔
    getStrokeIndex() {
      return state.strokeIndex || 0;
    },
    setStrokeIndex(i) {
      const n = Number(i);
      state.strokeIndex = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      emit("trace:index", { strokeIndex: state.strokeIndex });
    },

    // ✅ 设置学生书写颜色
    setPenColor(color) {
      if (!color) return;
      state.penColor = String(color);
      ctx.strokeStyle = state.penColor;
      emit("trace:color", { color: state.penColor });
    },

    // ✅ 扩展：设置线宽/透明度
    setStyle({ width, opacity } = {}) {
      if (Number.isFinite(width)) ctx.lineWidth = Number(width);
      if (Number.isFinite(opacity)) ctx.globalAlpha = Number(opacity);
      emit("trace:style", { width: ctx.lineWidth, opacity: ctx.globalAlpha });
    },

    // ✅ 事件订阅（teaching.js 可以用 traceApi.on(...)）
    on(name, fn) {
      return on(name, fn);
    },
    off(name, fn) {
      return off(name, fn);
    },

    // ✅ 页面卸载时用（路由切页）
    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("resize", onResize);
      bus.clear();
    }
  };

  // ✅ 初始化时同步一次可交互状态（避免初始 pointerEvents 不对）
  canvas.style.pointerEvents = state.tracing ? "auto" : "none";

  return api;
}
