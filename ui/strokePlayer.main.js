(function () {
  // ====== 样式（一次性注入）======
  const styleId = "stroke-trace-style-v3";
  if (!document.getElementById(styleId)) {
    const st = document.createElement("style");
    st.id = styleId;
    st.textContent = `
      .trace-stroke-dim { stroke: rgba(0,0,0,.18) !important; }
      .trace-stroke-on  { stroke: #ff3b30 !important; }

      .trace-num { font-size: 16px; font-weight: 800; fill: rgba(0,0,0,.35); }
      .trace-num-on { fill: #ff3b30 !important; }

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
    let tracingOn = false;

    let traceApi = null;
    let strokeEls = [];
    let strokeDone = 0;

    function strokeUrl(ch) {
      return window.DATA_PATHS?.strokeUrl?.(ch) || "";
    }
    function fileName(ch) {
      return window.DATA_PATHS?.strokeFileNameForChar?.(ch) || "";
    }

    function getStrokeEls(svg) {
      // make-me-a-hanzi 通常是这个 id 前缀
      const a = Array.from(svg.querySelectorAll('[id^="make-me-a-hanzi-animation-"]'));
      if (a.length) return a;

      // 兜底：取所有 path（尽量可用）
      return Array.from(svg.querySelectorAll("path"));
    }

    function hideRedo() { btnRedo?.classList.add("hidden"); }
    function showRedo() { btnRedo?.classList.remove("hidden"); }

    function markStrokeOn(idx) {
      const el = strokeEls[idx];
      if (el) {
        el.classList.remove("trace-stroke-dim");
        el.classList.add("trace-stroke-on");
      }
      const svg = stage.querySelector("svg");
      if (svg) {
        const t = svg.querySelector(`.trace-num[data-idx="${idx}"]`);
        t?.classList.add("trace-num-on");
      }
    }

    function setTraceEnabled(on) {
      tracingOn = !!on;
      btnTrace?.classList.toggle("trace-btn-on", tracingOn);

      const svg = stage.querySelector("svg");
      if (svg) window.StrokePlayerCanvas?.setNumberLayerVisible?.(svg, tracingOn);

      if (!traceApi) return;

      if (tracingOn) {
        hideRedo();
        strokeDone = 0;

        // 全部变浅灰 + 序号重置
        const svg2 = stage.querySelector("svg");
        if (svg2) window.StrokePlayerCanvas?.resetTraceState?.({ svg: svg2, strokeEls });

        traceApi.setEnabled?.(true);
      } else {
        traceApi.setEnabled?.(false);
      }
    }

    async function loadChar(ch, { bust = false } = {}) {
      currentChar = ch;
      hideRedo();
      strokeDone = 0;
      traceApi = null;
      strokeEls = [];

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

        const svg = stage.querySelector("svg");
        if (!svg) {
          stage.innerHTML = `<div class="text-sm text-red-600">SVG 없음</div>`;
          return;
        }

        // 固定大小，不做缩放
        svg.style.width = "88%";
        svg.style.height = "88%";

        strokeEls = getStrokeEls(svg);

        // 初始：全浅灰
        window.StrokePlayerCanvas?.resetTraceState?.({ svg, strokeEls });

        // 加笔画序号（默认隐藏，进入描红才显示）
        window.StrokePlayerCanvas?.addStrokeNumbers?.(svg, strokeEls);

        // 初始化判笔描红
        try {
          if (window.StrokeTrace?.initTraceMode) {
            traceApi = window.StrokeTrace.initTraceMode({
              viewport,
              svg,
              getColor: () => "#ff3b30",
              getSize: () => 8,

              onStrokeCorrect: () => {
                strokeDone = Math.min(strokeDone + 1, strokeEls.length);
                const idx = strokeDone - 1;
                if (idx >= 0) markStrokeOn(idx);
              },

              onAllComplete: () => {
                // 不提示，显示重写
                showRedo();
              }
            });

            // 默认先关闭，等用户点 따라쓰기
            traceApi.setEnabled?.(false);
          } else {
            traceApi = null;
          }
        } catch {
          traceApi = null;
        }

        // 如果用户当前开着描红，切换字后保持开启
        if (tracingOn) setTraceEnabled(true);
        else setTraceEnabled(false);

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

        // 高亮
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

    btnReplay?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      loadChar(currentChar, { bust: true });
    });

    btnTrace?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setTraceEnabled(!tracingOn);
    });

    btnRedo?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideRedo();

      const svg = stage.querySelector("svg");
      if (svg) window.StrokePlayerCanvas?.resetTraceState?.({ svg, strokeEls });

      strokeDone = 0;
      try { traceApi?.clearCurrent?.(); } catch {}

      // 重写后保持描红开启
      tracingOn = true;
      btnTrace?.classList.add("trace-btn-on");
      if (svg) window.StrokePlayerCanvas?.setNumberLayerVisible?.(svg, true);
      traceApi?.setEnabled?.(true);
    });
  }

  window.StrokePlayer = { mountStrokeSwitcher };
})();
