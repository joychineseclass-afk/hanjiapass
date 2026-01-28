// ui/strokeTrace.js
(function () {
  /**
   * StrokeTrace.initTraceMode({
   *   viewport: HTMLElement,  // 你 mountStrokeSwitcher 里的 #strokeViewport
   *   svg: SVGElement,        // stage 里插入后的 svg
   *   getColor: ()=> string,  // 返回当前笔颜色
   *   getSize: ()=> number,   // 返回当前笔粗细(px)
   * })
   *
   * 返回 api:
   *  - setEnabled(bool)
   *  - clearCurrent()
   *  - destroy()
   *  - getStrokeIndex()
   */
  function initTraceMode({ viewport, svg, getColor, getSize }) {
    if (!viewport || !svg) return null;

    // ====== canvas overlay ======
    const canvas = document.createElement("canvas");
    canvas.className =
      "absolute inset-0 w-full h-full pointer-events-none"; // 默认不吃事件
    canvas.style.touchAction = "none"; // 防止触屏滚动
    viewport.appendChild(canvas);

    const ctx = canvas.getContext("2d");

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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 用 CSS 像素画
    }
    resize();

    // ====== stroke outlines: 以 fill="lightgray" 的 path 当作“每一笔的目标区域” ======
    const outlines = Array.from(svg.querySelectorAll('path[fill="lightgray"]'));
    let strokeIndex = 0;

    function paintGuide() {
      // 当前笔浅黄，已完成绿，其他保持 lightgray
      outlines.forEach((p, i) => {
        if (i < strokeIndex) p.setAttribute("fill", "rgba(34,197,94,0.35)"); // green
        else if (i === strokeIndex) p.setAttribute("fill", "rgba(245,158,11,0.35)"); // amber
        else p.setAttribute("fill", "lightgray");
      });
    }
    if (outlines.length) paintGuide();

    // ====== drawing state ======
    let enabled = false;
    let drawing = false;
    let last = null;
    let pts = []; // client points

    function clearCurrent() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts = [];
      last = null;
    }

    function setEnabled(v) {
      enabled = !!v;
      canvas.style.pointerEvents = enabled ? "auto" : "none";
      if (!enabled) {
        drawing = false;
        last = null;
      }
    }

    function getStrokeIndex() {
      return strokeIndex;
    }

    // ====== helpers for judging ======
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

    // 把 SVG bbox 转成 viewport 内的 client bbox（近似）
    function svgBBoxToClientBBox(pathEl) {
      const bb = pathEl.getBBox();
      const m = pathEl.getScreenCTM();
      if (!m) return null;

      // bbox 四个角投影到屏幕
      const pts = [
        { x: bb.x, y: bb.y },
        { x: bb.x + bb.width, y: bb.y },
        { x: bb.x, y: bb.y + bb.height },
        { x: bb.x + bb.width, y: bb.y + bb.height },
      ].map((p) => ({
        x: p.x * m.a + p.y * m.c + m.e,
        y: p.x * m.b + p.y * m.d + m.f,
      }));

      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    // 简单判定：画的范围与目标 bbox 重合 + 线长足够
    function judgeStrokeOK() {
      if (!outlines.length) return true; // 没 outlines 就不判定，直接过
      const target = outlines[strokeIndex];
      if (!target) return true;

      const bb = svgBBoxToClientBBox(target);
      if (!bb) return true;

      // 用户轨迹 bbox
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

      const L = polylineLength(pts);

      // 阈值：重叠至少 20% + 线长至少 bbox 较大边的 35%
      const overlapOK = overlapArea / bbArea >= 0.2;
      const lengthOK = L >= Math.max(bb.width, bb.height) * 0.35;

      return overlapOK && lengthOK;
    }

    function flash(color) {
      // 在角落闪一下提示
      const r = viewport.getBoundingClientRect();
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, Math.min(90, r.width), 28);
      ctx.restore();
      setTimeout(() => {
        // 不清空笔迹，只清提示小块
        ctx.clearRect(0, 0, Math.min(110, r.width), 40);
      }, 180);
    }

    function advanceStroke() {
      if (!outlines.length) return;
      if (strokeIndex < outlines.length - 1) strokeIndex += 1;
      else strokeIndex = outlines.length; // done
      paintGuide();
    }

    // ====== pointer events ======
    function getXY(e) {
      // client coords
      return { x: e.clientX, y: e.clientY };
    }

    function drawLine(a, b) {
      const color = (typeof getColor === "function" ? getColor() : "#ff3b30") || "#ff3b30";
      const size = Number((typeof getSize === "function" ? getSize() : 8) || 8);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(a.x - viewport.getBoundingClientRect().left, a.y - viewport.getBoundingClientRect().top);
      ctx.lineTo(b.x - viewport.getBoundingClientRect().left, b.y - viewport.getBoundingClientRect().top);
      ctx.stroke();
      ctx.restore();
    }

    function onDown(e) {
      if (!enabled) return;
      drawing = true;
      last = getXY(e);
      pts = [last];
      e.preventDefault();
    }

    function onMove(e) {
      if (!enabled || !drawing) return;
      const p = getXY(e);
      if (last) drawLine(last, p);
      last = p;
      pts.push(p);
      e.preventDefault();
    }

    function onUp(e) {
      if (!enabled) return;
      drawing = false;
      last = null;

      // 少点就不判
      if (pts.length < 6) return;

      const ok = judgeStrokeOK();
      if (ok) {
        flash("rgba(34,197,94,1)"); // green
        // 当前笔完成 -> 变绿 -> 下一笔
        if (outlines.length) {
          // 标记当前完成
          outlines[strokeIndex]?.setAttribute("fill", "rgba(34,197,94,0.35)");
          advanceStroke();
        }
        clearCurrent(); // 自动清画布，准备下一笔
      } else {
        flash("rgba(239,68,68,1)"); // red
        // 写错不前进，清掉重新写
        clearCurrent();
        paintGuide();
      }
      e.preventDefault();
    }

    // 绑在 viewport：只有开启时 canvas 才吃事件
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    function destroy() {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.remove();
    }

    // 默认关闭
    setEnabled(false);

    return { setEnabled, clearCurrent, destroy, getStrokeIndex };
  }

  window.StrokeTrace = { initTraceMode };
})();
