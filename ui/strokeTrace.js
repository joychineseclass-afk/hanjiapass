// ui/strokeTrace.js ✅完善不返工版（兼容你的 23458.svg / MakeMeAHanzi 类 SVG）
// - 修复：if (오케이) -> if (ok)
// - 去掉闪提示（不提示、不闪绿红块）
// - 支持回调：onStrokeCorrect / onAllComplete
// - 支持重复练习：reset() / clearCurrent()
// - 支持两类“目标笔画”选择：
//   1) path[fill="lightgray"]（你旧数据）
//   2) path[id^="make-me-a-hanzi-animation-"]（MakeMeAHanzi）
//   3) 兜底：所有 path
(function () {
  function initTraceMode({
    viewport,
    svg,
    getColor,
    getSize,
    onStrokeCorrect,
    onAllComplete,
  }) {
    if (!viewport || !svg) return null;

    // ====== canvas overlay ======
    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 w-full h-full pointer-events-none";
    canvas.style.touchAction = "none";
    viewport.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    let enabled = false;
    let drawing = false;
    let pointerId = null;

    let strokeIndex = 0;
    let last = null; // {x,y} client coords
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

    // ====== outlines / targets ======
    function pickOutlines() {
      // 1) 旧版：fill=lightgray 的目标笔画区域
      const a = Array.from(svg.querySelectorAll('path[fill="lightgray"]'));
      if (a.length) return { outlines: a, mode: "fill" };

      // 2) MakeMeAHanzi：每笔动画 path
      const b = Array.from(svg.querySelectorAll('path[id^="make-me-a-hanzi-animation-"]'));
      if (b.length) return { outlines: b, mode: "stroke" };

      // 3) 兜底：全部 path
      const c = Array.from(svg.querySelectorAll("path"));
      return { outlines: c, mode: "stroke" };
    }

    let { outlines, mode } = pickOutlines();

    // 描红底色（不做绿/黄提示，只做“当前笔/未完成”可视化）
    function paintGuide() {
      if (!outlines.length) return;

      outlines.forEach((p, i) => {
        if (mode === "fill") {
          // fill 模式：改 fill（你的旧数据）
          if (i < strokeIndex) p.setAttribute("fill", "rgba(0,0,0,0.18)");
          else if (i === strokeIndex) p.setAttribute("fill", "rgba(0,0,0,0.18)");
          else p.setAttribute("fill", "lightgray");
        } else {
          // stroke 模式：改 stroke（MakeMeAHanzi）
          // 这里不做鲜艳色（鲜艳色由主控/main.js 根据 onStrokeCorrect 去做）
          p.style.stroke = "rgba(0,0,0,0.18)";
          p.style.fill = "rgba(0,0,0,0.18)";
          p.style.opacity = "1";
        }
      });
    }
    if (outlines.length) paintGuide();

    // ====== API ======
    function clearCurrent() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts = [];
      last = null;
    }

    function reset() {
      strokeIndex = 0;
      clearCurrent();
      // 重新抓一次（切字时 svg 会变）
      ({ outlines, mode } = pickOutlines());
      paintGuide();
    }

    function setEnabled(v) {
      enabled = !!v;
      canvas.style.pointerEvents = enabled ? "auto" : "none";
      if (!enabled) {
        drawing = false;
        pointerId = null;
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

      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
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

      const L = polylineLength(pts);

      // 阈值（你后续想更严/更松可调）
      const overlapOK = overlapArea / bbArea >= 0.18;
      const lengthOK = L >= Math.max(bb.width, bb.height) * 0.32;

      return overlapOK && lengthOK;
    }

    function advanceStroke() {
      if (!outlines.length) return;

      if (strokeIndex < outlines.length - 1) {
        strokeIndex += 1;
      } else {
        strokeIndex = outlines.length; // done
      }
    }

    // ====== pointer events ======
    function getXY(e) {
      return { x: e.clientX, y: e.clientY };
    }

    function drawLine(a, b) {
      const color = (typeof getColor === "function" ? getColor() : "#ff3b30") || "#ff3b30";
      const size = Number((typeof getSize === "function" ? getSize() : 8) || 8);

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

      drawing = true;
      pointerId = e.pointerId;

      canvas.setPointerCapture?.(pointerId);

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
      pointerId = null;
      last = null;

      // 少点就不判
      if (pts.length < 6) {
        clearCurrent();
        return;
      }

      const ok = judgeStrokeOK();

      if (ok) {
        // ✅ 写对：通知主控（由主控决定怎么上色/进度/序号）
        try { onStrokeCorrect?.(); } catch {}

        advanceStroke();
        clearCurrent();

        // done?
        if (strokeIndex >= outlines.length) {
          try { onAllComplete?.(); } catch {}
        } else {
          // 继续下一笔（保持浅灰底）
          paintGuide();
        }
      } else {
        // 写错：不前进，清掉重写（不提示）
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
      last = null;
      clearCurrent();
      paintGuide();
      e.preventDefault();
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);

    function destroy() {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.remove();
    }

    setEnabled(false);

    return {
      setEnabled,
      clearCurrent,
      reset,
      destroy,
      getStrokeIndex,
    };
  }

  window.StrokeTrace = { initTraceMode };
})();
