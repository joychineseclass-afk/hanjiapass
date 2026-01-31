// /ui/modules/stroke/strokePlayer.canvas.js
// ✅ 完善不返工版（ES Module）
// - 负责：笔画编号层、笔画高亮进度（不涉及跟写判定）
// - 不挂 window，全用 export
// - 兼容 :scope 不支持的浏览器（fallback）

const NS = "http://www.w3.org/2000/svg";

function qsAll(root, sel) {
  try {
    return Array.from(root?.querySelectorAll?.(sel) || []);
  } catch {
    return [];
  }
}

function qs(root, sel) {
  try {
    return root?.querySelector?.(sel) || null;
  } catch {
    return null;
  }
}

function safeBBox(el) {
  try {
    return el.getBBox();
  } catch {
    return null;
  }
}

// ---- number layer ----
export function removeNumberLayer(svg) {
  if (!svg) return;
  qsAll(svg, ".trace-num-layer").forEach((g) => g.remove());
}

export function getOrCreateNumberLayer(svg) {
  if (!svg) return null;

  // :scope 兼容性：不支持时 fallback 到普通选择器
  let layer = null;
  layer = qs(svg, ":scope > .trace-num-layer") || qs(svg, ".trace-num-layer");

  if (!layer) {
    layer = document.createElementNS(NS, "g");
    layer.setAttribute("class", "trace-num-layer");
    layer.setAttribute("pointer-events", "none");
    svg.appendChild(layer);
  }
  return layer;
}

export function setNumberLayerVisible(svg, visible) {
  if (!svg) return;
  const layer = qs(svg, ".trace-num-layer");
  if (layer) layer.style.display = visible ? "block" : "none";
}

/**
 * addStrokeNumbers(svg, strokeEls, opts)
 * - defaultVisible: 默认是否显示编号
 * - dx/dy: 编号位置微调（适配不同 SVG）
 */
export function addStrokeNumbers(svg, strokeEls, opts = {}) {
  if (!svg) return;

  const { defaultVisible = false, dx = 0, dy = 0 } = opts;

  // 先清掉旧的，保证不叠加
  removeNumberLayer(svg);
  const layer = getOrCreateNumberLayer(svg);
  if (!layer) return;

  (strokeEls || []).forEach((p, i) => {
    const box = safeBBox(p);
    if (!box) return;

    const cx = box.x + box.width * 0.5 + dx;
    const cy = box.y + box.height * 0.5 + dy;

    const t = document.createElementNS(NS, "text");
    t.setAttribute("class", "trace-num");
    t.setAttribute("data-idx", String(i));
    t.setAttribute("x", String(cx));
    t.setAttribute("y", String(cy));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("pointer-events", "none");
    t.textContent = String(i + 1);

    layer.appendChild(t);
  });

  setNumberLayerVisible(svg, !!defaultVisible);
}

/**
 * resetTraceState({svg, strokeEls})
 * - 清除高亮/完成状态
 * - 隐藏编号层（默认）
 */
export function resetTraceState({ svg, strokeEls } = {}) {
  if (!svg) return;

  (strokeEls || []).forEach((el) => {
    el.classList.remove("trace-stroke-on", "trace-stroke-done");
    el.classList.add("trace-stroke-dim");
  });

  qsAll(svg, ".trace-num").forEach((t) => {
    t.classList.remove("trace-num-on", "trace-num-done");
  });

  setNumberLayerVisible(svg, false);
}

/**
 * setProgress({svg, strokeEls, doneCount})
 * - doneCount: 已完成笔数
 * - doneCount 之前 => done
 * - doneCount 位置 => on
 * - 之后 => dim
 */
export function setProgress({ svg, strokeEls, doneCount = 0 } = {}) {
  if (!svg) return;

  const strokes = strokeEls || [];
  const nums = qsAll(svg, ".trace-num");

  const n = Math.max(0, Number(doneCount) || 0);

  strokes.forEach((el, i) => {
    el.classList.remove("trace-stroke-dim", "trace-stroke-on", "trace-stroke-done");

    if (i < n) el.classList.add("trace-stroke-done");
    else if (i === n) el.classList.add("trace-stroke-on");
    else el.classList.add("trace-stroke-dim");
  });

  nums.forEach((t) => {
    const i = Number(t.getAttribute("data-idx") || "0");
    t.classList.remove("trace-num-on", "trace-num-done");

    if (i < n) t.classList.add("trace-num-done");
    else if (i === n) t.classList.add("trace-num-on");
  });
}
