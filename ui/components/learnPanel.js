// /ui/components/learnPanel.js
// ✅完善不返工版（KO-first, stable, extensible, ESM-compatible）
//
// 目标：
// - 一次挂载，不重复 mount
// - 事件驱动 + 也提供 window.LEARN_PANEL.open()
// - 兼容数据结构：string / {ko, kr, zh, cn, en} / array / nested object
// - 提供 strokeMount 挂载点：外部模块或 StrokePlayer 自动 mount
// - 兼容你现有字段命名（word/hanzi/hz/simplified... meaning/ko/kr... exampleZh...）
//
// Events:
//   openLearnPanel / closeLearnPanel
//   learn:set         (传入 word 对象)
//   learn:rendered    (渲染完成广播)
//   learn:open        (同 learn:set + open)

let mounted = false;

export function mountLearnPanel(opts = {}) {
  if (mounted) return window.LEARN_PANEL;
  mounted = true;

  const { container = document.body } = opts;

  // 防止重复插入 DOM（即便 mounted 被热更新打断）
  const existed = document.getElementById("learn-panel-root");
  if (existed) existed.remove();

  const wrap = document.createElement("div");
  wrap.id = "learn-panel-root";
  wrap.innerHTML = tpl();
  container.appendChild(wrap);

  const overlay = wrap.querySelector("#learn-panel");
  const closeBtn = wrap.querySelector("#learnClose");
  const closeXBtn = wrap.querySelector("#learnCloseX");
  const body = wrap.querySelector("#learnBody");

  // --- open/close ---
  const open = () => overlay?.classList.remove("hidden");
  const close = () => overlay?.classList.add("hidden");

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  closeXBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  overlay?.addEventListener("click", (e) => {
    // 点击黑色背景关闭
    if (e.target === overlay) close();
  });

  // Esc 关闭（只绑定一次）
  if (!document.body.dataset.learnEscBound) {
    document.body.dataset.learnEscBound = "1";
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // --- external events ---
  window.addEventListener("openLearnPanel", open);
  window.addEventListener("closeLearnPanel", close);

  // learn:set：设置内容并打开
  window.addEventListener("learn:set", (e) => {
    const data = e?.detail || {};
    render(body, data);
    open();
  });

  // learn:open：同 learn:set（更语义化）
  window.addEventListener("learn:open", (e) => {
    const data = e?.detail || {};
    render(body, data);
    open();
  });

  // ✅ 给点击词卡用：window.LEARN_PANEL.open(item)
  window.LEARN_PANEL = {
    open: (data) => {
      render(body, data);
      open();
    },
    close,
    set: (data) => render(body, data),
    isMounted: true,
  };

  return window.LEARN_PANEL;
}

/* ===============================
   Template
================================== */
function tpl() {
  return `
    <div id="learn-panel"
      class="hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      aria-label="Learn Panel"
    >
      <div class="w-full max-w-[560px] rounded-2xl bg-white shadow-2xl overflow-hidden relative">
        
        <!-- 顶部栏 -->
        <div class="sticky top-0 z-10 bg-white border-b">
          <div class="flex items-center justify-between px-4 py-3">
            <button id="learnBack" type="button"
              class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">
              ← 뒤로
            </button>

            <div class="font-extrabold" data-i18n="learn_title">단어 학습</div>

            <button id="learnClose" type="button"
              class="w-10 h-10 rounded-xl bg-slate-100 text-lg leading-none font-bold">
              ×
            </button>
          </div>
        </div>

        <!-- 内容区 -->
        <div id="learnBody" class="p-4 space-y-4 max-h-[75vh] overflow-auto"></div>
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
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) {
    return v.map((x) => pickText(x, lang)).filter(Boolean).join(" / ");
  }

  if (typeof v === "object") {
    const L = String(lang || "").toLowerCase();

    // 优先：lang -> ko/kr -> zh/cn -> en
    const direct =
      pickText(v?.[L], lang) ||
      pickText(v?.ko, lang) ||
      pickText(v?.kr, lang) ||
      pickText(v?.zh, lang) ||
      pickText(v?.cn, lang) ||
      pickText(v?.en, lang);

    if (direct) return direct;

    for (const k of Object.keys(v)) {
      const t = pickText(v[k], lang);
      if (t) return t;
    }
  }

  return "";
}

function cleanText(v, lang = "ko") {
  const t = pickText(v, lang);
  const s = String(t ?? "").trim();
  if (!s || s === "[object Object]") return "";
  return s;
}

function normalizeWordObj(raw = {}) {
  // ✅ 兼容你 loader/renderer 的字段：word / hanzi / simplified / traditional ...
  const word =
    raw?.word ??
    raw?.hanzi ??
    raw?.hz ??
    raw?.simplified ??
    raw?.traditional ??
    raw?.zh ??
    raw?.cn ??
    "";

  const pinyin = raw?.pinyin ?? raw?.py ?? raw?.pron ?? "";

  // ✅ meaning 兼容
  const meaning =
    raw?.meaning ??
    raw?.ko ??
    raw?.kr ??
    raw?.translation ??
    raw?.뜻 ??
    "";

  // ✅ 例句兼容（你 hskRenderer.js 那套字段）
  const exampleZh =
    raw?.exampleZh ??
    raw?.exampleZH ??
    raw?.example_zh ??
    raw?.sentenceZh ??
    raw?.sentenceZH ??
    raw?.example ??
    raw?.sentence ??
    "";

  const examplePinyin =
    raw?.examplePinyin ??
    raw?.sentencePinyin ??
    raw?.example_py ??
    raw?.examplePY ??
    "";

  const exampleExplainKr =
    raw?.exampleExplainKr ??
    raw?.exampleKR ??
    raw?.explainKr ??
    raw?.krExplain ??
    raw?.example?.kr ??
    "";

  const exampleExplainCn =
    raw?.exampleExplainCn ??
    raw?.exampleCN ??
    raw?.explainCn ??
    raw?.cnExplain ??
    raw?.example?.zh ??
    "";

  return {
    ...raw,
    word,
    pinyin,
    meaning,
    exampleZh,
    examplePinyin,
    exampleExplainKr,
    exampleExplainCn,
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

  const lang = window.APP_LANG || window.site_lang || "ko";
  const w = normalizeWordObj(raw);

  const wordText = cleanText(w.word, lang) || cleanText(w.word, "zh");
  const pinyinText = cleanText(w.pinyin, lang);
  const meaningText = cleanText(w.meaning, lang);

  const exZh = cleanText(w.exampleZh, "zh");
  const exPy = cleanText(w.examplePinyin, lang);
  const exKr = cleanText(w.exampleExplainKr, "ko");
  const exCn = cleanText(w.exampleExplainCn, "zh");

  const hanChars = extractHanChars(wordText);

  root.innerHTML = `
    <!-- ✅ Summary card -->
    <div class="rounded-2xl border p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-3xl font-extrabold">${esc(wordText || "(빈 항목)")}</div>
          <div class="text-sm text-gray-600 mt-1">
            ${esc([pinyinText, meaningText].filter(Boolean).join(" · ")) || "&nbsp;"}
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

      <div class="mt-4 text-sm text-gray-700 space-y-1">
        ${exZh ? `<div>${esc(exZh)}</div>` : `<div class="text-xs text-gray-400">예문 없음</div>`}
        ${exPy ? `<div class="text-blue-600">${esc(exPy)}</div>` : ""}
        ${exKr ? `<div class="text-gray-500">${esc(exKr)}</div>` : ""}
        ${(!exKr && exCn) ? `<div class="text-gray-500">${esc(exCn)}</div>` : ""}
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
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

    <!-- ✅ Extra actions (extensible) -->
    <div class="rounded-2xl border p-4">
      <div class="font-extrabold mb-2">학습</div>
      <div class="flex flex-wrap gap-2">
        <button id="btnLearnPractice" type="button"
          class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">
          ✍️ 연습 만들기
        </button>
        <button id="btnLearnGrammar" type="button"
          class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">
          📘 문법 보기
        </button>
      </div>
      <div class="text-xs text-gray-400 mt-2">
        (이 영역은 나중에 회화/문법/연습 카드로 확장하기 쉬워요)
      </div>
    </div>
  `;

  // ✅ AI
  root.querySelector("#btnLearnAskAI")?.addEventListener("click", () => {
    // 你的 AI 面板若用事件：openAIPanel / ai:push / ai:send
    window.dispatchEvent(new CustomEvent("openAIPanel"));

    const prompt = [
      `"${wordText}"를 한국어로 쉽게 설명해줘.`,
      meaningText ? `뜻: ${meaningText}` : "",
      pinyinText ? `병음: ${pinyinText}` : "",
      exZh ? `예문(중문): ${exZh}` : "",
      "뜻/발음/예문을 더 자연스럽게 다듬어줘.",
    ].filter(Boolean).join("\n");

    window.dispatchEvent(
      new CustomEvent("ai:push", { detail: { who: "user", text: prompt } })
    );
    window.dispatchEvent(
      new CustomEvent("ai:send", { detail: { text: prompt, source: "learnPanel" } })
    );

    // 也兼容你旧的 AIUI
    window.AIUI?.open?.();
  });

  // ✅ Speak
  root.querySelector("#btnLearnSpeak")?.addEventListener("click", () => {
    try {
      window.AIUI?.speak?.(wordText, "zh-CN");
    } catch {}
  });

  // ✅ Recent save
  root.querySelector("#btnLearnToRecent")?.addEventListener("click", () => {
    try {
      window.HSK_HISTORY?.push?.(w);
      window.HSK_HISTORY?.save?.(w);
      window.saveHistory?.(w);
    } catch {}
  });

  // ✅ placeholder actions (future)
  root.querySelector("#btnLearnPractice")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("practice:open", { detail: w }));
  });

  root.querySelector("#btnLearnGrammar")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("grammar:open", { detail: w }));
  });

  // ✅ Stroke auto mount
  tryMountStroke(root.querySelector("#strokeMount"), hanChars);

  // ✅ Broadcast rendered
  window.dispatchEvent(new CustomEvent("learn:rendered", { detail: w }));
}

function tryMountStroke(mountEl, hanChars) {
  if (!mountEl) return;
  mountEl.innerHTML = "";

  if (!hanChars?.length) return;

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
