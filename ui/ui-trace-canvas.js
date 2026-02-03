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
      isTracing() {
        return false;
      },
      getStrokeIndex() {
        return 0;
      },
      setStrokeIndex() {},
      setPenColor() {},
      setStyle() {},
      destroy() {}
    };
  }

  const ctx = canvas.getContext("2d");

  // =========================
  // ✅ 状态
  // =========================
  const state = {
    enabled: true, // ✅ 是否允许描红系统工作（教学模式示范时会临时关）
    tracing: false, // ✅ 描红开关（显示/隐藏 canvas）
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
  // ✅ 对外派发事件（给 player/teaching）
  // =========================
  function emit(name, detail) {
    try {
      canvas.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {
      // 兼容极少数环境
      canvas.dispatchEvent(new Event(name));
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

      // ✅ 关键：抬笔 → 通知外部“完成一笔”
      emit("trace:strokeend", {
        strokeIndexBefore: before,
        strokeIndexAfter: state.strokeIndex
      });
    }

    state.hasInk = false;
  }

  function onPointerCancel(e) {
    endDrawing(e);
    state.hasInk = false;
  }

  function onResize() {
    // 重新计算 DPI/尺寸，但不清空内容（保持用户写的）
    // ⚠️ resize 会清空内容，所以这里尝试保存再恢复
    if (!state.tracing) return;

    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resize();
      try {
        ctx.putImageData(img, 0, 0);
      } catch {}
    } catch {
      // 如果 getImageData 因跨域/安全失败，就至少 resize 不崩
      resize();
    }
  }

  // =========================
  // ✅ 初次初始化
  // =========================
  resize();

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

      canvas.classList.toggle("hidden", !state.tracing);

      if (state.tracing) {
        resize();
      } else {
        // 关闭时停止 drawing
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }
      return state.tracing;
    },

    // ✅ 教学模式需要：临时禁用/启用描红输入
    setEnabled(on) {
      state.enabled = !!on;
      if (!state.enabled) {
        state.drawing = false;
        state.pointerId = null;
        state.hasInk = false;
      }
    },

    // ✅ 给 teaching / UI 判定
    isTracing() {
      return !!state.tracing;
    },

    // ✅ 清空
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.hasInk = false;
    },

    // ✅ 给 teaching 用：当前第几笔
    getStrokeIndex() {
      return state.strokeIndex || 0;
    },
    setStrokeIndex(i) {
      const n = Number(i);
      state.strokeIndex = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    },

    // ✅ 新增：设置学生书写颜色（你要“学生写=橘色”就在 teaching/start 时设）
    setPenColor(color) {
      if (!color) return;
      state.penColor = String(color);
      // 立即生效
      ctx.strokeStyle = state.penColor;
    },

    // ✅ 扩展：设置线宽/透明度
    setStyle({ width, opacity } = {}) {
      if (Number.isFinite(width)) ctx.lineWidth = Number(width);
      if (Number.isFinite(opacity)) ctx.globalAlpha = Number(opacity);
    },

    // ✅ 页面卸载时用（路由切页）
    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("resize", onResize);
    }
  };

  return api;
}
