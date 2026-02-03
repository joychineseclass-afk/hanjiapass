// ui/ui-stroke-teaching.js
export function initStrokeTeaching(rootEl, stage, traceApi) {
  let teaching = false;

  const btnTrace = rootEl.querySelector(".btnTrace");
  if (!btnTrace) return;

  // ✅ 不要缓存 traceCanvas：它可能在 init 时还没生成
  const getTraceCanvas = () => rootEl.querySelector("#traceCanvas");

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
    const traceCanvas = getTraceCanvas();
    if (!traceCanvas) return;
    traceCanvas.style.pointerEvents = on ? "auto" : "none";
  }

  // -------------------------
  // ✅ 写对发光 / 写错震动（钩子：若未来有判错信息就能用）
  // -------------------------
  function flashGlow() {
    const traceCanvas = getTraceCanvas();
    const el = traceCanvas || stage || rootEl;
    if (!el) return;
    el.classList.add("trace-glow");
    setTimeout(() => el.classList.remove("trace-glow"), 180);
  }

  function vibrateWrong() {
    try {
      navigator.vibrate?.(60);
    } catch {}
    const el = stage || rootEl;
    if (!el) return;
    el.classList.add("trace-shake");
    setTimeout(() => el.classList.remove("trace-shake"), 220);
  }

  // ✅ 注入一次必要的 CSS（只注入一次）
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
  // ✅ 示范：播放当前笔（不推进 index）
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
  // ✅ 旧事件（保留）：如果 traceApi 自己会触发“完成一笔”
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
      queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:nextchar")));
      traceApi?.setEnabled?.(false);
      return;
    }

    redrawStrokeColor({ activeIndex: idx + 1, finished: false });
  }

  // -------------------------
  // ✅ 核心：监听 traceCanvas 的 “trace:strokeend”
  // 来推进 strokeIndex + 更新颜色 + 完成后跳下一个字
  // -------------------------
  function bindTraceStrokeEndOnce() {
    const traceCanvas = getTraceCanvas();
    if (!traceCanvas) return;

    // 避免重复绑定
    if (traceCanvas.__strokeTeachingBound) return;
    traceCanvas.__strokeTeachingBound = true;

    traceCanvas.addEventListener("trace:strokeend", (e) => {
      if (!teaching) return;

      const svg = stage?.querySelector?.("svg");
      const strokes = svg ? getStrokeAnims(svg) : [];
      const total = strokes.length || 0;

      const after =
        Number(e?.detail?.strokeIndexAfter ?? traceApi?.getStrokeIndex?.() ?? 0) || 0;

      // ✅ 同步 index（保险）
      traceApi?.setStrokeIndex?.(after);

      // ✅ 写对发光（目前没有判错数据：默认“写了就算对”）
      flashGlow();

      // ✅ 若未来你在 e.detail 里放入 wrong=true，就可以震动
      if (e?.detail?.wrong === true) vibrateWrong();

      if (total && after >= total) {
        // ✅ 全部写完
        redrawStrokeColor({ finished: true });
        queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));
        queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:nextchar")));
        traceApi?.setEnabled?.(false);
      } else {
        // ✅ 继续下一笔
        redrawStrokeColor({ activeIndex: after, finished: false });
      }
    });
  }

  // -------------------------
  // ✅ teaching on/off（跟写必须：toggle(true) + setEnabled(true) + pointerEvents=auto）
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

      // ✅ ② 必须开启 tracing，否则 initTraceCanvasLayer 会拒绝画
      traceApi?.toggle?.(true);

      // ③ 从第一笔开始
      traceApi?.setStrokeIndex?.(0);
      redrawStrokeColor({ activeIndex: 0, finished: false });

      // ④ 清掉上次轨迹
      traceApi?.clear?.();

      // ⑤ 示范前先锁定书写
      traceApi?.setEnabled?.(false);

      // ⑥ 播放一笔示范（只演示，不推进）
      const ok = playDemoOneStroke();
      if (!ok) console.warn("[stroke] demo stroke not found in svg");

      // ⑦ 示范结束后允许学生写 + 绑定 strokeend
      setTimeout(() => {
        // ✅ 先绑定，防止第一笔写完事件丢失
        bindTraceStrokeEndOnce();

        // ✅ 再打开输入
        traceApi?.setEnabled?.(true);

        const traceCanvas = getTraceCanvas();
        console.log(
          "[TRACE] isTracing:",
          traceApi?.isTracing?.() ?? "no isTracing()",
          "enabled:",
          "setEnabled" in (traceApi || {}) ? "setEnabled" : "unknown",
          "pointerEvents:",
          traceCanvas?.style?.pointerEvents
        );
      }, 260);
    } else {
      // ---------- 教学模式关闭 ----------
      setTracePointer(false);

      // 可选：关掉 tracing（干净）
      traceApi?.toggle?.(false);

      traceApi?.setEnabled?.(false);
      redrawStrokeColor({ finished: true });
      queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));
    }
  }

  // -------------------------
  // ✅ 交互：单击 = 开/关（一次就生效）
  // -------------------------
  btnTrace.addEventListener("click", () => setTeaching(!teaching));

  // 长按（移动端可用）
  let pressTimer = null;
  btnTrace.addEventListener("pointerdown", () => {
    pressTimer = setTimeout(() => setTeaching(!teaching), 450);
  });
  btnTrace.addEventListener("pointerup", () => clearTimeout(pressTimer));
  btnTrace.addEventListener("pointerleave", () => clearTimeout(pressTimer));

  // ✅ 保留你原来的 traceApi.on(...) 逻辑（并修复掉你文件里的 “aft”）
  try {
    if (typeof traceApi?.on === "function") {
      traceApi.on("strokeComplete", onUserFinishedOneStroke);
      traceApi.on("complete", onUserFinishedOneStroke);
    } else if (typeof traceApi?.setOnStrokeComplete === "function") {
      traceApi.setOnStrokeComplete(onUserFinishedOneStroke);
    } else if (typeof traceApi?.onStrokeComplete === "function") {
      traceApi.onStrokeComplete(onUserFinishedOneStroke);
    }
  } catch (e) {
    console.warn("[stroke] cannot bind stroke complete event", e);
  }

  // 初始：关闭
  setTeaching(false);
}
