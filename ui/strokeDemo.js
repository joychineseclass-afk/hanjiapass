// ui/strokeDemo.js
(function () {
  let demoTimer = null;
  let demoPlaying = false;

  function stop() {
    demoPlaying = false;
    if (demoTimer) {
      clearTimeout(demoTimer);
      demoTimer = null;
    }

    document.querySelectorAll(".demo-stroke").forEach((p) => {
      p.classList.remove("demo-stroke");
      p.style.strokeDasharray = "";
      p.style.strokeDashoffset = "";
      p.style.transition = "";
    });
  }

  function animateOne(el, { duration = 420 } = {}) {
    return new Promise((resolve) => {
      if (!el) return resolve();

      el.classList.remove("trace-stroke-dim");
      el.classList.add("trace-stroke-on");
      el.classList.add("demo-stroke");

      let len = 0;
      try { len = el.getTotalLength?.() || 0; } catch {}

      if (!len) return resolve();

      el.style.transition = "none";
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);

      requestAnimationFrame(() => {
        el.style.transition = `stroke-dashoffset ${duration}ms linear`;
        el.style.strokeDashoffset = "0";

        demoTimer = setTimeout(() => {
          el.style.transition = "";
          resolve();
        }, duration + 40);
      });
    });
  }

  async function playAll({ stageEl, strokeEls, onStroke } = {}) {
    if (!stageEl || !strokeEls?.length) return;

    stop();
    demoPlaying = true;

    const svg = stageEl.querySelector("svg");
    if (svg) window.StrokePlayerCanvas?.resetTraceState?.({ svg, strokeEls });

    for (let i = 0; i < strokeEls.length; i++) {
      if (!demoPlaying) break;
      await animateOne(strokeEls[i]);
      try { onStroke?.(i); } catch {}
    }

    demoPlaying = false;
  }

  window.StrokeDemo = { playAll, stop };
})();
