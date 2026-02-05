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
  // 不去重：按输入顺序
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

  // ✅ 清理旧监听（防止重复绑定）
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

      <!-- ✅ 上：演示区（一直存在） -->
      <div class="w-full aspect-square bg-slate-50 rounded-xl overflow-hidden relative select-none border">
        <div id="strokeViewport" class="absolute inset-0" style="touch-action:auto;">
          <div id="strokeStage"
               class="w-full h-full flex items-center justify-center text-xs text-gray-400 p-3 text-center">
            ${escapeHtml(T.loading)}
          </div>
        </div>

        <!-- ✅ 跟写层：默认不挡（tracing off + hitTest off） -->
        <canvas id="traceCanvas"
                class="absolute inset-0 w-full h-full"
                style="pointer-events:none;"></canvas>

        <div id="strokeMsg"
             class="absolute left-2 bottom-2 text-[11px] text-gray-600 bg-white/80 px-2 py-1 rounded hidden">
        </div>
      </div>

      <!-- ✅ 下：自由画布（따라쓰기 打开才显示） -->
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

  // ===== DOM refs =====
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

  // ===== message =====
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

    // practice labels（重新渲染更麻烦，这里只更新按钮文案）
    const clearBtn = targetEl.querySelector("#btnClearPractice");
    if (clearBtn) clearBtn.textContent = T.clear;
  }

  // ===== init trace api (top overlay) =====
  const traceApi = initTraceCanvasLayer(traceCanvas, {
    enabledDefault: false,
    tracingDefault: false,
    autoAdvanceIndex: true,
    penColor: "#FB923C",
    lineWidth: 8,
    alpha: 0.85,
    zIndex: 60
  });

  // 默认：不显示、不吃事件、不允许写
  traceApi.setTracing(false);
  traceApi.setHitTest(false);
  traceApi.setEnabled(false);

  // teaching：用于“跟写时推进/判定”（你未来可扩展）
  const teaching = initStrokeTeaching(targetEl, stage, traceApi);

  const onStrokeEnd = (e) => {
    teaching?.onUserStrokeDone?.(e?.detail);
  };
  traceCanvas.addEventListener("trace:strokeend", onStrokeEnd);

  // ===== init practice api (bottom canvas) =====
  const practiceApi = initTraceCanvasLayer(practiceCanvas, {
    enabledDefault: true,
    tracingDefault: true,
    autoAdvanceIndex: false,
    penColor: "#FB923C",
    lineWidth: Number(penWidthEl?.value || 8),
    alpha: 0.9,
    zIndex: 10
  });

  // practice 永远可写（wrap 隐藏只是 UI 隐藏）
  practiceApi.setTracing(true);
  practiceApi.setHitTest(true);
  practiceApi.setEnabled(true);

  // 同步颜色/粗细（上下两块一致）
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

  // ===== load + auto demo =====
  async function loadChar(ch, { speak = false, playDemo = true } = {}) {
    currentChar = ch;

    // 高亮
    if (activeBtn) {
      activeBtn.classList.remove("bg-slate-900", "text-white", "border-slate-900");
    }
    const btn = btnWrap.querySelector(`[data-ch="${cssEscape(ch)}"]`);
    if (btn) {
      btn.classList.add("bg-slate-900", "text-white", "border-slate-900");
      activeBtn = btn;
    }

    // 清 overlay 画布&重置笔序
    traceApi.clear?.();
    traceApi.setStrokeIndex?.(0);

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

      // ✅ 每次加载完：演示一遍（关键：你说“点字就演示笔画”）
      if (playDemo) {
        try {
          teaching?.stop?.();
          teaching?.start?.(); // start() 内部会播放示范（按你之前的 teaching 实现习惯）
        } catch {}
      }

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

    // ✅ 点击字：演示 + 朗读
    b.onclick = () => loadChar(ch, { speak: true, playDemo: true });

    btnWrap.appendChild(b);

    if (i === 0) queueMicrotask(() => loadChar(ch, { speak: false, playDemo: true }));
  });

  // ===== top buttons =====
  btnSpeak.onclick = async () => {
    try { await speakZhCN(currentChar); }
    catch { showMsg(T.speakFail); }
  };

  btnTrace.onclick = () => {
    tracingOn = !tracingOn;

    if (tracingOn) {
      // show practice area
      practiceWrap.classList.remove("hidden");
      btnTrace.classList.add("bg-orange-400", "text-white");

      // ✅ 开启上方跟写层：显示+吃事件+允许写
      traceApi.setTracing(true);
      traceApi.setHitTest(true);
      traceApi.setEnabled(true);

      // ✅ 跟写开启时：重置并示范一遍
      traceApi.setStrokeIndex?.(0);
      traceApi.clear?.();
      try {
        teaching?.stop?.();
        teaching?.start?.();
      } catch {}

      showMsg(T.traceOnMsg);
    } else {
      // ✅ 关闭上方跟写层：别挡按钮
      traceApi.setEnabled(false);
      traceApi.setHitTest(false);
      traceApi.setTracing(false);

      // hide practice area
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
