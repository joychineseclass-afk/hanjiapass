// ui/strokePlayer.main.js ✅完善不返工版（自动播放 + 字面序号 + 描红判笔）
(function () {
  // ====== 样式（一次性注入）======
  const styleId = "stroke-trace-style-v5";
  if (!document.getElementById(styleId)) {
    const st = document.createElement("style");
    st.id = styleId;
    st.textContent = `
      /* ✅ 描红底色：浅灰 */
      .trace-stroke-dim  { stroke: rgba(0,0,0,.18) !important; fill: rgba(0,0,0,.18) !important; opacity: 1 !important; }

      /* ✅ 播放/当前笔高亮 */
      .trace-stroke-on   { stroke: #ff3b30 !important; fill: #ff3b30 !important; opacity: 1 !important; }

      /* ✅ 已完成笔 */
      .trace-stroke-done { stroke: #ff3b30 !important; fill: #ff3b30 !important; opacity: 1 !important; }

      .trace-num { font-size: 16px; font-weight: 800; fill: rgba(0,0,0,.35); }
      .trace-num-on { fill: #ff3b30 !important; }
      .trace-num-done { fill: rgba(255,59,48,.85) !important; }

      .trace-btn-on { background:#fb923c !important; color:#fff !important; }
    `;
    document.head.appendChild(st);
  }

  function mountStrokeSwitcher(targetEl, hanChars) {
    if (!targetEl) return;

    const chars = Array.from(hanChars || []).filter(Boolean);
    if (!chars.length) {
      targetEl.innerHTML = `<div class="text-sm text-gray-500">표시할 글자가 없어요.</div>`;
      return;
    }

    // ✅ 渲染模板（来自 tpl.js）
    targetEl.innerHTML = window.StrokePlayerTpl?.renderStrokePlayerTpl?.() || "";

    const btnWrap = targetEl.querySelector("#strokeBtns");
    const stage = targetEl.querySelector("#strokeStage");
    const viewport = targetEl.querySelector("#strokeViewport");
    const fileNameEl = targetEl.querySelector("#strokeFileName");

    const btnSpeak = targetEl.querySelector(".btnSpeak");
    const btnReplay = targetEl.querySelector(".btnReplay");
    const btnTrace = targetEl.querySelector(".btnTrace");
    const btnRedo = targetEl.querySelector(".btnRedo");

    let currentChar = chars[0];

    // ===== 模式状态 =====
    let tracingOn = false;          // 따라쓰기 on/off
    let traceApi = null;            // 判笔 API
    let svg = null;                 // 当前 svg
    let strokeEls = [];             // 笔画元素（按顺序）
    let doneCount = 0;              // 已完成笔数

    // ====== Demo 播放状态 ======
    let demoPlaying = false;
    let demoStopFlag = false;
    let demoTimer = null;

    function stopDemo() {
      demoStopFlag = true;
      demoPlaying = false;
      if (demoTimer) {
        clearTimeout(demoTimer);
        demoTimer = null;
      }
    }

    // ====== 取路径 ======
    function strokeUrl(ch) {
      return window.DATA_PATHS?.strokeUrl?.(ch) || "";
    }
    function fileName(ch) {
      return window.DATA_PATHS?.strokeFileNameForChar?.(ch) || "";
    }

    // ✅ 更稳的“按顺序取笔画”
    function getStrokeEls(svgEl) {
      if (!svgEl) return [];
      // 优先取 path，DOM 顺序通常就是笔顺顺序
      const paths = Array.from(svgEl.querySelectorAll("path"));
      return paths;
    }

    function hideRedo() { btnRedo?.classList.add("hidden"); }
    function showRedo() { btnRedo?.classList.remove("hidden"); }

    // ====== 统一进度刷新（不强依赖 canvas.js）=====
    function refreshProgress() {
      if (!svg) return;

      // 如果你 strokePlayer.canvas.js 有 setProgress，就用它
      if (window.StrokePlayerCanvas?.setProgress) {
        window.StrokePlayerCanvas.setProgress({
          svg,
          strokeEls,
          doneCount
        });
        return;
      }

      // 否则兜底：用 class 自己处理
      strokeEls.forEach((p, i) => {
        p.classList.remove("trace-stroke-dim", "trace-stroke-on", "trace-stroke-done");
        if (i < doneCount) p.classList.add("trace-stroke-done");
        else p.classList.add("trace-stroke-dim");
      });

      const nums = svg.querySelectorAll(".trace-num");
      nums.forEach((t) => {
        const idx = Number(t.getAttribute("data-idx"));
        t.classList.remove("trace-num-on", "trace-num-done");
        if (!Number.isFinite(idx)) return;
        if (idx < doneCount) t.classList.add("trace-num-done");
        else if (idx === doneCount) t.classList.add("trace-num-on");
      });
    }

    function resetForTraceMode() {
      doneCount = 0;
      hideRedo();
      if (!svg) return;
      window.StrokePlayerCanvas?.resetTraceState?.({ svg, strokeEls });
      window.StrokePlayerCanvas?.setNumberLayerVisible?.(svg, true);
      refreshProgress();
    }

    function resetForPlayMode() {
      doneCount = 0;
      hideRedo();
      if (!svg) return;
      window.StrokePlayerCanvas?.resetTraceState?.({ svg, strokeEls });
      window.StrokePlayerCanvas?.setNumberLayerVisible?.(svg, false);
      refreshProgress();
    }

    function setTraceEnabled(on) {
      tracingOn = !!on;
      btnTrace?.classList.toggle("trace-btn-on", tracingOn);

      if (!svg) return;

      if (tracingOn) {
        // ✅ 进入描红：停止动画 + 整字浅灰 + 显示序号
        stopDemo();
        resetForTraceMode();
        traceApi?.setEnabled?.(true);
      } else {
        // ✅ 退出描红：隐藏序号 + 停止判笔 + 回到播放模式（但不自动播，交给 다시）
        traceApi?.setEnabled?.(false);
        window.StrokePlayerCanvas?.setNumberLayerVisible?.(svg, false);
        resetForPlayMode();
      }
    }

    // ====== 初始化判笔 ======
    function initTrace(svgEl) {
      traceApi = null;
      if (!window.StrokeTrace?.initTraceMode) return;

      try {
        traceApi = window.StrokeTrace.initTraceMode({
          viewport,
          svg: svgEl,
          getColor: () => "#ff3b30",
          getSize: () => 8,

          onStrokeCorrect: () => {
            doneCount = Math.min(doneCount + 1, strokeEls.length);
            refreshProgress();
            if (doneCount >= strokeEls.length) showRedo();
          },

          onAllComplete: () => {
            showRedo();
          }
        });

        traceApi?.setEnabled?.(false);
      } catch {
        traceApi = null;
      }
    }

    // ====== ✅ 自动播放笔顺动画（真实逐笔 stroke-dashoffset）=====
    // 原理：把每个 path 做成“描边动画”，一笔一笔画出来
    async function playStrokeDemo({ speed = 1.0 } = {}) {
      if (!svg || !strokeEls.length) return;

      stopDemo();          // 防止重入
      demoStopFlag = false;
      demoPlaying = true;

      // 播放模式：先清空到浅灰
      resetForPlayMode();

      // 确保每笔可见（用 stroke）
      strokeEls.forEach((p) => {
        p.style.fill = "none";
        p.style.stroke = "#111";
        p.style.strokeWidth = "8";
        p.style.strokeLinecap = "round";
        p.style.strokeLinejoin = "round";
      });

      // 每一笔动画
      for (let i = 0; i < strokeEls.length; i++) {
        if (demoStopFlag) return;

        const p = strokeEls[i];

        // 当前笔高亮
        doneCount = i;
        refreshProgress();
        p.classList.add("trace-stroke-on");

        // dash 动画
        let L = 0;
        try { L = p.getTotalLength(); } catch { L = 300; }
        L = Math.max(80, Math.min(2000, L));

        p.style.strokeDasharray = `${L}`;
        p.style.strokeDashoffset = `${L}`;
        p.getBoundingClientRect(); // force reflow

        const baseMs = 420;                   // 你可调：每笔基础时间
        const dur = Math.round((baseMs + L * 0.55) / speed);

        p.style.transition = `stroke-dashoffset ${dur}ms linear`;
        p.style.stroke = "#ff3b30";

        // 执行动画
        p.style.strokeDashoffset = "0";

        await new Promise((resolve) => {
          demoTimer = setTimeout(resolve, dur + 40);
        });

        if (demoStopFlag) return;

        // 这一笔完成 -> done
        p.classList.remove("trace-stroke-on");
        p.classList.add("trace-stroke-done");

        doneCount = i + 1;
        refreshProgress();
      }

      demoPlaying = false;

      // ✅ 播放结束后：显示数字（你说要像视频那样“顺序标在字面上”）
      window.StrokePlayerCanvas?.setNumberLayerVisible?.(svg, true);
      refreshProgress();
    }

    // ====== 加载某个字 ======
    async function loadChar(ch, { bust = false } = {}) {
      currentChar = ch;
      hideRedo();
      stopDemo();

      // 切换字：描红先关掉
      tracingOn = false;
      btnTrace?.classList.remove("trace-btn-on");

      traceApi = null;
      svg = null;
      strokeEls = [];
      doneCount = 0;

      if (fileNameEl) fileNameEl.textContent = fileName(ch);

      const url0 = strokeUrl(ch);
      if (!url0) {
        stage.innerHTML = `<div class="text-sm text-red-600">strokeUrl 없음: ${ch}</div>`;
        return;
      }

      const url = bust
        ? (url0.includes("?") ? `${url0}&v=${Date.now()}` : `${url0}?v=${Date.now()}`)
        : url0;

      stage.innerHTML = `<div class="text-xs text-gray-400">loading... (${ch})</div>`;

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          stage.innerHTML = `<div class="text-sm text-red-600">필순 파일이 없어요 (HTTP ${res.status})</div>`;
          return;
        }

        const svgText = await res.text();
        stage.innerHTML = svgText;

        svg = stage.querySelector("svg");
        if (!svg) {
          stage.innerHTML = `<div class="text-sm text-red-600">SVG 없음</div>`;
          return;
        }

        svg.style.width = "88%";
        svg.style.height = "88%";

        strokeEls = getStrokeEls(svg);

        // ✅ 加序号层（默认隐藏）
        window.StrokePlayerCanvas?.addStrokeNumbers?.(svg, strokeEls, { defaultVisible: false });

        // ✅ 初始化判笔（默认关闭）
        initTrace(svg);

        // ✅ 默认加载后：自动播放一次（你要的）
        await playStrokeDemo({ speed: 1.0 });

      } catch (e) {
        stage.innerHTML = `<div class="text-sm text-red-600">로드 실패</div>`;
      }
    }

    // ===== 字按钮 =====
    btnWrap.innerHTML = "";
    chars.forEach((ch, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "px-3 py-1 rounded-lg border text-sm bg-white hover:bg-slate-50";
      b.textContent = ch;

      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        Array.from(btnWrap.children).forEach((x) =>
          x.classList.remove("border-orange-400", "bg-orange-50")
        );
        b.classList.add("border-orange-400", "bg-orange-50");

        loadChar(ch, { bust: true });
      });

      btnWrap.appendChild(b);
      if (i === 0) requestAnimationFrame(() => b.click());
    });

    // ===== 顶部按钮 =====
    btnSpeak?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.AIUI?.speak?.(currentChar, "zh-CN");
    });

    // ✅ 다시：重新播放（播放模式）
    btnReplay?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (tracingOn) setTraceEnabled(false);
      await playStrokeDemo({ speed: 1.0 });
    });

    // ✅ 따라쓰기：进入/退出描红
    btnTrace?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setTraceEnabled(!tracingOn);
    });

    // ✅ ↻：重写（不提示，直接清空并继续描红）
    btnRedo?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      hideRedo();
      if (!svg) return;

      stopDemo();

      tracingOn = true;
      btnTrace?.classList.add("trace-btn-on");

      resetForTraceMode();
      try { traceApi?.clearCurrent?.(); } catch {}
      traceApi?.setEnabled?.(true);
    });
  }

  window.StrokePlayer = { mountStrokeSwitcher };
})();
