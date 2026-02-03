// ui-stroke-teaching.js
export function initStrokeTeaching(rootEl, stage, traceApi) {
  let teaching = false;
  let currentStrokeIndex = 0;

  const btnTrace = rootEl.querySelector(".btnTrace");
  if (!btnTrace) return;

  const traceCanvas = rootEl.querySelector("#traceCanvas");

  /* ============ 小标签 ============ */
  let tag = rootEl.querySelector("#teachingTag");
  if (!tag) {
    tag = document.createElement("div");
    tag.id = "teachingTag";
    tag.className =
      "absolute left-2 top-2 text-[11px] text-white bg-slate-900/80 px-2 py-1 rounded hidden";
    const box = rootEl.querySelector(".aspect-square")?.parentElement || rootEl;
    box.style.position = box.style.position || "relative";
    box.appendChild(tag);
  }

  function setTag(on) {
    tag.classList.toggle("hidden", !on);
    tag.textContent = "따라쓰기 ON";
  }

  function setTracePointer(on) {
    if (traceCanvas) traceCanvas.style.pointerEvents = on ? "auto" : "none";
  }

  /* ============ 找笔画SVG ============ */
  function getStrokeAnims(svg) {
    const list = [...svg.querySelectorAll('[id^="make-me-a-hanzi-animation-"]')];
    if (list.length) return list;
    return [...svg.querySelectorAll('[data-stroke], .stroke, [id*="animation"]')];
  }

  function redrawStrokeColor({ activeIndex, finished = false } = {}) {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    const total = strokes.length;
    const active = finished ? -1 : Math.max(0, Math.min(activeIndex ?? 0, total - 1));

    strokes.forEach((s, idx) => {
      let color = finished
        ? "#111827"
        : idx < active
        ? "#FB923C"
        : idx === active
        ? "#93C5FD"
        : "#D1D5DB";

      [s, ...(s.querySelectorAll?.("*") || [])].forEach((el) => {
        try {
          el.style.setProperty("stroke", color, "important");
          el.style.setProperty("fill", color, "important");
        } catch {}
      });
    });
  }

  function playDemoOneStroke() {
    redrawStrokeColor({ activeIndex: currentStrokeIndex });
  }

  /* ============ ✨ 写对发光 ============ */
  function flashCorrect() {
    stage.classList.add("stroke-correct");
    setTimeout(() => stage.classList.remove("stroke-correct"), 300);
  }

  /* ============ ✨ 写错震动 ============ */
  function shakeWrong() {
    stage.classList.add("stroke-wrong");
    setTimeout(() => stage.classList.remove("stroke-wrong"), 400);
  }

  /* ============ 学生写完一笔 ============ */
  function onUserFinishedOneStroke() {
    const svg = stage?.querySelector?.("svg");
    const strokes = getStrokeAnims(svg);
    const total = strokes.length;

    flashCorrect();
    currentStrokeIndex++;

    if (currentStrokeIndex >= total) {
      redrawStrokeColor({ finished: true });

      // 🎉 全部写完自动跳下一个字
      setTimeout(() => {
        rootEl.dispatchEvent(new CustomEvent("stroke:complete"));
      }, 600);
    } else {
      redrawStrokeColor({ activeIndex: currentStrokeIndex });
    }
  }

  /* ============ 教学开关 ============ */
  function setTeaching(next) {
    teaching = next;
    setTag(teaching);

    if (teaching) {
  currentStrokeIndex = 0;

  setTracePoint(true);          // 允许 canvas 接收事件
  traceApi?.toggle?.(true);     // ⭐ 真正打开描红层（否则 tracing=false 不能写）

  playDemoOneStroke();          // 播放示范

  setTimeout(() => {
    traceApi?.enable?.();
    traceApi?.setEnabled?.(true);
  }, 300);

} else {
  setTracePoint(false);
  traceApi?.disable?.();
  traceApi?.setEnabled?.(false);
  redrawStrokeColor({ finished: true });
}
  }

  /* ============ 单击直接切换描红模式 ============ */
  btnTrace.addEventListener("click", () => {
    setTeaching(!teaching);
  });

  /* ============ 监听笔画完成 ============ */
  try {
    traceApi?.on?.("strokeComplete", onUserFinishedOneStroke);
    traceApi?.on?.("complete", onUserFinishedOneStroke);
  } catch {}

  setTeaching(false);
}
