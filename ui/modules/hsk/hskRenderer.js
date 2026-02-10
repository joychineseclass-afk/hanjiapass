// ui/modules/hsk/hskRenderer.js (ultimate, ESM)
// - Fix: meaning/example show as [object Object]
// - Supports i18n objects: {kr/ko, zh/cn, en, ...}
// - Safe HTML escaping
// - Exposes window.HSK_RENDER bridge for legacy callers

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * ✅ pickText: 将任意数据稳定转为字符串（绝不返回 [object Object]）
 * - v: string | number | boolean | array | object
 * - lang: "ko" | "kr" | "zh" | "cn" | "en" | ...
 * - 优先：lang -> ko/kr -> zh/cn -> en -> first available
 */
export function pickText(v, lang = "ko") {
  if (v == null) return "";

  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) {
    return v
      .map((x) => pickText(x, lang))
      .map((x) => x.trim())
      .filter(Boolean)
      .join(" / ");
  }

  if (typeof v === "object") {
    const L = String(lang || "").toLowerCase();

    const direct =
      pickText(v?.[L], lang) ||
      pickText(v?.ko, lang) ||
      pickText(v?.kr, lang) ||
      pickText(v?.zh, lang) ||
      pickText(v?.cn, lang) ||
      pickText(v?.en, lang);

    if (direct) return direct;

    // 兜底：遍历对象值，找到第一个可显示文本
    for (const k of Object.keys(v)) {
      const t = pickText(v[k], lang);
      if (t) return t;
    }

    return "";
  }

  return "";
}

// ==============================
// ✅ Lesson list renderer
// lessons: [{lesson,id,title,subtitle,words:[],file}, ...]
// - title can be string or {zh,kr,en,...}
// ==============================
export function renderLessonList(container, lessons, onClickLesson, options = {}) {
  if (!container) return;
  container.innerHTML = "";

  const lang = options.lang || window.APP_LANG || "ko";

  (lessons || []).forEach((lesson, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition w-full";

    const titleText =
      pickText(lesson?.title, lang) ||
      pickText(lesson?.title, "ko") ||
      pickText(lesson?.title, "zh") ||
      `Lesson ${lesson?.lesson ?? lesson?.id ?? idx + 1}`;

    const subText = pickText(lesson?.subtitle, lang);
    const count = Array.isArray(lesson?.words) ? lesson.words.length : 0;

    btn.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-lg font-semibold">${escapeHtml(titleText)}</div>
          ${subText ? `<div class="text-sm text-gray-600 mt-1">${escapeHtml(subText)}</div>` : ""}
        </div>
        <div class="text-xs text-gray-400">${count}개</div>
      </div>
    `;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClickLesson?.(lesson);
    });

    container.appendChild(btn);
  });
}

/**
 * options
 * - lang: "ko" | "zh" | "en" ...
 * - showLearnBadge: true/false
 */
export function renderWordCards(container, list, onClickWord, options = {}) {
  if (!container) return;

  container.innerHTML = "";

  const lang = options.lang || window.APP_LANG || "ko";
  const showLearnBadge = options.showLearnBadge !== false;

  // ✅ onClickWord 防御：没有传回调也能打开弹窗
  const handleClick = typeof onClickWord === "function" ? onClickWord : openWordDetail;

  // ✅ 让卡片区不被上层 Router 误捕获（兜底）
  container.addEventListener(
    "click",
    (e) => {
      e.stopPropagation();
    },
    false
  );

  (list || []).forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

    // ✅ 防 Router / Hash 跳转误触发
    card.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleClick(item, { lang });
    });

    const word = pickText(item?.word ?? item?.hanzi ?? item?.hz, lang) || "(빈 항목)";
    const pinyin = pickText(item?.pinyin, lang);
    const meaningText = pickText(item?.meaning ?? item?.meanings ?? item?.ko ?? item?.kr, lang);

    const line2 = [pinyin, meaningText].filter(Boolean).join(" · ");

    // ✅ Example fields（全部过 pickText）
    const exampleZh = pickText(
      item?.exampleZh ||
        item?.exampleZH ||
        item?.example_zh ||
        item?.sentenceZh ||
        item?.sentence ||
        item?.example,
      "zh"
    );

    const examplePinyin = pickText(
      item?.examplePinyin ||
        item?.sentencePinyin ||
        item?.example_py ||
        item?.examplePY,
      lang
    );

    const exampleExplainKr = pickText(
      item?.exampleExplainKr ||
        item?.exampleKR ||
        item?.explainKr ||
        item?.krExplain ||
        item?.example?.kr,
      "ko"
    );

    const exampleExplainCn = pickText(
      item?.exampleExplainCn ||
        item?.exampleCN ||
        item?.explainCn ||
        item?.cnExplain ||
        item?.example?.zh,
      "zh"
    );

    const exLines = [exampleZh, examplePinyin, exampleExplainKr, exampleExplainCn].filter(Boolean);

    const exampleBlock = exLines.length
      ? `<div class="mt-2 text-sm text-gray-600">${exLines
          .map((t) => `<div>${escapeHtml(t)}</div>`)
          .join("")}</div>`
      : "";

    const learnBadge = showLearnBadge
      ? `<div class="mt-2 inline-block text-xs px-2 py-1 rounded-full bg-gray-100">Learn</div>`
      : "";

    card.innerHTML = `
      <div class="text-xl font-semibold">${escapeHtml(word)}</div>
      ${line2 ? `<div class="mt-1 text-sm text-gray-500">${escapeHtml(line2)}</div>` : ""}
      ${learnBadge}
      ${exampleBlock}
    `;

    container.appendChild(card);
  });
}

// ==============================
// ✅ Global bridge for legacy UI
// ==============================
try {
  window.HSK_RENDER = window.HSK_RENDER || {};
  window.HSK_RENDER.renderWordCards = window.HSK_RENDER.renderWordCards || renderWordCards;
  window.HSK_RENDER.renderLessonList = window.HSK_RENDER.renderLessonList || renderLessonList;
  window.HSK_RENDER.pickText = window.HSK_RENDER.pickText || pickText;
} catch {}

/* ==============================
// ✅ Word detail modal
// ============================== */
function openWordDetail(word, opts = {}) {
  const modal = document.createElement("div");
  modal.className = "word-modal";

  const lang = opts.lang || window.APP_LANG || "ko";

  const hanzi = pickText(word?.hanzi || word?.word, lang);
  const pinyin = pickText(word?.pinyin, lang);

  const meaning =
    pickText(word?.meaning, lang) ||
    pickText(word?.kr, lang) ||
    pickText(word?.ko, lang) ||
    pickText(word?.meaningKr, lang) ||
    pickText(word?.meaning_kr, lang);

  const exZh =
    pickText(word?.exampleZh, "zh") ||
    pickText(word?.example_zh, "zh") ||
    pickText(word?.sentenceZh, "zh") ||
    pickText(word?.sentence, "zh") ||
    pickText(word?.example?.zh, "zh") ||
    pickText(word?.example, "zh");

  const exPy =
    pickText(word?.examplePinyin, lang) ||
    pickText(word?.sentencePinyin, lang) ||
    pickText(word?.example_py, lang) ||
    pickText(word?.examplePY, lang);

  const exKr =
    pickText(word?.exampleExplainKr, "ko") ||
    pickText(word?.exampleKR, "ko") ||
    pickText(word?.explainKr, "ko") ||
    pickText(word?.krExplain, "ko") ||
    pickText(word?.example?.kr, "ko");

  // ✅ 避免重复创建多个弹窗
  const existing = document.querySelector(".word-modal");
  if (existing) existing.remove();

  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-hanzi">${escapeHtml(hanzi)}</div>
      ${pinyin ? `<div class="modal-pinyin">${escapeHtml(pinyin)}</div>` : ""}
      ${meaning ? `<div class="modal-meaning">${escapeHtml(meaning)}</div>` : ""}

      ${(exZh || exPy || exKr)
        ? `<div class="modal-example">
            ${exZh ? `<p>${escapeHtml(exZh)}</p>` : ""}
            ${exPy ? `<p>${escapeHtml(exPy)}</p>` : ""}
            ${exKr ? `<p>${escapeHtml(exKr)}</p>` : ""}
          </div>`
        : ""}

      <button type="button" class="modal-close">닫기</button>
    </div>
  `;

  const closeBtn = modal.querySelector(".modal-close");
  if (closeBtn) closeBtn.onclick = () => modal.remove();

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  document.body.appendChild(modal);
}
