// strokePlayer.main.js ✅完善不返工版（配合 strokePlayer.tpl.js + strokePlayer.canvas.js）
//
// ✅ 目标：
// 1) 笔顺播放：每一笔结束后，该笔变“鲜艳颜色(完成态)”，下一笔高亮（可选）
// 2) 点击 따라쓰기：整字变成“浅灰描红底色” + 显示笔画 1,2,3…（不弹提示）
// 3) 写完一次可重复练习：自动出现 ↻ 重写按钮；点击立即清空并重新开始
// 4) 不再提供缩放/拖拽/米字格：界面保持干净（背景用原来的 bg-slate-50）
//
// 依赖：
// - window.StrokePlayerTpl.renderStrokePlayerTpl()
// - window.StrokePlayerCanvas.addStrokeNumbers / setNumberLayerVisible / resetTraceState / setProgress
// - window.StrokeTrace.initTraceMode(...)  (你现有的判笔模块)
// - 你的 strokePlayer.js（播放笔顺动画）如果有，下面已经做了“有就用、没有也不报错”的兼容

(function () {
  // ====== 样式（一次性注入）======
  const styleId = "stroke-trace-style-v4";
  if (!document.getElementById(styleId)) {
    const st = document.createElement("style");
    st.id = styleId;
    st.textContent = `
      /* ✅ 描红底色：浅灰 */
      .trace-stroke-dim  { stroke: rgba(0,0,0,.18) !important; fill: rgba(0,0,0,.18) !important; }
      /* ✅ 当前笔（可选高亮） */
      .trace-stroke-on   { stroke: #ff3b30 !important; fill: #ff3b30 !important; }
      /* ✅ 已完成笔：鲜艳（你也可以改成你喜欢的颜色） */
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

    // ====== 取路径 ======
    function strokeUrl(ch) {
      return window.DATA_PATHS?.strokeUrl?.(ch) || "";
    }
    function fileName(ch) {
      return window.DATA_PATHS?.strokeFileNameForChar?.(ch) || "";
    }

    // ✅ 更稳的“按顺序取笔画”：
    // - make-me-a-hanzi 的 svg 通常每一笔都有 path，顺序就是 DOM 顺序
    // - 你现在本地 strokes 是数字文件名 svg（如 23458.svg / 30604.svg），通常 path 顺序也可用
    function getStrokeEls(svgEl) {
      if (!svgEl) return [];
      // 先尽量过滤掉背景/网格（如果有的话）
      const paths = Array.from(svgEl.querySelectorAll("path"));
      // 兜底：只要路径够多就用
      return paths;
    }

    function hideRedo() { btnRedo?.classList.add("hidden"); }
    function showRedo() { btnRedo?.classList.remove("hidden"); }

    // ====== UI 进度刷新 ======
    function refreshProgress() {
      if (!svg) return;
      // 用我们 canvas.js 里的 setProgress：done/当前/未做 全部统一处理
      window.StrokePlayerCanvas?.setProgress?.({
        svg,
        strokeEls,
        doneCount
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

      // 播放模式：你希望“每一笔结束后鲜艳”，所以这里先把它清空为 dim，
      // 让播放/回调去逐笔点亮
      window.StrokePlayerCanvas?.resetTraceState?.({ svg, strokeEls });
      window.StrokePlayerCanvas?.setNumberLayerVisible?.(svg, false);
      refreshProgress();
    }

    function setTraceEnabled(on) {
      tracingOn = !!on;
      btnTrace?.classList.toggle("trace-btn-on", tracingOn);

      if (!svg) return;

      if (tracingOn) {
        // ✅ 进入描红：整字浅灰 + 显示序号 + 准备判笔
        resetForTraceMode();
        traceApi?.setEnabled?.(true);
      } else {
        // ✅ 退出描红：序号隐藏 + 停止判笔
        window.StrokePlayerCanvas?.setNumberLayerVisible?.(svg, false);
        traceApi?.setEnabled?.(false);

        // ✅ 回到笔顺播放：重新加载/重新播（由 btnReplay 控制）
        resetForPlayMode();
      }
    }

    // ====== 初始化判笔 ======
    function initTrace(svgEl) {
      traceApi = null;

      // 没有 StrokeTrace 也不报错（只是无法判笔）
      if (!window.StrokeTrace?.initTraceMode) return;

      try {
        traceApi = window.StrokeTrace.initTraceMode({
          viewport,
          svg: svgEl,
          getColor: () => "#ff3b30",
          getSize: () => 8,

          // ✅ 写对一笔：doneCount++，直接变鲜艳（done），并更新下一个笔高亮
          onStrokeCorrect: () => {
            doneCount = Math.min(doneCount + 1, strokeEls.length);
            refreshProgress();

            // ✅ 全部完成：不提示，只显示重写 ↻
            if (doneCount >= strokeEls.length) {
              showRedo();
            }
          },

          onAllComplete: () => {
            // 有些实现会同时触发这个，我们兜底保证出现 ↻
            showRedo();
          }
        });

        // 默认关闭，等用户点 따라쓰기
        traceApi?.setEnabled?.(false);
      } catch {
        traceApi = null;
      }
    }

    // ====== 笔顺播放（逐笔完成变鲜艳）=====
    // 兼容两种情况：
    // A) 你有 window.StrokePlayerLib / window.StrokeAnimator 之类（你自己项目里的 strokePlayer.js）
    // B) 没有播放库：就只显示静态字（但描红仍可用）
    function playStrokeDemo() {
      if (!svg) return;

      // 每次播放前清空为 dim
      resetForPlayMode();

      // ✅ 如果你项目里有“逐笔播放”的函数，把它接进来就行：
      // 下面是最通用的“约定式”接口：
      // - window.StrokePlayerLib.play(svg, { onStep(i), onDone() })
      const lib = window.StrokePlayerLib || window.StrokeAnimator || window.StrokePlayerEngine;

      if (lib?.play) {
        try {
          lib.play(svg, {
            onStep: (i) => {
              // i: 0-based，表示刚完成第 i 笔
              doneCount = Math.min(i + 1, strokeEls.length);
              refreshProgress();
            },
            onDone: () => {
              // 播放结束：全部鲜艳
              doneCount = strokeEls.length;
              refreshProgress();
            }
          });
          return;
        } catch {}
      }

      // ✅ 如果没有播放库：就直接把整字变鲜艳（不做动画）
      doneCount = strokeEls.length;
      refreshProgress();
    }

    // ====== 加载某个字 ======
    async function loadChar(ch, { bust = false } = {}) {
      currentChar = ch;
      hideRedo();

      // 切换字：描红先关掉（避免状态混乱）
      tracingOn = false;
      btnTrace?.classList.remove("trace-btn-on");

      // 清空
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

        // ✅ 不做缩放拖拽：固定尺寸
        svg.style.width = "88%";
        svg.style.height = "88%";

        strokeEls = getStrokeEls(svg);

        // ✅ 加序号层（默认隐藏；进入描红时才显示）
        window.StrokePlayerCanvas?.addStrokeNumbers?.(svg, strokeEls, { defaultVisible: false });

        // ✅ 初始化判笔（但默认关闭）
        initTrace(svg);

        // ✅ 默认加载后：先播放一次笔顺（逐笔变鲜艳）
        playStrokeDemo();
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
    btnReplay?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 如果正在描红，先关掉描红（用户点“再次”多半想看笔顺）
      if (tracingOn) {
        setTraceEnabled(false);
      }
      playStrokeDemo();
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

      // 强制保持描红开启
      tracingOn = true;
      btnTrace?.classList.add("trace-btn-on");

      resetForTraceMode();
      try { traceApi?.clearCurrent?.(); } catch {}
      traceApi?.setEnabled?.(true);
    });
  }

  window.StrokePlayer = { mountStrokeSwitcher };
})();
