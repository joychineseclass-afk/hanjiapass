// ui/modules/stroke/strokeTrace.js
// 职责：右侧练习区 —— trace canvas 绘制、color/width/clear、pointer/touch 逻辑
// 不负责：模板、demo 动画、主流程控制

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
 * initTraceMode(options)
 * options:
 * - viewport: relative container（用于叠 canvas）
 * - svg: 当前字的 svg 根节点
 * - getColor(): string
 * - getSize(): number
 * - onStrokeCorrect({index,total})
 * - onStrokeWrong({expectedIndex,total}) 笔顺错误时
 * - onAllComplete({total})
 */
export function initTraceMode({
  viewport,
  svg,
  getColor,
  getSize,
  onStrokeCorrect,
  onStrokeWrong,
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
    refreshOutlines();
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

  function judgeStrokeOK() {
    if (!outlines.length) return true;
    const target = outlines[strokeIndex];
    if (!target) return true;

    const bb = svgBBoxToClientBBox(target);
    if (!bb) return true;

    if (pts.length < 2) return false;

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

    const overlapOK = overlapRatio >= 0.18;
    const lenOK = L >= Math.max(bb.width, bb.height) * 0.32;

    const pad = Math.max(bb.width, bb.height) * 0.18;
    const startOK = pointNearBBox(pts[0], bb, pad);
    const endOK = pointNearBBox(pts[pts.length - 1], bb, pad);

    return overlapOK && lenOK && (startOK || endOK);
  }

  function advanceStroke() {
    if (!outlines.length) return;
    if (strokeIndex < outlines.length - 1) strokeIndex += 1;
    else strokeIndex = outlines.length;
  }

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

    if (pts.length < 6) {
      pointerId = null;
      clearCurrent();
      return;
    }

    const ok = judgeStrokeOK();

    if (ok) {
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
      try {
        onStrokeWrong?.({ expectedIndex: strokeIndex, total: outlines.length });
      } catch {}
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

  setEnabled(false);

  return {
    setEnabled,
    clearCurrent,
    reset,
    destroy,
    getStrokeIndex,
    getTotalStrokes,
    refreshOutlines,
  };
}
