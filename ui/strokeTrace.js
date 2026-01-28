// ui/strokeTrace.js
(function () {

  function initTraceMode({ viewport, svg, getColor, getSize }) {
    if (!viewport || !svg) return null;

    // ===== 建立 Canvas 图层 =====
    let canvas = document.createElement("canvas");
    canvas.id = "traceCanvas";
    canvas.className = "absolute inset-0";
    canvas.style.pointerEvents = "none";
    viewport.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    function resize() {
      const r = viewport.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
    }
    resize();
    window.addEventListener("resize", resize);

    // ===== 收集每一笔 SVG path =====
    const strokePaths = Array.from(
      svg.querySelectorAll("path")
    ).filter(p => p.getTotalLength);

    let enabled = false;
    let strokeIndex = 0;
    let drawing = false;
    let currentPoints = [];
    const userStrokes = [];

    function clearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function drawStroke(points, color, size) {
      if (!points.length) return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }

    function toCanvasPoint(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    async function demoStroke(i) {
      const p = strokePaths[i];
      if (!p) return;

      const len = p.getTotalLength();
      p.style.stroke = "#94a3b8";
      p.style.strokeWidth = "10";
      p.style.fill = "none";
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.style.transition = "stroke-dashoffset 900ms linear";

      p.getBoundingClientRect();
      p.style.strokeDashoffset = "0";

      await new Promise(r => setTimeout(r, 950));
      p.style.transition = "";
    }

    function markDone(i, color) {
      const p = strokePaths[i];
      if (!p) return;
      p.style.stroke = color;
      p.style.strokeDasharray = "";
      p.style.strokeDashoffset = "";
    }

    async function nextStroke() {
      if (!enabled || strokeIndex >= strokePaths.length) return;
      await demoStroke(strokeIndex);
    }

    // ===== Pointer 书写 =====
    canvas.addEventListener("pointerdown", (e) => {
      if (!enabled) return;
      drawing = true;
      currentPoints = [toCanvasPoint(e)];
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!enabled || !drawing) return;
      currentPoints.push(toCanvasPoint(e));

      clearCanvas();
      userStrokes.slice(0, strokeIndex).forEach(s => drawStroke(s.points, s.color, s.size));
      drawStroke(currentPoints, getColor(), getSize());
    });

    canvas.addEventListener("pointerup", async () => {
      if (!enabled || !drawing) return;
      drawing = false;

      userStrokes[strokeIndex] = {
        points: currentPoints,
        color: getColor(),
        size: getSize(),
      };

      markDone(strokeIndex, getColor());
      strokeIndex++;

      if (strokeIndex < strokePaths.length) await nextStroke();
    });

    function setEnabled(on) {
      enabled = on;
      canvas.style.pointerEvents = on ? "auto" : "none";
      if (on) {
        strokeIndex = 0;
        clearCanvas();
        strokePaths.forEach(p => {
          p.style.stroke = "#cbd5e1";
          p.style.strokeWidth = "10";
          p.style.fill = "none";
        });
        nextStroke();
      }
    }

    function clearCurrent() {
      clearCanvas();
      userStrokes.length = 0;
      strokeIndex = 0;
    }

    return { setEnabled, clearCurrent };
  }

  window.StrokeTrace = { initTraceMode };

})();
