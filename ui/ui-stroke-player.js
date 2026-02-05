// ui/ui-stroke-player.js
import { i18n } from "./i18n.js";
import { initTraceCanvasLayer } from "./ui-trace-canvas.js";
import { initStrokeTeaching } from "./ui-stroke-teaching.js";

function getLang() {
  return (
    localStorage.getItem("joy_lang") ||
    localStorage.getItem("site_lang") ||
    "kr"
  );
}

const UI_TEXT = {
  kr: {
    title: "한자 필순",
    speak: "읽기",
    replay: "다시보기",
    reset: "초기화",
    trace: "따라쓰기",
    noChars: "표시할 한자가 없습니다.",
    resetDone: "초기화 완료",
    speakFail: "읽기 기능을 사용할 수 없습니다."
  },
  cn: {
    title: "汉字笔顺",
    speak: "读音",
    replay: "重播",
    reset: "复位",
    trace: "描红",
    noChars: "没有可显示的汉字",
    resetDone: "复位完成",
    speakFail: "读音功能不可用"
  },
  en: {
    title: "Stroke Order",
    speak: "Speak",
    replay: "Replay",
    reset: "Reset",
    trace: "Trace",
    noChars: "No characters to display.",
    resetDone: "Reset done",
    speakFail: "Speak is unavailable"
  }
};

// ✅ 只注入一次：锁死描红层级与可点击
function ensureTraceCssLock() {
  if (document.getElementById("trace-css-lock")) return;

  const st = document.createElement("style");
  st.id = "trace-css-lock";
  st.textContent = `
    /* ✅ 开启描红时：canvas 必须在最上层并接收事件 */
    .trace-on #traceCanvas{
      display:block !important;
      pointer-events:auto !important;
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      z-index:9999 !important;
    }
    /* ✅ 开启描红时：下面那层不要抢事件（否则点不到 canvas） */
    .trace-on #strokeViewport{
      pointer-events:none !important;
    }
  `;
  document.head.appendChild(st);
}

export function mountStrokeSwitcher(targetEl, hanChars) {
  if (!targetEl) return;

  // ✅ 清理旧监听（防止重复绑定导致“越写越卡/重复声明”）
  try {
    targetEl._strokeCleanup?.();
  } catch {}

  ensureTraceCssLock();

  let lang = getLang();
  let T = UI_TEXT[lang] || UI_TEXT.kr;

  const chars = normalizeChars(hanChars);
  if (!chars.length) {
    targetEl.innerHTML = `<div class="text-sm text-gray-500">${T.noChars}</div>`;
    return;
  }

  targetEl.innerHTML = `
    <div class="border rounded-2xl p-3 bg-white shadow-sm">
      <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div class="font-semibold strokeTitle">${T.title}</div>

        <div class="flex gap-2 flex-wrap justify-end items-center">
          <button class="btnSpeak px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${T.speak}</button>
          <button class="btnReplay px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${T.replay}</button>
          <button class="btnReset px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${T.reset}</button>
          <button class="btnTrace px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${T.trace}</button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-3" id="strokeBtns"></div>

      <!-- ✅ 笔顺展示区 -->
      <div class="w-full aspect-square bg-slate-50 rounded-xl overflow-hidden relative select-none">
        <div id="strokeViewport" class="absolute inset-0" style="touch-action:auto;">
          <div id="strokeStage"
               class="w-full h-full flex items-center justify-center text-xs text-gray-400 p-3 text-center">
            loading...
          </div>
        </div>

        <!-- ✅ 注意：这里不要再写 hidden，隐藏交给 traceApi.toggle(false) 控制 -->
        <canvas id="traceCanvas"
                class="absolute inset-0 w-full h-full"
                style="pointer-events:none;"></canvas>

        <div id="strokeZoomLabel"
             class="absolute right-2 bottom-2 text-[11px] text-gray-500 bg-white/80 px-2 py-1 rounded">
          100%
        </div>

        <div id="strokeMsg"
             class="absolute left-2 bottom-2 text-[11px] text-gray-500 bg-white/80 px-2 py-1 rounded hidden">
        </div>
      </div>

      <!-- ✅ 练习区（默认隐藏，点 따라쓰기 才显示） -->
      <div id="practiceWrap" class="mt-3 hidden">
        <div class="flex items-center gap-2 flex-wrap mb-2">
          <label class="text-xs text-gray-600">색상</label>
          <select id="penColor" class="px-2 py-1 border rounded-lg text-sm">
            <option value="#FB923C">주황</option>
            <option value="#3B82F6">파랑</option>
            <option value="#111827">검정</option>
            <option value="#22C55E">초록</option>
            <option value="#EF4444">빨강</option>
            <option value="#A855F7">보라</option>
          </select>

          <label class="text-xs text-gray-600 ml-2">굵기</label>
          <input id="penWidth" type="range" min="2" max="18" value="8" />

          <button id="btnClearPractice" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">
            지우기
          </button>
        </div>

        <div class="w-full aspect-square bg-white rounded-xl overflow-hidden relative border">
          <canvas id="practiceCanvas" class="absolute inset-0 w-full h-full"></canvas>
        </div>
      </div>
    </div>
  `;

  const btnWrap = targetEl.querySelector("#strokeBtns");
  const stage = targetEl.querySelector("#strokeStage");
  const viewport = targetEl.querySelector("#strokeViewport");
  const traceCanvas = targetEl.querySelector("#traceCanvas");
  const zoomLabel = targetEl.querySelector("#strokeZoomLabel");
  const msgEl = targetEl.querySelector("#strokeMsg");

  // ✅ 练习区 dom
  const practiceWrap = targetEl.querySelector("#practiceWrap");
  const practiceCanvas = targetEl.querySelector("#practiceCanvas");
  const penColorEl = targetEl.querySelector("#penColor");
  const penWidthEl = targetEl.querySelector("#penWidth");
  const btnClearPractice = targetEl.querySelector("#btnClearPractice");

  let currentChar = chars[0];
  let scale = 1, tx = 0, ty = 0;
  let activeBtn = null;

  // ✅ 描红状态只由按钮控制
  let tracingOn = false;

  const showMsg = (text, ms = 1600) => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.classList.remove("hidden");
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => msgEl.classList.add("hidden"), ms);
  };

  function updateZoomLabel() {
    if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  function applyTransform() {
    const svg = stage.querySelector("svg");
    if (!svg) return;
    svg.style.transformOrigin = "center center";
    svg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    updateZoomLabel();
  }

  function resetView() {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
    showMsg(T.resetDone);
  }

  function strokeUrl(ch) {
    const fn = window.DATA_PATHS?.strokeUrl;
    if (!fn) return "";
    return fn(ch) || "";
  }

  function applyLangText() {
    lang = getLang();
    T = UI_TEXT[lang] || UI_TEXT.kr;

    const titleEl = targetEl.querySelector(".strokeTitle");
    if (titleEl) titleEl.textContent = T.title;

    const btnSpeak = targetEl.querySelector(".btnSpeak");
    const btnReplay = targetEl.querySelector(".btnReplay");
    const btnReset = targetEl.querySelector(".btnReset");
    const btnTrace = targetEl.querySelector(".btnTrace");

    if (btnSpeak) btnSpeak.textContent = T.speak;
    if (btnReplay) btnReplay.textContent = T.replay;
    if (btnReset) btnReset.textContent = T.reset;
    if (btnTrace) btnTrace.textContent = T.trace;
  }

  function forceAllStrokesBlack() {
    const svg = stage?.querySelector("svg");
    if (!svg) return;
    const all = svg.querySelectorAll("*");
    all.forEach((el) => {
      try {
        el.style?.setProperty?.("stroke", "#111827", "important");
        el.style?.setProperty?.("fill", "#111827", "important");
      } catch {}
      try {
        const st = el.getAttribute?.("stroke");
        if (st !== "none") el.setAttribute?.("stroke", "#111827");
        const fi = el.getAttribute?.("fill");
        if (fi !== "none") el.setAttribute?.("fill", "#111827");
      } catch {}
    });
  }

  // =========================
  // ✅ 1) 笔顺描红层（跟写判定用）
  // =========================
  const traceApi = initTraceCanvasLayer(traceCanvas, {
    enabledDefault: false,
    tracingDefault: false
  });

  // 初始关闭（保证状态一致）
  traceApi.toggle(false);
  traceApi.setEnabled(false);
  traceCanvas.style.pointerEvents = "none";

  // =========================
  // ✅ 2) 教学逻辑（示范 + 推进）
  // =========================
  const teaching = initStrokeTeaching(targetEl, stage, traceApi);

  const onStrokeEnd = (e) => {
    teaching?.onUserStrokeDone?.(e?.detail);
  };
  traceCanvas.addEventListener("trace:strokeend", onStrokeEnd);

  // =========================
  // ✅ 3) 自由练习画布（不做笔画判定）
  // =========================
  const practiceApi = initTraceCanvasLayer(practiceCanvas, {
    enabledDefault: true,
    tracingDefault: true,
    penColor: "#FB923C",
    lineWidth: Number(penWidthEl?.value || 8),
    alpha: 0.9,
    autoAdvanceIndex: false
  });

  // 默认允许画（但 practiceWrap 默认 hidden，所以用户看不到）
  practiceApi.toggle(true);
  practiceApi.setEnabled(true);
  if (practiceCanvas) practiceCanvas.style.pointerEvents = "auto";

  // 颜色
  penColorEl?.addEventListener("change", () => {
    practiceApi.setPenColor(penColorEl.value);
  });

  // 粗细：用 setStyle 改线宽（你 traceApi 里没有 setPenWidth）
  penWidthEl?.addEventListener("input", () => {
    practiceApi.setStyle({ width: Number(penWidthEl.value) || 8 });
  });

  // 清空
  btnClearPractice?.addEventListener("click", () => {
    practiceApi.clear();
  });

  async function loadChar(ch, { reset = true } = {}) {
    currentChar = ch;

    if (activeBtn) {
      activeBtn.classList.remove("bg-slate-900", "text-white", "border-slate-900");
    }
    const btn = btnWrap.querySelector(`[data-ch="${cssEscape(ch)}"]`);
    if (btn) {
      btn.classList.add("bg-slate-900", "text-white", "border-slate-900");
      activeBtn = btn;
    }

    traceApi?.clear?.();
    if (reset) resetView();

    const url = strokeUrl(ch);
    if (!url) {
      stage.innerHTML = `
        <div class="text-red-600 text-sm">
          ❌ strokeUrl() 未配置或返回空<br/>
          请检查 window.DATA_PATHS.strokeUrl(ch)
        </div>`;
      return;
    }

    stage.innerHTML = `loading...`;

    try {
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now());
      if (!res.ok) throw new Error("HTTP_" + res.status);

      const svgText = await res.text();
      stage.innerHTML = svgText;

      const svg = stage.querySelector("svg");
      if (svg) {
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.maxWidth = "520px";
        svg.style.maxHeight = "520px";
        svg.style.display = "block";
        svg.style.margin = "0 auto";
      }

      applyTransform();

      // ✅ 换字时，如果正在描红：重置笔序并重新开始教学
      if (tracingOn) {
        traceApi?.setStrokeIndex?.(0);
        teaching?.start?.();
        traceCanvas.style.pointerEvents = "auto";
      }
    } catch (e) {
      stage.innerHTML = `
        <div class="text-red-600 text-sm p-3 text-center">
          ❌ 笔顺 SVG 加载失败<br/>
          <div class="opacity-80 mt-1">字：<b>${escapeHtml(ch)}</b></div>
          <div class="opacity-80 mt-1">URL：<code>${escapeHtml(url)}</code></div>
        </div>`;
    }
  }

  // ✅ 6) 字按钮
  btnWrap.innerHTML = "";
  chars.forEach((ch, i) => {
    const b = document.createElement("button");
    b.className = "px-3 py-1 rounded-lg border text-sm bg-white hover:bg-slate-50 transition";
    b.textContent = ch;
    b.setAttribute("data-ch", ch);
    b.onclick = () => loadChar(ch, { reset: true });
    btnWrap.appendChild(b);

    if (i === 0) queueMicrotask(() => loadChar(ch, { reset: true }));
  });

  // ✅ 7) 顶部按钮
  const btnReplay = targetEl.querySelector(".btnReplay");
  const btnReset = targetEl.querySelector(".btnReset");
  const btnTrace = targetEl.querySelector(".btnTrace");
  const btnSpeak = targetEl.querySelector(".btnSpeak");

  btnReplay.onclick = () => loadChar(currentChar, { reset: false });
  btnReset.onclick = () => resetView();

  // ✅ 따라쓰기：开启/关闭 “示范+跟写” + 显示/隐藏 “自由练习”
  btnTrace.onclick = () => {
    tracingOn = !tracingOn;

    // 用 class 锁死 CSS（最可靠）
    targetEl.classList.toggle("trace-on", tracingOn);

    if (tracingOn) {
      // 1) 打开描红层
      traceApi?.toggle?.(true);
      traceApi?.setEnabled?.(true);
      traceCanvas.style.pointerEvents = "auto";

      // 2) 开始教学（示范第一笔 → 解锁让写）
      traceApi?.setStrokeIndex?.(0);
      teaching?.start?.();

      // 3) 显示自由练习区
      practiceWrap?.classList.remove("hidden");

      // 4) 按钮高亮
      btnTrace.classList.add("bg-orange-400", "text-white", "hover:bg-orange-500");
    } else {
      // 关闭教学 + 描红
      try { teaching?.stop?.(); } catch {}
      try { traceApi?.setEnabled?.(false); } catch {}
      try { traceApi?.toggle?.(false); } catch {}

      traceCanvas.style.pointerEvents = "none";
      targetEl.classList.remove("trace-on");

      // 隐藏练习区
      practiceWrap?.classList.add("hidden");

      btnTrace.classList.remove("bg-orange-400", "text-white", "hover:bg-orange-500");
    }
  };

  // 发音（尽量普通话）
  btnSpeak.onclick = () => {
    try {
      // ✅ 如果你有自己的 AIUI，就优先
      if (window.AIUI?.speak) {
        window.AIUI.speak(currentChar, "zh-CN");
        return;
      }
      const u = new SpeechSynthesisUtterance(currentChar);
      u.lang = "zh-CN";
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      showMsg(T.speakFail);
    }
  };

  // 语言切换
  const onLangChanged = () => applyLangText();
  window.addEventListener("joy:langchanged", onLangChanged);

  // 完成收尾（最后一笔变黑）
  const onStrokeComplete = () => forceAllStrokesBlack();
  targetEl.addEventListener("stroke:complete", onStrokeComplete);

  // ✅ cleanup：防止重复 mount 时“声明重复/监听叠加/越来越卡”
  targetEl._strokeCleanup = () => {
    try { window.removeEventListener("joy:langchanged", onLangChanged); } catch {}
    try { targetEl.removeEventListener("stroke:complete", onStrokeComplete); } catch {}
    try { traceCanvas.removeEventListener("trace:strokeend", onStrokeEnd); } catch {}

    // 兜底：关闭描红
    try { teaching?.stop?.(); } catch {}
    try { traceApi?.setEnabled?.(false); } catch {}
    try { traceApi?.toggle?.(false); } catch {}
    try { traceCanvas.style.pointerEvents = "none"; } catch {}
    try { targetEl.classList.remove("trace-on"); } catch {}
  };
}

/* ---------------- helpers ---------------- */

function normalizeChars(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map((s) => s.trim()).filter(Boolean);

  const s = String(input);
  // ✅ 不去重：保持输入顺序（多字练习更自然）
  return Array.from(s).filter((ch) => /[\u3400-\u9FFF]/.test(ch));
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function cssEscape(s) {
  return String(s).replace(/"/g, '\\"');
}
