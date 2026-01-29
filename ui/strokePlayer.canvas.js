// strokePlayer.canvas.js ✅完善不返工版
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function qsAll(root, sel) {
    try { return Array.from(root?.querySelectorAll?.(sel) || []); } catch { return []; }
  }

  function removeNumberLayer(svg) {
    if (!svg) return;
    qsAll(svg, ".trace-num-layer").forEach((g) => g.remove());
  }

  function getOrCreateNumberLayer(svg) {
    if (!svg) return null;
    let layer = svg.querySelector(":scope > .trace-num-layer");
    if (!layer) {
      layer = document.createElementNS(NS, "g");
      layer.setAttribute("class", "trace-num-layer");
      layer.setAttribute("pointer-events", "none");
      svg.appendChild(layer);
    }
    return layer;
  }

  function setNumberLayerVisible(svg, visible) {
    if (!svg) return;
    const layer = svg.querySelector(".trace-num-layer");
    if (layer) layer.style.display = visible ? "block" : "none";
  }

  function safeBBox(el) {
    try { return el.getBBox(); } catch { return null; }
  }

  function addStrokeNumbers(svg, strokeEls, opts = {}) {
    if (!svg) return;
    const {
      defaultVisible = false,
      dx = 0,
      dy = 0,
    } = opts;

    // 先清掉旧的，保证不叠加
    removeNumberLayer(svg);
    const layer = getOrCreateNumberLayer(svg);
    if (!layer) return;

    strokeEls.forEach((p, i) => {
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

  function resetTraceState({ svg, strokeEls } = {}) {
    if (!svg) return;

    (strokeEls || []).forEach((el) => {
      el.classList.remove("trace-stroke-on");
      el.classList.remove("trace-stroke-done");
      el.classList.add("trace-stroke-dim");
    });

    qsAll(svg, ".trace-num").forEach((t) => {
      t.classList.remove("trace-num-on");
      t.classList.remove("trace-num-done");
    });

    setNumberLayerVisible(svg, false);
  }

  // ✅ 当前笔高亮（写对第 n 笔后，n 之前算 done，n+1 变 on）
  function setProgress({ svg, strokeEls, doneCount = 0 } = {}) {
    if (!svg) return;
    const strokes = strokeEls || [];
    const nums = qsAll(svg, ".trace-num");

    strokes.forEach((el, i) => {
      el.classList.remove("trace-stroke-dim", "trace-stroke-on", "trace-stroke-done");
      if (i < doneCount) el.classList.add("trace-stroke-done");
      else if (i === doneCount) el.classList.add("trace-stroke-on");
      else el.classList.add("trace-stroke-dim");
    });

    nums.forEach((t) => {
      const i = Number(t.getAttribute("data-idx") || "0");
      t.classList.remove("trace-num-on", "trace-num-done");
      if (i < doneCount) t.classList.add("trace-num-done");
      else if (i === doneCount) t.classList.add("trace-num-on");
    });
  }

  window.StrokePlayerCanvas = {
    addStrokeNumbers,
    setNumberLayerVisible,
    resetTraceState,
    removeNumberLayer,
    setProgress,
  };
})();
