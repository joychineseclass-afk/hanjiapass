// /ui/modules/stroke/strokePlayer.main.js
// ✅ 完善不返工版（ES Module）
// - 自动播放 + 字面序号 + 描红判笔
// - 统一 import：tpl / canvas / trace
// - 无提示/不闪红绿块（判笔错误直接清空重写）
// - 支持重复练习（↻）
// - 保留你现有 UI 结构和交互（避免返工）

import { renderStrokePlayerTpl } from "./strokePlayer.tpl.js";
import {
  addStrokeNumbers,
  setNumberLayerVisible,
  resetTraceState,
  setProgress,
} from "./strokePlayer.canvas.js";
import { initTraceMode } from "./strokeTrace.js";

/** =========================
 * One-time styles
 ========================= */
const STYLE_ID = "stroke-trace-style-v6";
function ensureStyleOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement("style");
  st.id = STYLE_ID;
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

/** =========================
 * Public mount
 * targetEl: container element
 * hanChars: array of chars
 ========================= */
export function mountStrokeSwitcher(targetEl, hanChars) {
  ensureStyleOnce();
  if (!targetEl) return;

  const chars = Array.from(hanChars || []).filter(Boolean);
  if (!chars.length) {
    targetEl.innerHTML = `<div class="text-sm text-gray-500">표시할 글자가 없어요.</div>`;
    return;
  }

  // 1) template
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

  /** =========================
   * Mode state
   ========================= */
  let tracingOn = false; // 따라쓰기 on/off
  let traceApi = null;   // trace mode API
  let svg = null;        // current svg element
  let strokeEls = [];    // stroke paths
  let doneCount = 0;     // completed strokes

  // Demo playback state
  let demoStopFlag = false;
  let demoTimer = null;

  function stopDemo() {
    demoStopFlag = true;
    if (demoTimer) {
      clearTimeout(demoTimer);
      demoTimer = null;
    }
  }

  /** =========================
   * Paths
   ========================= */
  function strokeUrl(ch) {
    return window.DATA_PATHS?.strokeUrl?.(ch) || "";
  }
  function fileName(ch) {
    return window.DATA_PATHS?.strokeFileNameForChar?.(ch) || "";
  }

  // 更稳的“按顺序取笔画”
  function getStrokeEls(svgEl) {
    if (!svgEl) return [];
    // 默认 path 顺序就是笔顺顺序（你的数据集基本如此）
    return Array.from(svgEl.querySelectorAll("path"));
  }

  function hideRedo() {
    btnRedo?.classList.add("hidden");
  }
  function showRedo() {
    btnRedo?.classList.remove("hidden");
  }

  /** =========================
   * Progress refresh
   ========================= */
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
      // 进入描红：停止动画 + 整字浅灰 + 显示序号
      stopDemo();
      resetForTraceMode();
      traceApi?.setEnabled?.(true);
    } else {
      // 退出描红：隐藏序号 + 停止判笔 + 回到播放模式（不自动播）
      traceApi?.setEnabled?.(false);
      setNumberLayerVisible(svg, false);
      resetForPlayMode();
    }
  }

  /** =========================
   * Init trace judge
   ========================= */
  function initTrace(svgEl) {
    // destroy old
    try { traceApi?.destroy?.(); } catch {}
    traceApi = null;

    try {
      traceApi = initTraceMode({
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
        },
      });

      traceApi?.setEnabled?.(false);
    } catch (e) {
      traceApi = null;
      // 不抛，让播放器还能播 demo
      console.warn("initTraceMode failed:", e);
    }
  }

  /** =========================
   * Demo playback: draw strokes by dashoffset
   ========================= */
  async function playStrokeDemo({ speed = 1.0 } = {}) {
    if (!svg || !strokeEls.length) return;

    stopDemo(); // 防止重入
    demoStopFlag = false;

    // 播放模式：先清空到浅灰
    resetForPlayMode();

    // 让每笔用 stroke 来画
    strokeEls.forEach((p) => {
      p.style.fill = "none";
      p.style.stroke = "#111";
      p.style.strokeWidth = "8";
      p.style.strokeLinecap = "round";
      p.style.strokeLinejoin = "round";
      p.style.transition = "";
      p.style.strokeDasharray = "";
      p.style.strokeDashoffset = "";
    });

    for (let i = 0; i < strokeEls.length; i++) {
      if (demoStopFlag) return;

      const p = strokeEls[i];

      // 当前笔高亮
      doneCount = i;
      refreshProgress();
      p.classList.add("trace-stroke-on");

      // dash animation
      let L = 0;
      try { L = p.getTotalLength(); } catch { L = 300; }
      L = Math.max(80, Math.min(2000, L));

      p.style.strokeDasharray = `${L}`;
      p.style.strokeDashoffset = `${L}`;
      // force reflow
      p.getBoundingClientRect();

      const baseMs = 420;
      const dur = Math.round((baseMs + L * 0.55) / Math.max(0.2, speed));

      p.style.transition = `stroke-dashoffset ${dur}ms linear`;
      p.style.stroke = "#ff3b30";
      p.style.strokeDashoffset = "0";

      await new Promise((resolve) => {
        demoTimer = setTimeout(resolve, dur + 40);
      });

      if (demoStopFlag) return;

      // 完成这一笔
      p.classList.remove("trace-stroke-on");
      p.classList.add("trace-stroke-done");

      doneCount = i + 1;
      refreshProgress();
    }

    // 播放结束：显示数字层（你要“顺序标在字面上”）
    setNumberLayerVisible(svg, true);
    refreshProgress();
  }

  /** =========================
   * Load char
   ========================= */
  async function loadChar(ch, { bust = false } = {}) {
    currentChar = ch;
    hideRedo();
    stopDemo();

    // 切换字：描红先关掉
    tracingOn = false;
    btnTrace?.classList.remove("trace-btn-on");

    // 清状态
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

      // 加序号层（默认隐藏）
      addStrokeNumbers(svg, strokeEls, { defaultVisible: false });

      // 初始化判笔（默认关闭）
      initTrace(svg);

      // 默认加载后：自动播放一次
      await playStrokeDemo({ speed: 1.0 });
    } catch (e) {
      console.error(e);
      stage.innerHTML = `<div class="text-sm text-red-600">로드 실패</div>`;
    }
  }

  /** =========================
   * Char buttons
   ========================= */
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

  /** =========================
   * Top buttons
   ========================= */
  btnSpeak?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 你原来就是这样：如果 AIUI 没有 speak，不会报错
    window.AIUI?.speak?.(currentChar, "zh-CN");
  });

  // 다시：重新播放（播放模式）
  btnReplay?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (tracingOn) setTraceEnabled(false);
    await playStrokeDemo({ speed: 1.0 });
  });

  // 따라쓰기：进入/退出描红
  btnTrace?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setTraceEnabled(!tracingOn);
  });

  // ↻：重写（直接清空并继续描红）
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
