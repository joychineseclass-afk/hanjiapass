// ui-stroke-teaching.js
export function initStrokeTeaching(rootEl, stage, traceApi) {
  let teaching = false;

  const btnTrace = rootEl.querySelector(".btnTrace");
  if (!btnTrace) return;

  const traceCanvas = rootEl.querySelector("#traceCanvas"); // ✅ 描红层（canvas）

  // -------------------------
  // ✅ 小标签：Teaching ON
  // -------------------------
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
    if (!tag) return;
    if (on) {
      tag.textContent = "Teaching ON";
      tag.classList.remove("hidden");
    } else {
      tag.classList.add("hidden");
    }
  }

  // -------------------------
  // ✅ 关键：控制 canvas 是否接收触摸/鼠标
  // -------------------------
  function setTracePointer(on) {
    if (!traceCanvas) return;
    traceCanvas.style.pointerEvents = on ? "auto" : "none";
  }

  // -------------------------
  // ✅ 小反馈：写对发光 / 写错震动（占位钩子）
  // -------------------------
  function flashGlow() {
    // 给描红层一个短暂发光（不改你的布局）
    const el = traceCanvas || stage || rootEl;
    if (!el) return;
    el.classList.add("trace-glow");
    setTimeout(() => el.classList.remove("trace-glow"), 180);
  }

  function vibrateWrong() {
    // 只有在支持 vibration 的设备上有效
    try {
      navigator.vibrate?.(60);
    } catch {}
    // 给容器抖一下（PC 也能看到）
    const el = stage || rootEl;
    if (!el) return;
    el.classList.add("trace-shake");
    setTimeout(() => el.classList.remove("trace-shake"), 220);
  }

  // 注入一次必要的 CSS（只注入一次，不影响你原样式）
  (function injectFxCssOnce() {
    if (document.getElementById("stroke-teaching-fx-css")) return;
    const style = document.createElement("style");
    style.id = "stroke-teaching-fx-css";
    style.textContent = `
      .trace-glow { box-shadow: 0 0 0 4px rgba(255, 165, 0, .25), 0 0 18px rgba(255, 165, 0, .45) !important; border-radius: 12px; }
      .trace-shake { animation: traceShake .22s linear; }
      @keyframes traceShake {
        0% { transform: translateX(0); }
        25% { transform: translateX(-3px); }
        50% { transform: translateX(3px); }
        75% { transform: translateX(-2px); }
        100% { transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  })();

  // -------------------------
  // ✅ SVG 한 획 애니메이션 요소 찾기
  // -------------------------
  function getStrokeAnims(svg) {
    const list = [...svg.querySelectorAll('[id^="make-me-a-hanzi-animation-"]')];
    if (list.length) return list;
    return [...svg.querySelectorAll('[data-stroke], .stroke, [id*="animation"]')];
  }

  function replayCssAnimation(el) {
    el.style.animation = "none";
    el.getBoundingClientRect();
    el.style.animation = "";
  }

  // -------------------------
  // ✅ 你已经跑通的：按进度重绘颜色
  // -------------------------
  function redrawStrokeColor({ activeIndex, finished = false } = {}) {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return;

    const total = strokes.length;
    const active = finished ? -1 : Math.max(0, Math.min(activeIndex ?? 0, total - 1));

    strokes.forEach((s, idx) => {
      let color;
      if (finished) color = "#111827";
      else if (idx < active) color = "#FB923C";
      else if (idx === active) color = "#93C5FD";
      else color = "#D1D5DB";

      const targets = [s, ...(s?.querySelectorAll?.("*") || [])];
      targets.forEach((el) => {
        try {
          el.style?.setProperty?.("stroke", color, "important");
          el.style?.setProperty?.("fill", color, "important");
        } catch {}
        try {
          const st = el.getAttribute?.("stroke");
          if (st !== "none") el.setAttribute?.("stroke", color);
          const fi = el.getAttribute?.("fill");
          if (fi !== "none") el.setAttribute?.("fill", color);
        } catch {}
      });
    });
  }

  // -------------------------
  // ✅ 示范：播放当前笔
  // -------------------------
  function playDemoOneStroke() {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return false;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return false;

    const i = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;
    const s = strokes[i] || strokes[0];
    if (!s) return false;

    redrawStrokeColor({ activeIndex: i, finished: false });
    replayCssAnimation(s);
    return true;
  }

  // -------------------------
  // ✅ 完成检测（保持你原来的逻辑）
  // -------------------------
  function onUserFinishedOneStroke() {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    const total = strokes.length || 0;
    if (!total) return;

    const idx = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;

    if (idx >= total - 1) {
      redrawStrokeColor({ finished: true });
      queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));

      // ✅ 自动跳下一个字（外层去接这个事件）
      queueMicrotask(() =>
        rootEl?.dispatchEvent?.(new CustomEvent("stroke:nextchar"))
      );

      // 锁定
      traceApi?.setEnabled?.(false);
      return;
    }

    redrawStrokeColor({ activeIndex: idx + 1, finished: false });
  }

  // -------------------------
  // ✅ 关键：监听 traceCanvas 的“写完一笔”事件，推进笔画
  // （initTraceCanvasLayer 在 pointerup 时 emit("trace:strokeend", {...})）
  // -------------------------
  function bindTraceStrokeEnd() {
    if (!traceCanvas) return;

    // 避免重复绑定
    if (traceCanvas.__strokeTeachingBound) return;
    traceCanvas.__strokeTeachingBound = true;

    traceCanvas.addEventListener("trace:strokeend", (e) => {
      if (!teaching) return;

      const svg = stage?.querySelector?.("svg");
      const strokes = svg ? getStrokeAnims(svg) : [];
      const total = strokes.length || 0;

      // ✅ 写对：先给个发光反馈（目前没有判错来源，所以默认“写了就算对”）
      flashGlow();

      // 如果未来你加了判错逻辑，可以在这里根据 e.detail 来 vibrateWrong()
      // 例如：if (e.detail?.isWrong) vibrateWrong();

      const nextIndex =
        Number(e?.detail?.strokeIndexAfter ?? traceApi?.getStrokeIndex?.() ?? 0) || 0;

      // 把 traceApi 的 index 同步到最新（保险）
      traceApi?.setStrokeIndex?.(nextIndex);

      // ✅ 推进颜色
      if (total && nextIndex >= total) {
        // 写完全部
        redrawStrokeColor({ finished: true });
        queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));
        queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:nextchar")));
        traceApi?.setEnabled?.(false);
      } else {
        redrawStrokeColor({ activeIndex: nextIndex, finished: false });
      }
    });
  }

  // -------------------------
  // ✅ teaching on/off（核心改动都在这里）
  // -------------------------
  function setTeaching(next) {
    teaching = !!next;

    // ✅ 单击一次就高亮（你要的）
    btnTrace.classList.toggle("trace-active", teaching);
    if (teaching) {
      btnTrace.classList.add("bg-orange-500", "text-white");
      btnTrace.classList.remove("bg-slate-100");
    } else {
      btnTrace.classList.remove("bg-orange-500", "text-white");
      btnTrace.classList.add("bg-slate-100");
    }

    setTag(teaching);

    if (teaching) {
      // ---------- 教学模式开启 ----------

      // ① 让 canvas 接收事件
      setTracePointer(true);

      // ✅ ② 关键：必须打开 tracing，否则 initTraceCanvasLayer 会拒绝画
      traceApi?.toggle?.(true);

      // ③ 重置到第一笔（从头练）
      traceApi?.setStrokeIndex?.(0);
      redrawStrokeColor({ activeIndex: 0, finished: false });

      // ④ 清除上一次笔迹（可选）
      traceApi?.clear?.();

      // ⑤ 示范前先锁定书写
      traceApi?.setEnabled?.(false);

      // ⑥ 播放一笔示范动画
      const ok = playDemoOneStroke();
      if (!ok) console.warn("[stroke] demo stroke not found in svg");

      // ⑦ 示范结束后允许学生写
      setTimeout(() => {
        traceApi?.setEnabled?.(true);

        // 绑定“写完一笔”事件（只绑定一次）
        bindTraceStrokeEnd();

        console.log(
          "[TRACE] tracing:",
          traceApi?.isTracing?.() ?? "no isTracing()",
          "enabled:",
          traceApi?.getStrokeIndex ? "ok" : "no getStrokeIndex",
          "pointerEvents:",
          traceCanvas?.style?.pointerEvents
        );
      }, 300);
    } else {
      // ---------- 教学模式关闭 ----------
      setTracePointer(false);

      // ✅ 关闭 tracing（可选：你也可以不关，但关掉更干净）
      traceApi?.toggle?.(false);

      traceApi?.setEnabled?.(false);
      redrawStrokeColor({ finished: true });
      queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));
    }
  }

  // -------------------------
  // ✅ 交互：单击 = 开/关 teaching（你要的一次就生效）
  // 另外：教学开启后，再点一次 = 关闭
  // -------------------------
  btnTrace.addEventListener("click", () => {
    setTeaching(!teaching);
  });

  // 长按（移动端）：也保持可用（可选）
  let pressTimer = null;
  btnTrace.addEventListener("pointerdown", () => {
    pressTimer = setTimeout(() => setTeaching(!teaching), 450);
  });
  btnTrace.addEventListener("pointerup", () => clearTimeout(pressTimer));
  btnTrace.addEventListener("pointerleave", () => clearTimeout(pressTimer));

  // 你原来的 traceApi.on(...) 逻辑保留（即使没有也不影响）
  try {
    if (typeof traceApi?.on === "function") {
      traceApi.on("strokeComplete", onUserFinishedOneStroke);
      traceApi.on("complete", onUserFinishedOneStroke);
    } else if (typeof traceApi?.setOnStrokeComplete === "function") {
      traceApi.setOnStrokeComplete(onUserFinishedOneStroke);
   aft
    } else if (typeof traceApi?.onStrokeComplete === "function") {
      traceApi.onStrokeComplete(onUserFinishedOneStroke);
    }
  } catch (e) {
    console.warn("[stroke] cannot bind stroke complete event", e);
  }

  // 初始：关闭
  setTeaching(false);
}
