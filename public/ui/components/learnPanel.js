// /ui/components/learnPanel.js  ✅完善不返工版（KO-first, stable, extensible）
/*
  ✅ 目标：
  - 一次挂载，不重复 mount
  - 事件驱动，不把业务塞进组件（不返工）
  - 兼容数据结构：string / {ko, kr, zh, cn, en} / array / nested object
  - 提供 strokeMount 挂载点：外部模块自行 mount
  - 可选：自动尝试挂载 StrokePlayer（如果存在）
  - 事件：
      openLearnPanel / closeLearnPanel
      learn:set         (传入 word 对象)
      learn:rendered    (渲染完成广播)
      learn:open        (外部也可用：同 learn:set + open)
*/

let mounted = false;

export function mountLearnPanel(opts = {}) {
  if (mounted) return;
  mounted = true;

  const { container = document.body } = opts;

  const wrap = document.createElement("div");
  wrap.id = "learn-panel-root";
  wrap.innerHTML = tpl();
  container.appendChild(wrap);

  const overlay = wrap.querySelector("#learn-panel");
  const closeBtn = wrap.querySelector("#learnClose");
  const body = wrap.querySelector("#learnBody");

  // --- open/close ---
  const open = () => overlay.classList.remove("hidden");
  const close = () => overlay.classList.add("hidden");

  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", (e) => {
    // 点击黑色背景关闭
    if (e.target === overlay) close();
  });

  // Esc 关闭（可选）
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // --- external events ---
  window.addEventListener("openLearnPanel", open);
  window.addEventListener("closeLearnPanel", close);

  // learn:set：只设置内容（并打开）
  window.addEventListener("learn:set", (e) => {
    const data = e?.detail || {};
    render(body, data);
    open();
  });

  // learn:open：同 learn:set（给你更语义化的事件名）
  window.addEventListener("learn:open", (e) => {
    const data = e?.detail || {};
    render(body, data);
    open();
  });

  return {
    open,
    close,
    set: (data) => render(body, data),
  };
}

/* ===============================
   Template
================================== */
function tpl() {
  return `
    <div id="learn-panel"
      class="hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      aria-label="Learn Panel"
    >
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

/* ===============================
   Render helpers
================================== */
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ✅ KO-first pickText: never [object Object]
function pickText(v, lang = "ko") {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) {
    return v.map((x) => pickText(x, lang)).filter(Boolean).join(" / ");
  }

  if (typeof v === "object") {
    // 优先：lang -> ko/kr -> zh/cn -> en
    const direct =
      pickText(v?.[lang], lang) ||
      pickText(v?.ko, lang) ||
      pickText(v?.kr, lang) ||
      pickText(v?.zh, lang) ||
      pickText(v?.cn, lang) ||
      pickText(v?.en, lang);

    if (direct) return direct;

    // 兜底：找第一个可显示字段
    for (const k of Object.keys(v)) {
      const t = pickText(v[k], lang);
      if (t) return t;
    }
    return "";
  }

  return "";
}

function normalizeWordObj(raw) {
  // 兼容你 loader/renderer 的字段：word / hanzi / simplified 等
  const word =
    raw?.word ||
    raw?.hanzi ||
    raw?.simplified ||
    raw?.traditional ||
    raw?.hz ||
    raw?.zh ||
    raw?.cn ||
    "";

  const pinyin = raw?.pinyin || raw?.py || raw?.pron || "";
  const meaning = raw?.meaning ?? raw?.ko ?? raw?.kr ?? raw?.translation ?? "";
  const example = raw?.example ?? raw?.sentence ?? raw?.eg ?? "";

  return {
    ...raw,
    word,
    pinyin,
    meaning,
    example,
  };
}

function extractHanChars(wordText) {
  const s = String(wordText || "");
  const m = s.match(/[\u3400-\u9FFF]/g);
  return m ? Array.from(new Set(m)) : [];
}

/* ===============================
   Main render (stable)
================================== */
function render(root, raw) {
  if (!root) return;

  const w = normalizeWordObj(raw);

  const wordText = pickText(w.word, "ko");
  const pinyinText = pickText(w.pinyin, "ko");
  const meaningText = pickText(w.meaning, "ko");
  const exampleText = pickText(w.example, "ko");

  const word = esc(wordText);
  const pinyin = esc(pinyinText);
  const meaning = esc(meaningText);
  const example = esc(exampleText);

  // ✅ 用于 stroke
  const hanChars = extractHanChars(wordText);

  root.innerHTML = `
    <!-- ✅ Summary card -->
    <div class="rounded-2xl border p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-2xl font-extrabold">${word || "(빈 항목)"}</div>
          <div class="text-sm text-gray-600 mt-1">
            ${[pinyin, meaning].filter(Boolean).join(" · ") || "&nbsp;"}
          </div>
        </div>

        <div class="flex gap-2">
          <button id="btnLearnAskAI" type="button"
            class="px-3 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm">
            AI
          </button>

          <button id="btnLearnSpeak" type="button"
            class="px-3 py-2 rounded-xl bg-slate-100 font-bold text-sm">
            🔊
          </button>
        </div>
      </div>

      <div class="mt-3 text-sm text-gray-700">
        ${
          example
            ? `<div class="text-xs text-gray-500 mb-1">예문</div><div>${example}</div>`
            : `<div class="text-xs text-gray-400">예문 없음</div>`
        }
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button id="btnLearnToRecent" type="button"
          class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">
          ⭐ 최근 학습 저장
        </button>
      </div>
    </div>

    <!-- ✅ Stroke mount -->
    <div class="rounded-2xl border p-4">
      <div class="font-extrabold mb-2">필순</div>
      <div id="strokeMount"></div>
      ${
        hanChars.length
          ? `<div class="text-xs text-gray-500 mt-2">글자: ${esc(hanChars.join(" "))}</div>`
          : `<div class="text-xs text-gray-400 mt-2">표시할 한자가 없어요.</div>`
      }
    </div>
  `;

  // ✅ AI 버튼：把当前词推送到 AI
  root.querySelector("#btnLearnAskAI")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("openAIPanel"));

    const msg = `${wordText || ""}${pinyinText ? ` (${pinyinText})` : ""}`;
    window.dispatchEvent(
      new CustomEvent("ai:push", { detail: { who: "user", text: msg } })
    );

    // 让业务层决定怎么回（不在组件里写死）
    window.dispatchEvent(
      new CustomEvent("ai:send", { detail: { text: msg, source: "learnPanel" } })
    );
  });

  // ✅ 朗读按钮（如果你的 AIUI.speak 存在就用）
  root.querySelector("#btnLearnSpeak")?.addEventListener("click", () => {
    try {
      // 中文读字（你也可以改成 ko 解释读音等）
      window.AIUI?.speak?.(wordText, "zh-CN");
    } catch {}
  });

  // ✅ 保存到最近学习（如果你 HSK_HISTORY 存在）
  root.querySelector("#btnLearnToRecent")?.addEventListener("click", () => {
    try {
      window.HSK_HISTORY?.push?.(w); // 你之前有 list/clear，push 你可以做成 saveHistory/push 都行
      // 也兼容 saveHistory
      window.HSK_HISTORY?.save?.(w);
      window.saveHistory?.(w);
    } catch {}
  });

  // ✅ Stroke 自动挂载（可选：存在才挂，不存在不报错）
  tryMountStroke(root.querySelector("#strokeMount"), hanChars);

  // ✅ 广播：渲染完毕（stroke/ai/tts 业务层都可监听）
  window.dispatchEvent(new CustomEvent("learn:rendered", { detail: w }));
}

function tryMountStroke(mountEl, hanChars) {
  if (!mountEl) return;
  mountEl.innerHTML = "";

  // 没有字就不挂
  if (!hanChars?.length) return;

  // 如果你已经有 StrokePlayer（新版 main.js 会暴露 window.StrokePlayer.mountStrokeSwitcher）
  const fn = window.StrokePlayer?.mountStrokeSwitcher;
  if (typeof fn !== "function") {
    mountEl.innerHTML =
      `<div class="text-sm text-gray-500">필순 모듈이 아직 준비되지 않았어요.</div>`;
    return;
  }

  try {
    fn(mountEl, hanChars);
  } catch (e) {
    mountEl.innerHTML =
      `<div class="text-sm text-red-600">필순 로드 실패</div>`;
    console.error(e);
  }
}
