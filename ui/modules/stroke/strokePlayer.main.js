// /ui/modules/stroke/strokePlayer.main.js
// ✅ 完善不返工版（ES Module）
// - 统一使用 strokeDemo：playAll / playOne / stop
// - 따라쓰기：自动示范一笔 -> 再允许学生写
// - 统一 import：tpl / canvas / trace / demo

import { renderStrokePlayerTpl } from "./strokePlayer.tpl.js";
import {
  addStrokeNumbers,
  setNumberLayerVisible,
  resetTraceState,
  setProgress,
} from "./strokePlayer.canvas.js";
import { initTraceMode } from "./strokeTrace.js";
import { playAll, playOne, stop as stopDemo } from "./strokeDemo.js";

/** =========================
 * One-time styles
 ========================= */
const STYLE_ID = "stroke-trace-style-v7";
function ensureStyleOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement("style");
  st.id = STYLE_ID;
  st.textContent = `
    .trace-stroke-dim  { stroke: rgba(0,0,0,.18) !important; fill: rgba(0,0,0,.18) !important; opacity: 1 !important; }
    .trace-stroke-on   { stroke: #ff3b30 !important; fill: #ff3b30 !important; opacity: 1 !important; }
    .trace-stroke-done { stroke: #ff3b30 !important; fill: #ff3b30 !important; opacity: 1 !important; }

    .trace-num { font-size: 16px; font-weight: 800; fill: rgba(0,0,0,.35); }
    .trace-num-on { fill: #ff3b30 !important; }
    .trace-num-done { fill: rgba(255,59,48,.85) !important; }

    .trace-btn-on { background:#fb923c !important; color:#fff !important; }
  `;
  document.head.appendChild(st);
}

export function mountStrokeSwitcher(targetEl, hanChars) {
  ensureStyleOnce();
  if (!targetEl) return;

  const chars = Array.from(hanChars || []).filter(Boolean);
  if (!chars.length) {
    targetEl.innerHTML = `<div class="text-sm text-gray-500">표시할 글자가 없어요.</div>`;
    return;
  }

  // template
  targetEl.innerHTML = renderStrokePlayerTpl();

  const btnWrap = targetEl.querySelector("#strokeBtns");
  const stage = targetEl.querySelector("#strokeStage");
  const viewport = targetEl.querySelector("#strokeViewport");
  const fileNameEl = targetEl.querySelector("#strokeFileName");

  const btnSpeak = targetEl.querySelector(".btnSpeak");
  const btnReplay = targetEl.querySelector(".btnReplay");
  const btnTrace = targetEl.querySelector(".btnTrace");
  const btnRedo = targetEl.querySelector(".btnRedo");

  let currentChar = chars[0];

  // state
  let tracingOn = false;
  let traceApi = null;

  let svg = null;
  let strokeEls = [];
  let doneCount = 0;

  function strokeUrl(ch) {
    return window.DATA_PATHS?.strokeUrl?.(ch) || "";
  }
  function fileName(ch) {
    return window.DATA_PATHS?.strokeFileNameForChar?.(ch) || "";
  }

  function getStrokeEls(svgEl) {
    if (!svgEl) return [];
    return Array.from(svgEl.querySelectorAll("path"));
  }

  function hideRedo() { btnRedo?.classList.add("hidden"); }
  function showRedo() { btnRedo?.classList.remove("hidden"); }

  function refreshProgress() {
    if (!svg) return;
    setProgress({ svg, strokeEls, doneCount });
  }

  function resetForTraceMode() {
    doneCount = 0;
    hideRedo();
    if (!svg) return;
    resetTraceState({ svg, strokeEls });
    setNumberLayerVisible(svg, true);
    refreshProgress();
  }

  function resetForPlayMode() {
    doneCount = 0;
    hideRedo();
    if (!svg) return;
    resetTraceState({ svg, strokeEls });
    setNumberLayerVisible(svg, false);
    refreshProgress();
  }

  function setTraceEnabled(on) {
    tracingOn = !!on;
    btnTrace?.classList.toggle("trace-btn-on", tracingOn);

    if (!svg) return;

    if (tracingOn) {
      // ✅ 进入描红：停止 demo + 重置 + 先示范一笔，再开启判笔
      stopDemo();
      resetForTraceMode();

      // 先不让写
      traceApi?.setEnabled?.(false);

      // ✅ 自动示范第一笔（或当前 doneCount 对应笔）
      const idx = Math.min(doneCount, Math.max(0, strokeEls.length - 1));
      playOne({ svg, strokeEls, index: idx, speed: 1.0 }).finally(() => {
        // 示范后允许学生写
        traceApi?.setEnabled?.(true);
      });
    } else {
      // ✅ 退出描红：停判笔 + 回到播放模式（不自动播）
      traceApi?.setEnabled?.(false);
      setNumberLayerVisible(svg, false);
      resetForPlayMode();
    }
  }

  function initTrace(svgEl) {
    try { traceApi?.destroy?.(); } catch {}
    traceApi = null;

    try {
      traceApi = initTraceMode({
        viewport,
        svg: svgEl,
        getColor: () => "#ff3b30",
        getSize: () => 8,

        onStrokeCorrect: ({ index }) => {
          // index 是“当前笔之前的 index”，这里我们用 doneCount 自增最直观
          doneCount = Math.min(doneCount + 1, strokeEls.length);
          refreshProgress();
          if (doneCount >= strokeEls.length) showRedo();
        },

        onAllComplete: () => {
          showRedo();
        },
      });

      traceApi?.setEnabled?.(false);
    } catch (e) {
      traceApi = null;
      console.warn("initTraceMode failed:", e);
    }
  }

  async function autoplayAll() {
    if (!svg || !strokeEls.length) return;

    stopDemo();
    resetForPlayMode();

    // playAll 中：每笔开始会回调 onStroke(i)
    await playAll({
      svg,
      strokeEls,
      speed: 1.0,
      onStroke: (i) => {
        doneCount = i;
        refreshProgress();
      },
      showNumbersAfter: true,
    });

    // 播放完成
    doneCount = strokeEls.length;
    refreshProgress();
  }

  async function loadChar(ch, { bust = false } = {}) {
    currentChar = ch;
    hideRedo();
    stopDemo();

    // 切换字：先关描红
    tracingOn = false;
    btnTrace?.classList.remove("trace-btn-on");

    try { traceApi?.destroy?.(); } catch {}
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

      // number layer
      addStrokeNumbers(svg, strokeEls, { defaultVisible: false });

      // init trace judge
      initTrace(svg);

      // ✅ 默认：自动播放全部
      await autoplayAll();
    } catch (e) {
      console.error(e);
      stage.innerHTML = `<div class="text-sm text-red-600">로드 실패</div>`;
    }
  }

  // ----- char buttons -----
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

  // ----- top buttons -----
  btnSpeak?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AIUI?.speak?.(currentChar, "zh-CN");
  });

  // 다시：重新播放（播放模式）
  btnReplay?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (tracingOn) setTraceEnabled(false);
    await autoplayAll();
  });

  // 따라쓰기：进入/退出描红（进入时先示范一笔）
  btnTrace?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setTraceEnabled(!tracingOn);
  });

  // ↻：重写（清空并继续描红）
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
