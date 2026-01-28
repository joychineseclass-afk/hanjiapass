(function () {
  // 这个模块只提供“重置状态/清理序号层”等辅助函数
  function removeNumberLayer(svg) {
    if (!svg) return;
    svg.querySelectorAll(".trace-num-layer").forEach((g) => g.remove());
  }

  function setNumberLayerVisible(svg, visible) {
    if (!svg) return;
    const layer = svg.querySelector(".trace-num-layer");
    if (layer) layer.style.display = visible ? "block" : "none";
  }

  function addStrokeNumbers(svg, strokeEls) {
    if (!svg) return;
    removeNumberLayer(svg);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "trace-num-layer");

    strokeEls.forEach((p, i) => {
      let box;
      try { box = p.getBBox(); } catch { box = null; }
      if (!box) return;

      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "trace-num");
      t.setAttribute("data-idx", String(i));
      t.setAttribute("x", String(box.x + box.width * 0.5));
      t.setAttribute("y", String(box.y + box.height * 0.5));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.textContent = String(i + 1);
      g.appendChild(t);
    });

    svg.appendChild(g);
    setNumberLayerVisible(svg, false); // 默认隐藏
  }

  function resetTraceState({ svg, strokeEls }) {
    if (!svg) return;

    strokeEls.forEach((el) => {
      el.classList.remove("trace-stroke-on");
      el.classList.add("trace-stroke-dim");
    });

    svg.querySelectorAll(".trace-num").forEach((t) => t.classList.remove("trace-num-on"));
  }

  window.StrokePlayerCanvas = {
    addStrokeNumbers,
    setNumberLayerVisible,
    resetTraceState,
    removeNumberLayer,
  };
})();
