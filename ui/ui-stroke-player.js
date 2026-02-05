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
    traceOffMsg: "따라쓰기를 종료했어요.",
    color: "색상",
    width: "굵기",
    clear: "지우기",
    loading: "loading..."
  },
  cn: {
    title: "汉字笔顺",
    speak: "读音",
    trace: "跟写",
    noChars: "没有可显示的汉字",
    speakFail: "读音功能不可用",
    traceOnMsg: "请开始跟写。",
    traceOffMsg: "已关闭跟写。",
    color: "颜色",
    width: "粗细",
    clear: "清空",
    loading: "加载中..."
  },
  en: {
    title: "Stroke Order",
    speak: "Speak",
    trace: "Trace",
    noChars: "No characters to display.",
    speakFail: "Speak is unavailable",
    traceOnMsg: "Start tracing.",
    traceOffMsg: "Tracing off.",
    color: "Color",
    width: "Width",
    clear: "Clear",
    loading: "loading..."
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
  if (Array.isArray(input))
    return input.map(String).map((s) => s.trim()).filter(Boolean);
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

export function mountStrokeSwitcher(targetEl, hanChars) {
  if (!targetEl) return;

  try { targetEl._strokeCleanup?.(); } catch {}

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
          <button class="btnTrace px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">${T.trace}</button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-3" id="strokeBtns"></div>

      <!-- ✅ 上：演示 + 跟写（同一个区） -->
      <div class="w-full aspect-square bg-slate-50 rounded-xl overflow-hidden relative select-none border">
        <div id="strokeViewport" class="absolute inset-0" style="touch-action:auto;">
          <div id="strokeStage"
               class="w-full h-full flex items-center justify-center text-xs text-gray-400 p-3 text-center">
            ${escapeHtml(T.loading)}
          </div>
        </div>

        <!-- ✅ traceCanvas：演示时需要可见；默认不吃点击 -->
        <canvas id="traceCanvas"
                class="absolute inset-0 w-full h-full"
                style="pointer-events:none;"></canvas>

        <div id="strokeMsg"
             class="absolute left-2 bottom-2 text-[11px] text-gray-600 bg-white/80 px-2 py-1 rounded hidden">
        </div>
      </div>

      <!-- ✅ 下：自由练习区（따라쓰기 时显示） -->
      <div id="practiceWrap" class="mt-3 hidden">
        <div class="flex items-center gap-2 flex-wrap mb-2">
          <label class="text-xs text-gray-600">${escapeHtml(T.color)}</label>
          <select id="penColor" class="px-2 py-1 border rounded-lg text-sm">
            <option value="#FB923C">주황</option>
            <option value="#3B82F6">파랑</option>
            <option value="#111827">검정</option>
            <option value="#22C55E">초록</option>
            <option value="#EF4444">빨강</option>
            <option value="#A855F7">보라</option>
          </select>

          <label class="text-xs text-gray-600 ml-2">${escapeHtml(T.width)}</label>
          <input id="penWidth" type="range" min="2" max="18" value="8" />

          <button id="btnClearPractice" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">
            ${escapeHtml(T.clear)}
          </button>
        </div>

        <div class="w-full aspect-square bg-white rounded-xl overflow-hidden relative border">
          <canvas id="practiceCanvas" class="absolute inset-0 w-full h-full"></canvas>
        </div>
      </div>
    </div>
  `;

  // ===== refs =====
  const btnWrap = targetEl.querySelector("#strokeBtns");
  const stage = targetEl.querySelector("#strokeStage");
  const traceCanvas = targetEl.querySelector("#traceCanvas");
  const msgEl = targetEl.querySelector("#strokeMsg");

  const practiceWrap = targetEl.querySelector("#practiceWrap");
  const practiceCanvas = targetEl.querySelector("#practiceCanvas");
  const penColorEl = targetEl.querySelector("#penColor");
  const penWidthEl = targetEl.querySelector("#penWidth");
  const btnClearPractice = targetEl.querySelector("#btnClearPractice");

  const btnTrace = targetEl.querySelector(".btnTrace");
  const btnSpeak = targetEl.querySelector(".btnSpeak");

  // ===== state =====
  let currentChar = chars[0];
  let activeBtn = null;
  let tracingOn = false;

  const showMsg = (text, ms = 1400) => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.classList.remove("hidden");
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => msgEl.classList.add("hidden"), ms);
  };

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
    if (btnTrace) btnTrace.textContent = T.trace;

    const clearBtn = targetEl.querySelector("#btnClearPractice");
    if (clearBtn) clearBtn.textContent = T.clear;
  }

  // ===== init trace (top overlay) =====
  const traceApi = initTraceCanvasLayer(traceCanvas, {
    enabledDefault: false,
    tracingDefault: true,       // ✅ 关键：默认可见，才能显示“演示”蓝色
    autoAdvanceIndex: true,
    penColor: "#FB923C",
    lineWidth: 8,
    alpha: 0.85,
    zIndex: 60
  });

  // 初始：允许显示演示，但不允许写、也不吃点击
  traceApi.setTracing(true);
  traceApi.setHitTest(false);
  traceApi.setEnabled(false);

  const teaching = initStrokeTeaching(targetEl, stage, traceApi);

  const onStrokeEnd = (e) => {
    teaching?.onUserStrokeDone?.(e?.detail);
  };
  traceCanvas.addEventListener("trace:strokeend", onStrokeEnd);

  function playDemoSafe() {
    // ✅ 让 teaching 不管叫什么方法都能跑
    try {
      traceApi.setTracing(true);     // 演示必须可见
      traceApi.setHitTest(false);    // 不挡按钮
      traceApi.setEnabled(false);    // 演示不允许写
      traceApi.setStrokeIndex?.(0);
      traceApi.clear?.();

      const f =
        teaching?.replay ||
        teaching?.playDemo ||
        teaching?.playDemoStroke ||
        teaching?.startDemo ||
        teaching?.start;

      if (typeof f === "function") f.call(teaching);
    } catch (e) {
      console.warn("[demo] failed:", e);
    }
  }

  // ===== init practice (bottom canvas) =====
  const practiceApi = initTraceCanvasLayer(practiceCanvas, {
    enabledDefault: true,
    tracingDefault: true,
    autoAdvanceIndex: false,
    penColor: "#FB923C",
    lineWidth: Number(penWidthEl?.value || 8),
    alpha: 0.9,
    zIndex: 10
  });

  practiceApi.setTracing(true);
  practiceApi.setHitTest(true);
  practiceApi.setEnabled(true);

  penColorEl?.addEventListener("change", () => {
    const c = penColorEl.value;
    practiceApi.setPenColor(c);
    traceApi.setPenColor(c);
  });

  penWidthEl?.addEventListener("input", () => {
    const w = Number(penWidthEl.value) || 8;
    practiceApi.setPenWidth(w);
    traceApi.setPenWidth(w);
  });

  btnClearPractice?.addEventListener("click", () => {
    practiceApi.clear();
  });

  // ===== load SVG =====
  async function loadChar(ch, { speak = false } = {}) {
    currentChar = ch;

    if (activeBtn) {
      activeBtn.classList.remove("bg-slate-900", "text-white", "border-slate-900");
    }
    const btn = btnWrap.querySelector(`[data-ch="${cssEscape(ch)}"]`);
    if (btn) {
      btn.classList.add("bg-slate-900", "text-white", "border-slate-900");
      activeBtn = btn;
    }

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

      // ✅ 每次加载完：自动演示一遍
      playDemoSafe();

      if (speak) {
        try { await speakZhCN(ch); }
        catch { showMsg(T.speakFail); }
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

  // ===== char buttons =====
  btnWrap.innerHTML = "";
  chars.forEach((ch, i) => {
    const b = document.createElement("button");
    b.className = "px-3 py-1 rounded-lg border text-sm bg-white hover:bg-slate-50 transition";
    b.textContent = ch;
    b.setAttribute("data-ch", ch);

    // 点字：演示 + 朗读
    b.onclick = () => loadChar(ch, { speak: true });

    btnWrap.appendChild(b);

    if (i === 0) queueMicrotask(() => loadChar(ch, { speak: false }));
  });

  // ===== top buttons =====
  btnSpeak.onclick = async () => {
    try { await speakZhCN(currentChar); }
    catch { showMsg(T.speakFail); }
  };

  btnTrace.onclick = () => {
    tracingOn = !tracingOn;

    if (tracingOn) {
      // show practice
      practiceWrap.classList.remove("hidden");
      btnTrace.classList.add("bg-orange-400", "text-white");

      // ✅ 上面允许跟写：可见+吃事件+允许写
      traceApi.setTracing(true);
      traceApi.setHitTest(true);
      traceApi.setEnabled(true);
      traceApi.setStrokeIndex?.(0);
      traceApi.clear?.();

      // 开启跟写时也演示一遍
      playDemoSafe();

      showMsg(T.traceOnMsg);
    } else {
      // ✅ 关闭跟写：不挡按钮
      traceApi.setEnabled(false);
      traceApi.setHitTest(false);
      traceApi.setTracing(true); // 演示仍可见（保持蓝色演示能力）

      practiceWrap.classList.add("hidden");
      btnTrace.classList.remove("bg-orange-400", "text-white");

      showMsg(T.traceOffMsg);
    }
  };

  // ===== language change =====
  const onLangChanged = () => applyLangText();
  window.addEventListener("joy:langchanged", onLangChanged);

  // ===== cleanup =====
  targetEl._strokeCleanup = () => {
    try { window.removeEventListener("joy:langchanged", onLangChanged); } catch {}
    try { traceCanvas.removeEventListener("trace:strokeend", onStrokeEnd); } catch {}
    try { teaching?.stop?.(); } catch {}
    try { traceApi?.destroy?.(); } catch {}
    try { practiceApi?.destroy?.(); } catch {}
  };

  applyLangText();
}
