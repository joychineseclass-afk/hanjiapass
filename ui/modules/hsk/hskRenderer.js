// ui/modules/hsk/hskRenderer.js
// ✅ Ultimate Stable Renderer
// - Fix [object Object]
// - Beautiful learning cards
// - Ready for AI integration

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ==============================
   ✅ Universal Text Picker
   永远返回“可读文本”
============================== */
export function pickText(v, lang = "ko") {
  if (v == null) return "";

  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) {
    return v.map((x) => pickText(x, lang)).filter(Boolean).join(" / ");
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

    for (const k of Object.keys(v)) {
      const t = pickText(v[k], lang);
      if (t) return t;
    }
  }

  return "";
}

function cleanText(v, lang) {
  const t = pickText(v, lang);
  const s = String(t ?? "").trim();
  if (!s || s === "[object Object]") return "";
  return s;
}

/* ==============================
   ✅ Lesson List
============================== */
export function renderLessonList(container, lessons, onClickLesson, options = {}) {
  if (!container) return;
  container.innerHTML = "";

  const lang = options.lang || window.APP_LANG || "ko";

  (lessons || []).forEach((lesson, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "text-left bg-white rounded-2xl shadow p-5 hover:shadow-lg transition w-full border border-gray-100";

    const titleText =
      pickText(lesson?.title, lang) ||
      `Lesson ${lesson?.lesson ?? lesson?.id ?? idx + 1}`;

    const subText = pickText(lesson?.subtitle, lang);
    const count = Array.isArray(lesson?.words) ? lesson.words.length : 0;

    btn.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-bold text-gray-800">${escapeHtml(titleText)}</div>
          ${subText ? `<div class="text-sm text-gray-500 mt-1">${escapeHtml(subText)}</div>` : ""}
        </div>
        <div class="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">${count} 단어</div>
      </div>
    `;

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClickLesson?.(lesson);
    };

    container.appendChild(btn);
  });
}

/* ==============================
   ✅ Word Cards (BEAUTIFIED)
============================== */
export function renderWordCards(container, list, onClickWord, options = {}) {
  if (!container) return;
  container.innerHTML = "";

  const lang = options.lang || window.APP_LANG || "ko";
  const showLearnBadge = options.showLearnBadge !== false;

  const handleClick =
  typeof onClickWord === "function"
    ? onClickWord
    : (item) => window.LEARN_PANEL?.open?.(item);

  (list || []).forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "text-left bg-white rounded-2xl shadow-md p-5 hover:shadow-xl transition border border-gray-100";

    card.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleClick(item, { lang });
    };

    const word = cleanText(item?.word ?? item?.hanzi ?? item?.hz, lang) || "(빈 항목)";
    const pinyin = cleanText(item?.pinyin, lang);
    const meaning = cleanText(item?.meaning ?? item?.ko ?? item?.kr, lang);

    // ✅ Example fields (统一变量名：exampleZh / examplePy / exampleKr / exampleCn)
    const exampleZh = cleanText(
      item?.exampleZh ||
        item?.exampleZH ||
        item?.example_zh ||
        item?.sentenceZh ||
        item?.sentence ||
        item?.example,
      "zh"
    );

    const examplePy = cleanText(
      item?.examplePinyin ||
        item?.sentencePinyin ||
        item?.example_py ||
        item?.examplePY,
      lang
    );

    const exampleKr = cleanText(
      item?.exampleExplainKr ||
        item?.exampleKR ||
        item?.explainKr ||
        item?.krExplain ||
        item?.example?.kr,
      "ko"
    );

    const exampleCn = cleanText(
      item?.exampleExplainCn ||
        item?.exampleCN ||
        item?.explainCn ||
        item?.cnExplain ||
        item?.example?.zh,
      "zh"
    );

    // ✅ example block: zh + pinyin + (kr/cn explain)
    const hasExample = !!(exampleZh || examplePy || exampleKr || exampleCn);

    card.innerHTML = `
      <div class="text-2xl font-bold text-gray-800">${escapeHtml(word)}</div>
      ${pinyin ? `<div class="text-sm text-blue-600 mt-1">${escapeHtml(pinyin)}</div>` : ""}
      ${meaning ? `<div class="text-base text-gray-700 mt-2">${escapeHtml(meaning)}</div>` : ""}

      ${
        hasExample
          ? `<div class="mt-4 p-3 rounded-xl bg-gray-50 text-sm text-gray-700 space-y-1">
              ${exampleZh ? `<div>${escapeHtml(exampleZh)}</div>` : ""}
              ${examplePy ? `<div class="text-blue-600">${escapeHtml(examplePy)}</div>` : ""}
              ${exampleKr ? `<div class="text-gray-500">${escapeHtml(exampleKr)}</div>` : ""}
              ${exampleCn && !exampleKr ? `<div class="text-gray-500">${escapeHtml(exampleCn)}</div>` : ""}
            </div>`
          : ""
      }

      ${
        showLearnBadge
          ? `<div class="mt-3 inline-block text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-600">Tap to Learn</div>`
          : ""
      }
    `;

    container.appendChild(card);
  });
}

/* ==============================
   ✅ Global Bridge
============================== */
try {
  window.HSK_RENDER = window.HSK_RENDER || {};
  window.HSK_RENDER.renderWordCards = renderWordCards;
  window.HSK_RENDER.renderLessonList = renderLessonList;
  window.HSK_RENDER.pickText = pickText;
} catch {}

/* ==============================
   ✅ Word Modal
============================== */
function openWordDetail(word, opts = {}) {
  const lang = opts.lang || window.APP_LANG || "ko";

  const hanzi = cleanText(word?.word || word?.hanzi, lang);
  const pinyin = cleanText(word?.pinyin, lang);
  const meaning = cleanText(word?.meaning ?? word?.kr ?? word?.ko, lang);

  const exZh = cleanText(word?.exampleZh || word?.sentenceZh || word?.sentence || word?.example, "zh");
  const exPy = cleanText(word?.examplePinyin || word?.sentencePinyin, lang);
  const exKr = cleanText(word?.exampleExplainKr || word?.krExplain || word?.explainKr, "ko");

  const existing = document.querySelector(".word-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "word-modal";

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

  modal.onclick = (e) => e.target === modal && modal.remove();
  modal.querySelector(".modal-close").onclick = () => modal.remove();
  document.body.appendChild(modal);
}
