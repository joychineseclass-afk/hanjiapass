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

/**
 * ✅ 用法（在 page.stroke.js 里）：
 * mountStrokeSwitcher(document.getElementById("stroke-root"), "中国人");
 * 或 mountStrokeSwitcher(targetEl, ["中","国","人"]);
 */
export function mountStrokeSwitcher(targetEl, hanChars) {
  if (!targetEl) return;

  // ✅ 如果同一个容器重复 mount，先清理旧监听（避免越绑越多）
  try {
    targetEl._strokeCleanup?.();
  } catch {}

  let lang = getLang();
  let T = UI_TEXT[lang] || UI_TEXT.kr;

  // 1) 规范输入：支持 string 或 array
  const chars = normalizeChars(hanChars);
  if (!chars.length) {
    targetEl.innerHTML = `<div class="text-sm text-gray-500">${T.noChars}</div>`;
    return;
  }

  // 2) 渲染 UI（保持你当前 Tailwind/简洁风格）
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

      <div class="w-full aspect-square bg-slate-50 rounded-xl overflow-hidden relative select-none">
        <div id="strokeViewport"
     class="absolute inset-0"
     style="touch-action:auto;">
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
    </div>
  `;

  const btnWrap = targetEl.querySelector("#strokeBtns");
  const stage = targetEl.querySelector("#strokeStage");
  const viewport = targetEl.querySelector("#strokeViewport");
  const traceCanvas = targetEl.querySelector("#traceCanvas");
  const zoomLabel = targetEl.querySelector("#strokeZoomLabel");
  const msgEl = targetEl.querySelector("#strokeMsg");

  // 3) 状态
  let currentChar = chars[0];
  let scale = 1,
    tx = 0,
    ty = 0;
  let activeBtn = null;
  let tracingOn = false;

  // 4) 小工具
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
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
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
    showMsg(T.resetDone);
  }

  function strokeUrl(ch) {
    const fn = window.DATA_PATHS?.strokeUrl;
    if (!fn) return "";
    return fn(ch) || "";
  }

  // ✅ 语言切换后：只更新组件内部标题/按钮文案（不破坏当前字/缩放/描红状态）
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

  // ✅ 完成收尾：强制把所有 stroke 改黑（作为“最后一笔不黑”的兜底收尾）
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


  async function loadChar(ch, { reset = true } = {}) {
    currentChar = ch;

    // 按钮高亮
    if (activeBtn)
      activeBtn.classList.remove("bg-slate-900", "text-white", "border-slate-900");
    const btn = btnWrap.querySelector(`[data-ch="${cssEscape(ch)}"]`);
    if (btn) {
      btn.classList.add("bg-slate-900", "text-white", "border-slate-900");
      activeBtn = btn;
    }

    // 清除描红
    traceApi?.clear?.();

    // 重置视图（换字默认复位）
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
      const res = await fetch(
        url + (url.includes("?") ? "&" : "?") + "v=" + Date.now()
      );
      if (!res.ok) throw new Error("HTTP_" + res.status);

      const svgText = await res.text();
      stage.innerHTML = svgText;

      // SVG 显示优化
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
    } catch (e) {
      stage.innerHTML = `
        <div class="text-red-600 text-sm p-3 text-center">
          ❌ 笔顺 SVG 加载失败<br/>
          <div class="opacity-80 mt-1">字：<b>${escapeHtml(ch)}</b></div>
          <div class="opacity-80 mt-1">URL：<code>${escapeHtml(url)}</code></div>
        </div>`;
    }
  }


  // 5) 初始化描红层 + 教学
  const traceApi = initTraceCanvasLayer(traceCanvas);
const teaching = initStrokeTeaching(targetEl, stage, traceApi);
// ✅ 写完一笔（抬笔）→ 通知教学进入下一笔
traceCanvas.addEventListener("trace:strokeend", () => {
  teaching?.onUserStrokeDone?.();
});

  // 6) 生成切换按钮
  btnWrap.innerHTML = "";
  chars.forEach((ch, i) => {
    const b = document.createElement("button");
    b.className =
      "px-3 py-1 rounded-lg border text-sm bg-white hover:bg-slate-50 transition";
    b.textContent = ch;
    b.setAttribute("data-ch", ch);
    b.onclick = () => loadChar(ch, { reset: true });
    btnWrap.appendChild(b);

    if (i === 0) {
      queueMicrotask(() => loadChar(ch, { reset: true }));
    }
  });

  // 7) 顶部功能按钮
  const btnReplay = targetEl.querySelector(".btnReplay");
  const btnReset = targetEl.querySelector(".btnReset");
  const btnTrace = targetEl.querySelector(".btnTrace");
  const btnSpeak = targetEl.querySelector(".btnSpeak");

  btnReplay.onclick = () => loadChar(currentChar, { reset: false });
  btnReset.onclick = () => resetView();

  btnTrace.onclick = () => {
  if (!traceApi) {
    console.warn("[TRACE] traceApi is null");
    return;
  }

  // ✅ 1) 计算下一状态（不依赖 toggle）
  const next = !tracingOn;

  // ✅ 2) 兼容不同 traceApi 实现：toggle / setEnabled / enable
  try {
    if (typeof traceApi.toggle === "function") {
      tracingOn = !!traceApi.toggle();
    } else if (typeof traceApi.setEnabled === "function") {
      traceApi.setEnabled(next);
      tracingOn = next;
    } else if (typeof traceApi.enable === "function") {
      traceApi.enable(next);
      tracingOn = next;
    } else {
      console.warn("[TRACE] traceApi has no toggle/setEnabled/enable");
      // 就算没有方法，也至少把 UI 切换给用户看到（避免“没反应”）
      tracingOn = next;
    }
  } catch (e) {
    console.error("[TRACE] toggle failed:", e);
    return;
  }

  // ✅ 3) canvas 是否接管指针事件（开=能写；关=不挡拖拽缩放）
  traceCanvas.style.pointerEvents = tracingOn ? "auto" : "none";

  // ✅ 4) 按钮高亮（橙色）
  btnTrace.classList.toggle("bg-orange-400", tracingOn);
  btnTrace.classList.toggle("text-white", tracingOn);
  btnTrace.classList.toggle("hover:bg-orange-500", tracingOn);
  if (tracingOn) {
  // ✅ 进入教学：浅灰 → 示范一笔(浅蓝) → 允许写
  teaching?.start?.();
} else {
  // ✅ 退出教学：关闭跟写
  teaching?.stop?.();
}

  // ✅ 5) 可选：提示一下状态（方便你现场确认）
  // showMsg(tracingOn ? "따라쓰기 ON" : "따라쓰기 OFF", 800);
};

  btnSpeak.onclick = () => {
    // 优先你自己的 AIUI
    if (window.AIUI?.speak) {
      // ✅ 默认韩语界面，但读音我们仍读中文更合理
      window.AIUI.speak(currentChar, "zh-CN");
      return;
    }

    // 降级：浏览器自带 TTS
    try {
      const u = new SpeechSynthesisUtterance(currentChar);
      u.lang = "zh-CN";
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      showMsg(T.speakFail);
    }
  };

  // ✅ 绑定：语言切换事件（全站）
  const onLangChanged = () => applyLangText();
  window.addEventListener("joy:langchanged", onLangChanged);

  // ✅ 绑定：教学完成事件（由 ui-stroke-teaching.js 在完成时触发）
  const onStrokeComplete = () => forceAllStrokesBlack();
  targetEl.addEventListener("stroke:complete", onStrokeComplete);

  // ✅ 保存清理函数（供下次 mount 或页面销毁时调用）
  targetEl._strokeCleanup = () => {
    window.removeEventListener("joy:langchanged", onLangChanged);
    targetEl.removeEventListener("stroke:complete", onStrokeComplete);
  };
}

/* ---------------- helpers ---------------- */

function normalizeChars(input) {
  if (!input) return [];
  if (Array.isArray(input))
    return input.map(String).map((s) => s.trim()).filter(Boolean);

  // string：取其中所有汉字（去重）
  const s = String(input);
  const arr = Array.from(s).filter((ch) => /[\u3400-\u9FFF]/.test(ch));
  const seen = new Set();
  return arr.filter((ch) => (seen.has(ch) ? false : (seen.add(ch), true)));
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
