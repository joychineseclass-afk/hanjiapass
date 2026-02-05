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
    trace: "练习",
    noChars: "没有可显示的汉字",
    resetDone: "复位完成",
    speakFail: "读音功能不可用"
  },
  en: {
    title: "Stroke Order",
    speak: "Speak",
    replay: "Replay",
    reset: "Reset",
    trace: "Practice",
    noChars: "No characters to display.",
    resetDone: "Reset done",
    speakFail: "Speak is unavailable"
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
  if (Array.isArray(input)) return input.map(String).map((s) => s.trim()).filter(Boolean);

  const s = String(input);
  return Array.from(s).filter((ch) => /[\u3400-\u9FFF]/.test(ch));
}

// ✅ 只注入一次：锁死描红层级与可点击（演示区用）
function ensureTraceCssLock() {
  if (document.getElementById("trace-css-lock")) return;

  const st = document.createElement("style");
  st.id = "trace-css-lock";
  st.textContent = `
    /* ✅ 演示描红层始终在最上面 */
    .stroke-demo #traceCanvas{
      display:block !important;
      pointer-events:auto !important;
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      z-index:9999 !important;
    }
  `;
  document.head.appendChild(st);
}

async function speakZhCN(text) {
  try {
    const t = String(text || "").trim();
    if (!t) return;

    // 先停止旧朗读
    try { speechSynthesis.cancel(); } catch {}

    // 等 voice 列表准备好（Chrome 有时需要一次异步）
    const voices = await new Promise((resolve) => {
      const v = speechSynthesis.getVoices?.() || [];
      if (v.length) return resolve(v);
      const on = () => {
        speechSynthesis.removeEventListener?.("voiceschanged", on);
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

    // ✅ 选择更像普通话的 voice（尽量）
    const pick =
      voices.find(v => (v.lang || "").toLowerCase().startsWith("zh-cn") && /mandarin|普通话|chinese/i.test(v.name || "")) ||
      voices.find(v => (v.lang || "").toLowerCase().startsWith("zh-cn")) ||
      voices.find(v => (v.lang || "").toLowerCase().startsWith("zh"));

    if (pick) u.voice = pick;

    speechSynthesis.speak(u);
  } catch (e) {
    console.warn("[speak] failed:", e);
    throw e;
  }
}

export function mountStrokeSwitcher(targetEl, hanChars) {
  if (!targetEl) return;

  // ✅ 清理旧监听（防止重复绑定）
  try { targetEl._strokeCleanup?.(); } catch {}
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

      <!-- ✅ 上：演示区 -->
      <div class="stroke-demo w-full aspect-square bg-slate-50 rounded-xl overflow-hidden relative select-none border">
        <div id="strokeViewport" class="absolute inset-0" style="touch-action:auto;">
          <div id="strokeStage"
               class="w-full h-full flex items-center justify-center text-xs text-gray-400 p-3 text-center">
            loading...
          </div>
        </div>

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

      <!-- ✅ 下：练习区（默认隐藏） -->
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

  const practiceWrap = targetEl.querySelector("#practiceWrap");
  const practiceCanvas = targetEl.querySelector("#practiceCanvas");
  const penColorEl = targetEl.querySelector("#penColor");
  const penWidthEl = targetEl.querySelector("#penWidth");
  const btnClearPractice = targetEl.querySelector("#btnClearPractice");

  const btnReplay = targetEl.querySelector(".btnReplay");
  const btnReset = targetEl.querySelector(".btnReset");
  const btnTrace = targetEl.querySelector(".btnTrace");
  const btnSpeak = targetEl.querySelector(".btnSpeak");

  let currentChar = chars[0];
  let scale = 1, tx = 0, ty = 0;
  let activeBtn = null;

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

    if (btnSpeak) btnSpeak.textContent = T.speak;
    if (btnReplay) btnReplay.textContent = T.replay;
    if (btnReset) btnReset.textContent = T.reset;
    if (btnTrace) btnTrace.textContent = T.trace;
  }

  // ✅ 演示描红层 + 教学（你原有的）
  const traceApi = initTraceCanvasLayer(traceCanvas, {
    enabledDefault: false,
    tracingDefault: false
  });

  traceApi.toggle(false);
  traceApi.setEnabled(false);
  traceCanvas.style.pointerEvents = "none";

  const teaching = initStrokeTeaching(targetEl, stage, traceApi);

  const onStrokeEnd = (e) => {
    teaching?.onUserStrokeDone?.(e?.detail);
  };
  traceCanvas.addEventListener("trace:strokeend", onStrokeEnd);

  // ✅ 自由练习画布（独立，不做笔画判定）
  const practiceApi = initTraceCanvasLayer(practiceCanvas, {
    enabledDefault: true,
    tracingDefault: true,
    penColor: "#FB923C",
    lineWidth: Number(penWidthEl?.value || 8),
    alpha: 0.9,
    autoAdvanceIndex: false
  });

  practiceApi.toggle(true);
  practiceApi.setEnabled(true);
  practiceCanvas.style.pointerEvents = "auto";

  penColorEl?.addEventListener("change", () => {
    practiceApi.setPenColor(penColorEl.value);
  });

  penWidthEl?.addEventListener("input", () => {
    practiceApi.setPenWidth(Number(penWidthEl.value) || 8);
  });

  btnClearPractice?.addEventListener("click", () => {
    practiceApi.clear();
  });

  async function loadChar(ch, { reset = true } = {}) {
    currentChar = ch;

    if (activeBtn) activeBtn.classList.remove("bg-slate-900", "text-white", "border-slate-900");
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
        <div class="text-red-600 text-sm p-3 text-center">
          ❌ strokeUrl() 未配置或返回空<br/>
          <div class="opacity-80 mt-1">请检查 window.DATA_PATHS.strokeUrl(ch)</div>
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

      // ✅ 每次换字：重置教学状态（避免“后面卡住”）
      traceApi.setStrokeIndex?.(0);
      traceApi.toggle(false);
      traceApi.setEnabled(false);
      traceCanvas.style.pointerEvents = "none";
    } catch (e) {
      stage.innerHTML = `
        <div class="text-red-600 text-sm p-3 text-center">
          ❌ 笔顺 SVG 加载失败<br/>
          <div class="opacity-80 mt-1">字：<b>${escapeHtml(ch)}</b></div>
          <div class="opacity-80 mt-1">URL：<code>${escapeHtml(url)}</code></div>
        </div>`;
    }
  }

  // ✅ 字按钮
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

  // ✅ 顶部按钮
  btnReplay.onclick = () => loadChar(currentChar, { reset: false });
  btnReset.onclick = () => resetView();

  btnSpeak.onclick = async () => {
    try {
      await speakZhCN(currentChar);
    } catch {
      showMsg(T.speakFail);
    }
  };

  // ✅ 练习区开关（只负责显示/隐藏练习区）
  btnTrace.onclick = () => {
    const willShow = practiceWrap.classList.contains("hidden");
    if (willShow) {
      practiceWrap.classList.remove("hidden");
      btnTrace.classList.add("bg-orange-400", "text-white");
    } else {
      practiceWrap.classList.add("hidden");
      btnTrace.classList.remove("bg-orange-400", "text-white");
    }
  };

  // ✅ 语言切换
  const onLangChanged = () => applyLangText();
  window.addEventListener("joy:langchanged", onLangChanged);

  // ✅ 清理（防止重复 mount 越写越卡）
  targetEl._strokeCleanup = () => {
    try { window.removeEventListener("joy:langchanged", onLangChanged); } catch {}
    try { traceCanvas.removeEventListener("trace:strokeend", onStrokeEnd); } catch {}
    try { teaching?.stop?.(); } catch {}
    try { traceApi?.destroy?.(); } catch {}
    try { practiceApi?.destroy?.(); } catch {}
  };

  applyLangText();
}
