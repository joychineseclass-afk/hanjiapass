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

  const lang = getLang();
  const T = UI_TEXT[lang] || UI_TEXT.kr;

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
        <div class="font-semibold">${T.title}</div>

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
             class="absolute inset-0 cursor-grab active:cursor-grabbing"
             style="touch-action:none;">
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

  // 5) 缩放：wheel + pinch（移动端）
  viewport.addEventListener(
    "wheel",
    (e) => {
      // 描红开启时，不要抢 wheel（让你能专心写）
      if (tracingOn) return;
      e.preventDefault();
      const next = scale * (e.deltaY > 0 ? 1 / 1.12 : 1.12);
      scale = clamp(next, 0.5, 4);
      applyTransform();
    },
    { passive: false }
  );

  // pointer events：拖拽 + 双指缩放
  let p1 = null,
    p2 = null;
  let dragLast = null;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  viewport.addEventListener("pointerdown", (e) => {
    // 描红开启时，拖拽缩放交给 canvas（避免冲突）
    if (tracingOn) return;

    viewport.setPointerCapture?.(e.pointerId);

    if (!p1) {
      p1 = { id: e.pointerId, x: e.clientX, y: e.clientY };
      dragLast = { x: e.clientX, y: e.clientY };
    } else if (!p2) {
      p2 = { id: e.pointerId, x: e.clientX, y: e.clientY };
      pinchStartDist = dist(p1, p2);
      pinchStartScale = scale;
      dragLast = null; // 双指时不拖拽
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (tracingOn) return;

    if (p1 && e.pointerId === p1.id) {
      p1.x = e.clientX;
      p1.y = e.clientY;
    } else if (p2 && e.pointerId === p2.id) {
      p2.x = e.clientX;
      p2.y = e.clientY;
    } else {
      return;
    }

    // 双指 pinch
    if (p1 && p2) {
      const d = dist(p1, p2);
      if (pinchStartDist > 0) {
        const ratio = d / pinchStartDist;
        scale = clamp(pinchStartScale * ratio, 0.5, 4);
        applyTransform();
      }
      return;
    }

    // 单指拖拽
    if (p1 && dragLast) {
      tx += p1.x - dragLast.x;
      ty += p1.y - dragLast.y;
      dragLast = { x: p1.x, y: p1.y };
      applyTransform();
    }
  });

  function clearPointer(id) {
    if (p1 && p1.id === id) p1 = null;
    if (p2 && p2.id === id) p2 = null;

    if (p1 && !p2) dragLast = { x: p1.x, y: p1.y };
    if (!p1 && !p2) dragLast = null;
  }

  viewport.addEventListener("pointerup", (e) => clearPointer(e.pointerId));
  viewport.addEventListener("pointercancel", (e) => clearPointer(e.pointerId));
  viewport.addEventListener("pointerleave", (e) => clearPointer(e.pointerId));

  // 6) 初始化描红层 + 教学
  const traceApi = initTraceCanvasLayer(traceCanvas);
  initStrokeTeaching(targetEl, stage, traceApi);

  // 7) 生成切换按钮
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

  // 8) 顶部功能按钮
  const btnReplay = targetEl.querySelector(".btnReplay");
  const btnReset = targetEl.querySelector(".btnReset");
  const btnTrace = targetEl.querySelector(".btnTrace");
  const btnSpeak = targetEl.querySelector(".btnSpeak");

  btnReplay.onclick = () => loadChar(currentChar, { reset: false });
  btnReset.onclick = () => resetView();

  btnTrace.onclick = () => {
    if (!traceApi?.toggle) return;

    tracingOn = !!traceApi.toggle();

    // 描红打开：canvas 接管指针事件；关闭：让 viewport 可以拖拽缩放
    traceCanvas.style.pointerEvents = tracingOn ? "auto" : "none";

    // 按钮高亮（橙色）
    btnTrace.classList.toggle("bg-orange-400", tracingOn);
    btnTrace.classList.toggle("text-white", tracingOn);
    btnTrace.classList.toggle("hover:bg-orange-500", tracingOn);
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
