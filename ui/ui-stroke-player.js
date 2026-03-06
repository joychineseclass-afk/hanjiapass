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
    trace: "따라쓰기",
    noChars: "표시할 한자가 없습니다.",
    speakFail: "읽기 기능을 사용할 수 없습니다.",
    traceOnMsg: "따라쓰기를 시작해 보세요.",
    traceOffMsg: "따라쓰기를 종료했어요."
  },
  cn: {
    title: "汉字笔顺",
    speak: "读音",
    trace: "跟写",
    noChars: "没有可显示的汉字",
    speakFail: "读音功能不可用",
    traceOnMsg: "请开始跟写。",
    traceOffMsg: "已关闭跟写。"
  },
  en: {
    title: "Stroke Order",
    speak: "Speak",
    trace: "Trace",
    noChars: "No characters to display.",
    speakFail: "Speak is unavailable",
    traceOnMsg: "Start tracing.",
    traceOffMsg: "Tracing off."
  }
};

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function cssEscape(s) {
  return String(s).replace(/"/g, '\\"');
}
function normalizeChars(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(String).map((s) => s.trim()).filter(Boolean);
  }
  const s = String(input);
  return Array.from(s).filter((ch) => /[\u3400-\u9FFF]/.test(ch));
}

async function speakZhCN(text) {
  const t = String(text || "").trim();
  if (!t) return;

  try { speechSynthesis.cancel(); } catch {}

  const voices = await new Promise((resolve) => {
    const v = speechSynthesis.getVoices?.() || [];
    if (v.length) return resolve(v);

    const on = () => {
      try { speechSynthesis.removeEventListener?.("voiceschanged", on); } catch {}
      resolve(speechSynthesis.getVoices?.() || []);
    };

    speechSynthesis.addEventListener?.("voiceschanged", on);

    setTimeout(() => {
      try { speechSynthesis.removeEventListener?.("voiceschanged", on); } catch {}
      resolve(speechSynthesis.getVoices?.() || []);
    }, 300);
  });

  const u = new SpeechSynthesisUtterance(t);
  u.lang = "zh-CN";

  const pick =
    voices.find(v => (v.lang || "").toLowerCase().startsWith("zh-cn") && /mandarin|普通话|chinese/i.test(v.name || "")) ||
    voices.find(v => (v.lang || "").toLowerCase().startsWith("zh-cn")) ||
    voices.find(v => (v.lang || "").toLowerCase().startsWith("zh"));

  if (pick) u.voice = pick;

  speechSynthesis.speak(u);
}

function t(key) {
  const lang = getLang();
  const k = { kr: "ko", cn: "zh" }[lang] || lang;
  try {
    const v = i18n?.t?.(key);
    if (v) return v;
  } catch {}
  const FALLBACK = {
    stroke_demo: { ko: "데모", zh: "演示", en: "Demo" },
    stroke_practice: { ko: "연습", zh: "练习", en: "Practice" },
    stroke_btn_replay: { ko: "다시", zh: "重播", en: "Replay" },
    stroke_btn_speak: { ko: "발음", zh: "读音", en: "Speak" },
    stroke_btn_trace: { ko: "따라쓰기", zh: "跟写", en: "Trace" },
    stroke_write_here: { ko: "여기에 쓰기 ✍️", zh: "在这里写字 ✍️", en: "Write here ✍️" },
    stroke_missing_data: { ko: "이 글자의 필순 데이터가 아직 없어요.", zh: "该字暂未收录笔画数据", en: "Stroke data not yet available." },
    stroke_continue_practice: { ko: "연습 계속", zh: "继续练习(无笔顺)", en: "Continue practice" },
    stroke_feedback_char: { ko: "글자 추가 요청", zh: "反馈缺字", en: "Request character" },
  };
  return FALLBACK[key]?.[k] || FALLBACK[key]?.en || key;
}

// ✅ 只注入一次：保证 traceCanvas 永远在最上层，不会被 SVG 吃事件
function ensureTraceLayerCSS() {
  if (document.getElementById("trace-layer-lock")) return;
  const st = document.createElement("style");
  st.id = "trace-layer-lock";
  st.textContent = `
    .stroke-page { display: flex; gap: 24px; flex-wrap: wrap; min-height: 0; }
    #strokeDemoPanel { flex: 1; min-width: 280px; height: 420px; min-height: 280px; display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; padding: 16px; position: relative; pointer-events: auto; overflow: hidden; }
    #strokeDemoPanel * { pointer-events: none; }
    #strokeDemoPanel button, #strokeDemoPanel a { pointer-events: auto; }
    #strokePracticePanel { flex: 1; min-width: 280px; height: 420px; min-height: 280px; display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; padding: 16px; position: relative; overflow: hidden; }
    .stroke-panel-title { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 8px; }
    .stroke-card-inner.embed-mode { padding: 8px !important; }
    .stroke-card-inner.embed-mode .stroke-page { flex: 1; min-height: 0; gap: 12px; }
    .stroke-card-inner.embed-mode #strokeDemoPanel,
    .stroke-card-inner.embed-mode #strokePracticePanel { height: auto; flex: 1; min-height: 180px; padding: 10px; }
    .stroke-card-inner.embed-mode .flex.items-center.justify-between { margin-bottom: 6px !important; }
    .stroke-card-inner.embed-mode .embed-practice-tools { margin-bottom: 6px !important; }
    @media (max-width: 640px) { .stroke-page { flex-direction: column; } #strokeDemoPanel, #strokePracticePanel { min-height: 320px; height: auto; } }
    #strokePlayerHost { flex: 1; position: relative; width: 100%; min-height: 0; display: flex; align-items: center; justify-content: center; }
    #traceBoard { flex: 1; position: relative; width: 100%; min-height: 0; overflow: hidden; }
    #traceGridCanvas { position: absolute; inset: 0; background-image: linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px); background-size: 20px 20px; background-color: #fff; pointer-events: none; }
    #traceDrawCanvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
    .stroke-write-hint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: #94a3b8; font-size: 14px; }
    .stroke-write-hint.hidden { opacity: 0; transition: opacity 0.2s; }
    .stroke-zoom-label { position: absolute; right: 8px; bottom: 8px; font-size: 11px; color: #64748b; background: rgba(255,255,255,.9); padding: 4px 8px; border-radius: 6px; }
    .stroke-msg { position: absolute; left: 8px; bottom: 8px; font-size: 11px; color: #64748b; background: rgba(255,255,255,.9); padding: 4px 8px; border-radius: 6px; }
    .stroke-msg.hidden { display: none !important; }
    .stroke-fallback-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; justify-content: center; }
    .stroke-fallback-actions button { padding: 6px 12px; border-radius: 8px; font-size: 13px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; }
    .stroke-fallback-actions button:hover { background: #f1f5f9; }
  `;
  document.head.appendChild(st);
}

export function mountStrokeSwitcher(targetEl, hanChars, opts = {}) {
  if (!targetEl) return;

  const embed = !!opts.embed;

  // ✅ 清理旧监听（防止重复绑定导致越写越卡）
  try { targetEl._strokeCleanup?.(); } catch {}

  ensureTraceLayerCSS();

  let lang = getLang();
  let T = UI_TEXT[lang] || UI_TEXT.kr;

  const chars = normalizeChars(hanChars);
  if (!chars.length) {
    targetEl.innerHTML = `<div class="text-sm text-gray-500">${T.noChars}</div>`;
    return;
  }

  const replayLabel = t("stroke_btn_replay");
  const speakLabel = t("stroke_btn_speak");
  const traceLabel = t("stroke_btn_trace");
  const writeHere = t("stroke_write_here");
  const demoTitle = t("stroke_demo");
  const practiceTitle = t("stroke_practice");

  const topRow = embed
    ? `<div class="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <div class="flex flex-wrap gap-2" id="strokeBtns"></div>
        <div class="flex gap-2 justify-end items-center">
          <button class="btnReplay px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${replayLabel}</button>
          <button class="btnSpeak px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${speakLabel}</button>
          <button class="btnTrace px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${traceLabel}</button>
        </div>
      </div>`
    : `<div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div class="font-semibold strokeTitle">${T.title}</div>
        <div class="flex gap-2 flex-wrap justify-end items-center">
          <button class="btnReplay px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${replayLabel}</button>
          <button class="btnSpeak px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${speakLabel}</button>
          <button class="btnTrace px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${traceLabel}</button>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 mb-3" id="strokeBtns"></div>`;
  const panelTitle = (label) => embed ? "" : `<div class="stroke-panel-title">${label}</div>`;

  targetEl.innerHTML = `
    <div class="border rounded-2xl p-3 bg-white shadow-sm stroke-card-inner${embed ? " embed-mode" : ""}">
      ${topRow}

      <div class="stroke-page">
        <div id="strokeDemoPanel">
          ${panelTitle(demoTitle)}
          <div id="strokePlayerHost">
            <div id="strokeStage" class="w-full h-full flex items-center justify-center text-gray-400 p-3 text-center text-sm">loading...</div>
            <div id="strokeZoomLabel" class="stroke-zoom-label">100%</div>
            <div id="strokeMsg" class="stroke-msg hidden"></div>
          </div>
        </div>

        <div id="strokePracticePanel">
          ${panelTitle(practiceTitle)}
          <div class="flex items-center gap-2 flex-wrap mb-1 embed-practice-tools">
            <select id="penColor" class="px-2 py-1 border rounded-lg text-sm">
              <option value="#FB923C">🟠</option>
              <option value="#3B82F6">🔵</option>
              <option value="#111827">⚫</option>
              <option value="#22C55E">🟢</option>
              <option value="#EF4444">🔴</option>
            </select>
            <input id="penWidth" type="range" min="2" max="18" value="8" style="width:80px;" />
            <button id="btnClearPractice" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">✕</button>
          </div>
          <div id="traceBoard">
            <div id="traceGridCanvas"></div>
            <div id="strokeWriteHint" class="stroke-write-hint">${writeHere}</div>
            <canvas id="traceDrawCanvas"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;

  // ===== DOM refs =====
  const btnWrap = targetEl.querySelector("#strokeBtns");
  const stage = targetEl.querySelector("#strokeStage");
  const zoomLabel = targetEl.querySelector("#strokeZoomLabel");
  const msgEl = targetEl.querySelector("#strokeMsg");

  const traceDrawCanvas = targetEl.querySelector("#traceDrawCanvas");
  const writeHint = targetEl.querySelector("#strokeWriteHint");
  const traceBoard = targetEl.querySelector("#traceBoard");
  const penColorEl = targetEl.querySelector("#penColor");
  const penWidthEl = targetEl.querySelector("#penWidth");
  const btnClearPractice = targetEl.querySelector("#btnClearPractice");

  const btnTrace = targetEl.querySelector(".btnTrace");
  const btnSpeak = targetEl.querySelector(".btnSpeak");
  const btnReplay = targetEl.querySelector(".btnReplay");

  // ===== state =====
  let currentChar = chars[0];
  let scale = 1, tx = 0, ty = 0;
  let activeBtn = null;
  let tracingOn = false;

  const showMsg = (text, ms = 1600) => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.classList.remove("hidden");
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => msgEl.classList.add("hidden"), ms);
  };

  if (traceDrawCanvas) traceDrawCanvas.style.pointerEvents = "auto";

  function updateZoomLabel() {
    if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  function applyTransform() {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;
    svg.style.transformOrigin = "center center";
    svg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    updateZoomLabel();
  }

  function resetView() {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
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
    if (btnSpeak) btnSpeak.textContent = t("stroke_btn_speak");
    if (btnTrace) btnTrace.textContent = t("stroke_btn_trace");
    if (btnReplay) btnReplay.textContent = t("stroke_btn_replay");
  }

  /** 重播笔顺动画（克隆 SVG 触发 CSS 动画重启） */
  function restartAnimation() {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;
    const parent = svg.parentNode;
    if (!parent) return;
    const clone = svg.cloneNode(true);
    parent.replaceChild(clone, svg);
    applyTransform();
    if (tracingOn) {
      try { teaching?.start?.(); } catch {}
    }
  }

  // ===== drawing 仅绑定到 #traceDrawCanvas，与 #strokePlayerHost 完全分离 =====
  const practiceApi = initTraceCanvasLayer(traceDrawCanvas, {
    enabledDefault: true,
    tracingDefault: true,
    autoAdvanceIndex: true,
    penColor: "#FB923C",
    lineWidth: Number(penWidthEl?.value || 8),
    alpha: 0.9
  });

  practiceApi.toggle(true);
  practiceApi.setEnabled(true);

  const teaching = initStrokeTeaching(targetEl, stage, practiceApi, traceDrawCanvas);

  const onStrokeEnd = (e) => {
    teaching?.onUserStrokeDone?.(e?.detail);
  };
  traceDrawCanvas?.addEventListener("trace:strokeend", onStrokeEnd);

  const hideWriteHint = () => { writeHint?.classList.add("hidden"); };
  traceDrawCanvas?.addEventListener("pointerdown", hideWriteHint, { once: false });
  traceDrawCanvas?.addEventListener("touchstart", hideWriteHint, { passive: true });

  if (traceBoard && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => { window.dispatchEvent(new Event("resize")); });
    ro.observe(traceBoard);
    targetEl._strokeResizeObs = ro;
  }

  // ===== UI controls =====
  penColorEl?.addEventListener("change", () => {
    practiceApi.setPenColor(penColorEl.value);
  });

  penWidthEl?.addEventListener("input", () => {
    practiceApi.setPenWidth(Number(penWidthEl.value) || 8);
  });

  btnClearPractice?.addEventListener("click", () => {
    practiceApi.clear();
    writeHint?.classList.remove("hidden");
  });

  // ===== load SVG =====
  async function loadChar(ch, { reset = true, speak = false } = {}) {
    currentChar = ch;

    // highlight
    if (activeBtn) {
      activeBtn.classList.remove("bg-slate-900", "text-white", "border-slate-900");
    }
    const btn = btnWrap.querySelector(`[data-ch="${cssEscape(ch)}"]`);
    if (btn) {
      btn.classList.add("bg-slate-900", "text-white", "border-slate-900");
      activeBtn = btn;
    }

    practiceApi.clear?.();
    practiceApi.setStrokeIndex?.(0);

    // if tracing mode on, restart teaching
    if (tracingOn) {
      try { teaching?.start?.(); } catch {}
    }

    if (reset) resetView();

    const url = strokeUrl(ch);
    const missingMsg = t("stroke_missing_data");
    const continueBtn = t("stroke_continue_practice");
    const feedbackBtn = t("stroke_feedback_char");

    const renderFallback = (msg) => {
      stage.innerHTML = `
        <div class="text-amber-700 text-sm p-4 text-center max-w-[260px]">
          <div class="opacity-90">${escapeHtml(msg)}</div>
          <div class="stroke-fallback-actions">
            <button type="button" class="btnFallbackContinue">${escapeHtml(continueBtn)}</button>
            <button type="button" class="btnFallbackFeedback">${escapeHtml(feedbackBtn)}</button>
          </div>
        </div>`;
      stage.querySelector(".btnFallbackContinue")?.addEventListener("click", () => { practiceApi.clear?.(); writeHint?.classList.remove("hidden"); });
      stage.querySelector(".btnFallbackFeedback")?.addEventListener("click", () => { window.open("https://github.com/", "_blank"); });
    };

    if (!url) {
      renderFallback(missingMsg);
      return;
    }

    stage.innerHTML = `<span class="opacity-70">${typeof i18n?.t === "function" ? i18n.t("common_loading") : "loading..."}</span>`;

    try {
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now());
      if (!res.ok) throw new Error("HTTP_" + res.status);

      const svgText = await res.text();
      stage.innerHTML = svgText;

      const svg = stage.querySelector("svg");
      if (svg) {
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.maxWidth = "320px";
        svg.style.maxHeight = "320px";
        svg.style.display = "block";
        svg.style.margin = "0 auto";
      }

      applyTransform();

      if (speak) {
        try {
          await speakZhCN(ch);
        } catch {
          showMsg(T.speakFail);
        }
      }
    } catch (e) {
      renderFallback(missingMsg);
    }
  }

  // ===== char buttons =====
  btnWrap.innerHTML = "";
  chars.forEach((ch, i) => {
    const b = document.createElement("button");
    b.className =
      "px-3 py-1 rounded-lg border text-sm bg-white hover:bg-slate-50 transition";
    b.textContent = ch;
    b.setAttribute("data-ch", ch);

    // ✅ 多字：点哪个字 -> load + speak
    b.onclick = () => loadChar(ch, { reset: true, speak: true });

    btnWrap.appendChild(b);

    if (i === 0) queueMicrotask(() => loadChar(ch, { reset: true, speak: false }));
  });

  // ===== top buttons =====
  btnReplay?.addEventListener("click", () => restartAnimation());

  btnSpeak.onclick = async () => {
    try {
      await speakZhCN(currentChar);
    } catch {
      showMsg(T.speakFail);
    }
  };

  // 따라쓰기：仅右侧练习区 trace 状态，左侧 demo 永不变
  btnTrace.onclick = () => {
    tracingOn = !tracingOn;
    practiceApi.setStrokeIndex?.(0);
    if (tracingOn) {
      btnTrace.classList.add("bg-orange-400", "text-white");
      practiceApi.setEnabled(true);
      if (traceDrawCanvas) traceDrawCanvas.style.pointerEvents = "auto";
      try { teaching?.start?.(); } catch {}
      showMsg(T.traceOnMsg);
    } else {
      try { teaching?.stop?.(); } catch {}
      practiceApi.setEnabled(true);
      if (traceDrawCanvas) traceDrawCanvas.style.pointerEvents = "auto";
      btnTrace.classList.remove("bg-orange-400", "text-white");
      showMsg(T.traceOffMsg);
    }
  };

  // ===== language =====
  const onLangChanged = () => applyLangText();
  window.addEventListener("joy:langchanged", onLangChanged);

  // ===== cleanup =====
  targetEl._strokeCleanup = () => {
    try { window.removeEventListener("joy:langchanged", onLangChanged); } catch {}
    try { traceDrawCanvas?.removeEventListener("trace:strokeend", onStrokeEnd); } catch {}
    try { teaching?.stop?.(); } catch {}
    try { practiceApi?.destroy?.(); } catch {}
    try { targetEl._strokeResizeObs?.disconnect?.(); } catch {}
  };

  applyLangText();
}
