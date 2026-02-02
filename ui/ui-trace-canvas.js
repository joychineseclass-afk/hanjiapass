export function initTraceCanvasLayer(canvas, opts = {}) {
  if (!canvas) {
    // 防御：避免传 null 时报错
    return {
      toggle() {},
      clear() {},
      setEnabled() {},
      isTracing() { return false; },
      getStrokeIndex() { return 0; },
      setStrokeIndex() {},
      destroy() {}
    };
  }

  const ctx = canvas.getContext("2d");
  const state = {
    enabled: true,      // ✅ 是否允许描红系统工作（教学模式可临时关）
    tracing: false,     // ✅ 描红开关（显示/隐藏 canvas）
    drawing: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    strokeIndex: 0,     // ✅ 给 teaching 用的“当前第几笔”
  };

  // 可配置：线宽/透明度
  const lineWidth = Number(opts.lineWidth ?? 6);
  const alpha = Number(opts.alpha ?? 0.85);

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // 容器尺寸为 0 时不做
    if (!r.width || !r.height) return;

    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);

    // 坐标系归一到 CSS 像素
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = alpha;
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ✅ 画线函数（单独封装，便于未来加颜色/橡皮）
  function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // --------- 事件处理 ----------
  function onPointerDown(e) {
    // 必须：开启描红 + enabled 才允许画
    if (!state.enabled || !state.tracing) return;

    // 多指情况下不画（避免 pinch 误触）
    if (state.pointerId !== null) return;

    state.pointerId = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);

    state.drawing = true;
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
    drawLine(state.lastX, state.lastY, p.x, p.y);
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
    endDrawing(e);
  }

  function onPointerCancel(e) {
    endDrawing(e);
  }

  function onResize() {
    // 重新计算 DPI/尺寸，但不清空内容（保持用户写的）
    // 注意：resize 会重置画布内容（canvas 特性）
    // 所以这里策略：描红开启时才 resize，避免频繁重置
    if (state.tracing) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resize();
      // 恢复内容（有时尺寸变化大可能会变形，但比清空好）
      try { ctx.putImageData(img, 0, 0); } catch {}
    }
  }

  // 初次
  resize();

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerup", onPointerUp, { passive: true });
  canvas.addEventListener("pointercancel", onPointerCancel, { passive: true });
  window.addEventListener("resize", onResize);

  // --------- 对外 API（兼容 + 扩展） ----------
  const api = {
    // ✅ 兼容你原来的用法：点击“描红”按钮 toggle 显示/隐藏
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
      }
      return state.tracing;
    },

    // ✅ 教学模式需要：临时禁用/启用描红输入
    setEnabled(on) {
      state.enabled = !!on;
      if (!state.enabled) {
        state.drawing = false;
        state.pointerId = null;
      }
    },

    // ✅ 给 teaching 判定
    isTracing() {
      return !!state.tracing;
    },

    // ✅ 清空
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    // ✅ 给 teaching 用：当前第几笔（默认 0）
    getStrokeIndex() {
      return state.strokeIndex || 0;
    },
    setStrokeIndex(i) {
      const n = Number(i);
      state.strokeIndex = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    },

    // ✅ 如果你以后想把颜色/粗细做成设置面板，这里也好扩展
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
