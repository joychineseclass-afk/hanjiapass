// /ui/components/learnPanel.js
// - 学习面板：一次挂载
// - 事件：openLearnPanel / closeLearnPanel / learn:set
// - learn:set 可传 word 对象：{ word, pinyin, meaning, example, ... }
// - 预留 strokeMount 容器：给 strokePlayer 挂载

let mounted = false;

export function mountLearnPanel(opts = {}) {
  if (mounted) return;
  mounted = true;

  const { container = document.body } = opts;

  const wrap = document.createElement("div");
  wrap.id = "learn-panel-root";
  wrap.innerHTML = tpl();
  container.appendChild(wrap);

  const panel = wrap.querySelector("#learn-panel");
  const closeBtn = wrap.querySelector("#learnClose");
  const body = wrap.querySelector("#learnBody");

  const open = () => panel.classList.remove("hidden");
  const close = () => panel.classList.add("hidden");

  closeBtn.addEventListener("click", close);

  // click backdrop to close
  panel.addEventListener("click", (e) => {
    if (e.target === panel) close();
  });

  window.addEventListener("openLearnPanel", open);
  window.addEventListener("closeLearnPanel", close);

  // 外部：设置内容并打开
  window.addEventListener("learn:set", (e) => {
    const data = e.detail || {};
    render(body, data);
    open();
  });

  return { open, close, set: (data) => render(body, data) };
}

function tpl() {
  return `
    <div id="learn-panel"
      class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-3xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <div class="font-semibold" data-i18n="learn_title">배우기</div>
          <button id="learnClose" type="button"
            class="px-3 py-1 rounded-lg bg-slate-100"
            data-i18n="learn_close"
          >닫기</button>
        </div>

        <div id="learnBody" class="p-4 space-y-4 max-h-[80vh] overflow-auto"></div>
      </div>
    </div>
  `;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ✅ 最小稳定渲染：以后再逐步加（不返工）
function render(root, w) {
  if (!root) return;

  const word = esc(w.word || w.hanzi || "");
  const pinyin = esc(w.pinyin || "");
  const meaning = esc(pickText(w.meaning));
  const example = esc(pickText(w.example));

  root.innerHTML = `
    <div class="rounded-2xl border p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-2xl font-extrabold">${word || "(빈 항목)"}</div>
          <div class="text-sm text-gray-600 mt-1">${[pinyin, meaning].filter(Boolean).join(" · ") || "&nbsp;"}</div>
        </div>

        <div class="flex gap-2">
          <button id="btnLearnAskAI" type="button"
            class="px-3 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm">
            AI
          </button>
        </div>
      </div>

      <div class="mt-3 text-sm text-gray-700">
        ${example ? `<div class="text-xs text-gray-500 mb-1">예문</div><div>${example}</div>` : ""}
      </div>
    </div>

    <!-- ✅ 笔顺挂载点：stroke 模块在外部 mount 到这里 -->
    <div class="rounded-2xl border p-4">
      <div class="font-extrabold mb-2">필순</div>
      <div id="strokeMount"></div>
    </div>
  `;

  // ✅ AI 按钮：把当前词塞到 AI 面板
  root.querySelector("#btnLearnAskAI")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("openAIPanel"));
    window.dispatchEvent(new CustomEvent("ai:push", {
      detail: { who: "user", text: `${w.word || ""} (${w.pinyin || ""})` }
    }));
  });

  // ✅ 把词对象也广播出去：方便 stroke/tts 等模块接
  window.dispatchEvent(new CustomEvent("learn:rendered", { detail: w }));
}

// 兼容 meaning/example 可能是对象 {ko, zh, en}
function pickText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(pickText).filter(Boolean).join(" / ");
  if (typeof v === "object") {
    return v.ko || v.kr || v.zh || v.cn || v.en || "";
  }
  return "";
}
