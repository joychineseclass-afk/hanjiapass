// /ui/modules/stroke/strokeTrace.js
// ✅ 完善不返工版（ES Module）
// - 无提示/不闪红绿块
// - 支持回调：onStrokeCorrect / onAllComplete
// - 支持重复练习：reset() / clearCurrent()
// - 支持 3 类“目标笔画”选择：
//   1) path[fill="lightgray"]（旧数据）
//   2) path[id^="make-me-a-hanzi-animation-"]（MakeMeAHanzi 动画笔）
//   3) path[id^="make-me-a-hanzi-stroke-"]（MakeMeAHanzi 静态笔）
//   4) 兜底：所有 path
// - 兼容你的 23458.svg / MakeMeAHanzi 类 SVG
// - 判定：bbox overlap + length + (start/end near bbox) 轻量增强

function safeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function polylineLength(arr) {
  let L = 0;
  for (let i = 1; i < arr.length; i++) L += dist(arr[i - 1], arr[i]);
  return L;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// 把 SVG bbox 转成 viewport 内的 client bbox（近似）
function svgBBoxToClientBBox(pathEl) {
  try {
    const bb = pathEl.getBBox();
    const m = pathEl.getScreenCTM?.();
    if (!m) return null;

    const pts4 = [
      { x: bb.x, y: bb.y },
      { x: bb.x + bb.width, y: bb.y },
      { x: bb.x, y: bb.y + bb.height },
      { x: bb.x + bb.width, y: bb.y + bb.height },
    ].map((p) => ({
      x: p.x * m.a + p.y * m.c + m.e,
      y: p.x * m.b + p.y * m.d + m.f,
    }));

    const xs = pts4.map((p) => p.x);
    const ys = pts4.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return { minX, minY, maxX, maxY, width, height };
  } catch {
    return null;
  }
}

function pointNearBBox(p, bb, pad) {
  if (!p || !bb) return false;
  const xOK = p.x >= bb.minX - pad && p.x <= bb.maxX + pad;
  const yOK = p.y >= bb.minY - pad && p.y <= bb.maxY + pad;
  return xOK && yOK;
}

/**
 * ✅ initTraceMode(options)
 * options:
 * - viewport: relative container（用于叠 canvas）
 * - svg: 当前字的 svg 根节点
 * - getColor(): string
 * - getSize(): number
 * - onStrokeCorrect({index,total})
 * - onAllComplete({total})
 */
export function initTraceMode({
  viewport,
  svg,
  getColor,
  getSize,
  onStrokeCorrect,
  onAllComplete,
} = {}) {
  if (!viewport || !svg) return null;

  /** =========================
   * Canvas overlay
   ========================= */
  const canvas = document.createElement("canvas");
  canvas.className = "absolute inset-0 w-full h-full pointer-events-none";
  canvas.style.touchAction = "none";
  viewport.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  let enabled = false;
  let drawing = false;
  let pointerId = null;

  let strokeIndex = 0;
  let last = null; // client coords
  let pts = []; // client coords

  // Resize
  const ro = new ResizeObserver(() => resize());
  ro.observe(viewport);

  function resize() {
    const r = viewport.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  /** =========================
   * outlines / targets
   ========================= */
  function pickOutlines() {
    // 1) 旧数据：fill=lightgray
    const a = Array.from(svg.querySelectorAll('path[fill="lightgray"]'));
    if (a.length) return { outlines: a, mode: "fill" };

    // 2) MakeMeAHanzi：动画 path（常见）
    const b = Array.from(svg.querySelectorAll('path[id^="make-me-a-hanzi-animation-"]'));
    if (b.length) return { outlines: b, mode: "stroke" };

    // 3) MakeMeAHanzi：静态 stroke path（有些导出是 stroke-）
    const c = Array.from(svg.querySelectorAll('path[id^="make-me-a-hanzi-stroke-"]'));
    if (c.length) return { outlines: c, mode: "stroke" };

    // 4) 兜底：全部 path（最后手段）
    const d = Array.from(svg.querySelectorAll("path"));
    return { outlines: d, mode: "stroke" };
  }

  let outlines = [];
  let mode = "stroke";

  function refreshOutlines() {
    const picked = pickOutlines();
    outlines = picked.outlines || [];
    mode = picked.mode || "stroke";
    paintGuide();
  }

  // 描红底色（不做绿/红提示，仅“浅灰底”保持一致）
  function paintGuide() {
    if (!outlines.length) return;

    outlines.forEach((p, i) => {
      if (mode === "fill") {
        // fill 模式（旧数据）
        if (i < strokeIndex) p.setAttribute("fill", "rgba(0,0,0,0.18)");
        else if (i === strokeIndex) p.setAttribute("fill", "rgba(0,0,0,0.18)");
        else p.setAttribute("fill", "lightgray");
      } else {
        // stroke 模式（MakeMeAHanzi）
        p.style.stroke = "rgba(0,0,0,0.18)";
        p.style.fill = "rgba(0,0,0,0.18)";
        p.style.opacity = "1";
      }
    });
  }

  refreshOutlines();

  /** =========================
   * API
   ========================= */
  function clearCurrent() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pts = [];
    last = null;
  }

  function reset() {
    strokeIndex = 0;
    clearCurrent();
    refreshOutlines(); // 切字时 svg 变了，必须重抓 outlines
  }

  function setEnabled(v) {
    enabled = !!v;
    canvas.style.pointerEvents = enabled ? "auto" : "none";
    if (!enabled) {
      drawing = false;
      pointerId = null;
      last = null;
      pts = [];
    }
  }

  function getStrokeIndex() {
    return strokeIndex;
  }

  function getTotalStrokes() {
    return outlines.length;
  }

  function destroy() {
    ro.disconnect();
    canvas.remove();
  }

  /** =========================
   * Judge stroke OK (no flash)
   ========================= */
  function judgeStrokeOK() {
    if (!outlines.length) return true;
    const target = outlines[strokeIndex];
    if (!target) return true;

    const bb = svgBBoxToClientBBox(target);
    if (!bb) return true;

    // 不够点，不判通过
    if (pts.length < 2) return false;

    // user bbox
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);

    const u = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };

    const overlapX = Math.max(0, Math.min(bb.maxX, u.maxX) - Math.max(bb.minX, u.minX));
    const overlapY = Math.max(0, Math.min(bb.maxY, u.maxY) - Math.max(bb.minY, u.minY));
    const overlapArea = overlapX * overlapY;

    const bbArea = Math.max(1, bb.width * bb.height);
    const overlapRatio = overlapArea / bbArea;

    const L = polylineLength(pts);

    // 阈值：稳+不严格（防返工）
    const overlapOK = overlapRatio >= 0.18;

    // 长度：至少覆盖 bbox 的一部分
    const lenOK = L >= Math.max(bb.width, bb.height) * 0.32;

    // 起/止点落在 bbox 附近：轻增强（减少乱划误判）
    const pad = Math.max(bb.width, bb.height) * 0.18;
    const startOK = pointNearBBox(pts[0], bb, pad);
    const endOK = pointNearBBox(pts[pts.length - 1], bb, pad);

    // 要求 overlap + length 成立；start/end 至少一个成立（不太严）
    return overlapOK && lenOK && (startOK || endOK);
  }

  function advanceStroke() {
    if (!outlines.length) return;
    if (strokeIndex < outlines.length - 1) strokeIndex += 1;
    else strokeIndex = outlines.length; // done
  }

  /** =========================
   * Pointer events
   ========================= */
  function getXY(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function drawLine(a, b) {
    const color = (typeof getColor === "function" ? getColor() : "#ff3b30") || "#ff3b30";
    const size = clamp(safeNum(typeof getSize === "function" ? getSize() : 8, 8), 2, 40);

    const r = viewport.getBoundingClientRect();
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(a.x - r.left, a.y - r.top);
    ctx.lineTo(b.x - r.left, b.y - r.top);
    ctx.stroke();
    ctx.restore();
  }

  function onDown(e) {
    if (!enabled) return;

    // 이미 다른 포인터로 그리고 있으면 무시 (multi touch 방지)
    if (drawing && pointerId != null && e.pointerId !== pointerId) return;

    drawing = true;
    pointerId = e.pointerId;

    try {
      canvas.setPointerCapture?.(pointerId);
    } catch {}

    last = getXY(e);
    pts = [last];

    e.preventDefault();
  }

  function onMove(e) {
    if (!enabled || !drawing) return;
    if (pointerId != null && e.pointerId !== pointerId) return;

    const p = getXY(e);
    if (last) drawLine(last, p);
    last = p;
    pts.push(p);

    e.preventDefault();
  }

  function finishStrokeAttempt() {
    drawing = false;

    // 少点就直接重写（不提示）
    if (pts.length < 6) {
      pointerId = null;
      clearCurrent();
      return;
    }

    const ok = judgeStrokeOK(); // ✅ 修复：原来的 오케이 bug

    if (ok) {
      // 写对：回调（主控自己决定上色/动画/音效）
      try {
        onStrokeCorrect?.({
          index: strokeIndex,
          total: outlines.length,
        });
      } catch {}

      advanceStroke();
      pointerId = null;
      clearCurrent();

      if (strokeIndex >= outlines.length) {
        try { onAllComplete?.({ total: outlines.length }); } catch {}
      } else {
        paintGuide();
      }
    } else {
      // 写错：不前进，清掉重写（不提示）
      pointerId = null;
      clearCurrent();
      paintGuide();
    }
  }

  function onUp(e) {
    if (!enabled) return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    finishStrokeAttempt();
    e.preventDefault();
  }

  function onCancel(e) {
    if (!enabled) return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    drawing = false;
    pointerId = null;
    clearCurrent();
    paintGuide();
    e.preventDefault();
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);

  // 默认关闭，等主控打开（teachingMode/traceMode）
  setEnabled(false);

  return {
    setEnabled,
    clearCurrent,
    reset,
    destroy,
    getStrokeIndex,
    getTotalStrokes,
    refreshOutlines, // 可选：切字后手动刷新
  };
}
