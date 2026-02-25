// /ui/modules/hsk/hskRenderer.js
// ✅ Ultimate Stable Renderer (Hardened)
// - Fix [object Object]
// - Beautiful learning cards
// - Robust example extraction (string/object/array)
// - Safe fallback modal when LEARN_PANEL missing

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

    // fallback: first readable key
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
   ✅ Example Extractor (robust)
   - supports string/object/array
============================== */
function pickExampleBlock(item) {
  // normalize "example" source (can be string/object/array)
  const exAny =
    item?.example ??
    item?.sentence ??
    item?.eg ??
    item?.ex ??
    null;

  // direct fields override
  const exampleZh = cleanText(
    item?.exampleZh ||
      item?.exampleZH ||
      item?.example_zh ||
      item?.sentenceZh ||
      item?.sentenceZH ||
      (typeof exAny === "string" ? exAny : exAny?.zh || exAny?.cn),
    "zh"
  );

  const examplePy = cleanText(
    item?.examplePinyin ||
      item?.sentencePinyin ||
      item?.example_py ||
      item?.examplePY ||
      exAny?.pinyin ||
      exAny?.py,
    "zh" // pinyin is language-independent; using "zh" keeps object pick stable
  );

  const exampleKr = cleanText(
    item?.exampleExplainKr ||
      item?.exampleKR ||
      item?.explainKr ||
      item?.krExplain ||
      exAny?.ko ||
      exAny?.kr,
    "ko"
  );

  const exampleCnExplain = cleanText(
    item?.exampleExplainCn ||
      item?.exampleCN ||
      item?.explainCn ||
      item?.cnExplain ||
      exAny?.zhExplain ||
      exAny?.cnExplain ||
      exAny?.explainZh,
    "zh"
  );

  // if example is array of lines, try to join
  const exampleLines = Array.isArray(exAny)
    ? exAny.map((x) => cleanText(x, "zh")).filter(Boolean).join(" / ")
    : "";

  const zh = exampleZh || exampleLines;

  return {
    zh,
    py: examplePy,
    kr: exampleKr,
    cnExplain: exampleCnExplain,
    has: !!(zh || examplePy || exampleKr || exampleCnExplain),
  };
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
   ✅ Word Cards (BEAUTIFIED + hardened)
============================== */
export function renderWordCards(container, list, onClickWord, options = {}) {
  if (!container) return;
  container.innerHTML = "";

  const lang = options.lang || window.APP_LANG || "ko";
  const showLearnBadge = options.showLearnBadge !== false;

  const handleClick =
    typeof onClickWord === "function"
      ? onClickWord
      : (item, ctx) => {
          // prefer LEARN_PANEL
          if (window.LEARN_PANEL?.open) return window.LEARN_PANEL.open(item, ctx);
          // fallback modal
          return openWordDetail(item, ctx);
        };

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

    const word =
      cleanText(item?.word ?? item?.hanzi ?? item?.hz, lang) ||
      cleanText(item?.raw?.word ?? item?.raw?.hanzi, lang) ||
      "(빈 항목)";

    const pinyin = cleanText(item?.pinyin, lang);
    const meaning =
      cleanText(item?.meaning ?? item?.ko ?? item?.kr, lang) ||
      cleanText(item?.raw?.meaning ?? item?.raw?.ko ?? item?.raw?.kr, lang);

    const ex = pickExampleBlock(item);

    card.innerHTML = `
      <div class="text-2xl font-bold text-gray-800">${escapeHtml(word)}</div>
      ${pinyin ? `<div class="text-sm text-blue-600 mt-1">${escapeHtml(pinyin)}</div>` : ""}
      ${meaning ? `<div class="text-base text-gray-700 mt-2">${escapeHtml(meaning)}</div>` : ""}

      ${
        ex.has
          ? `<div class="mt-4 p-3 rounded-xl bg-gray-50 text-sm text-gray-700 space-y-1">
              ${ex.zh ? `<div>${escapeHtml(ex.zh)}</div>` : ""}
              ${ex.py ? `<div class="text-blue-600">${escapeHtml(ex.py)}</div>` : ""}
              ${ex.kr ? `<div class="text-gray-500">${escapeHtml(ex.kr)}</div>` : ""}
              ${ex.cnExplain && !ex.kr ? `<div class="text-gray-500">${escapeHtml(ex.cnExplain)}</div>` : ""}
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
   ✅ Global Bridge (compat)
============================== */
try {
  window.HSK_RENDER = window.HSK_RENDER || {};
  window.HSK_RENDER.renderWordCards = renderWordCards;
  window.HSK_RENDER.renderLessonList = renderLessonList;
  window.HSK_RENDER.pickText = pickText;
} catch {}

/* ==============================
   ✅ Word Modal (fallback)
   - only used when LEARN_PANEL missing
============================== */
function ensureWordModalCSS() {
  const id = "__joy_word_modal_css__";
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .joy-word-modal {
      position: fixed; inset: 0;
      z-index: 99999;
      background: rgba(0,0,0,0.62);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    .joy-word-modal-box{
      width: min(720px, 100%);
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      padding: 18px;
    }
    .joy-word-modal-hanzi{ font-size: 42px; font-weight: 800; color: #111827; line-height: 1.1; }
    .joy-word-modal-pinyin{ margin-top: 6px; color: #2563eb; font-size: 14px; }
    .joy-word-modal-meaning{ margin-top: 10px; color: #374151; font-size: 16px; }
    .joy-word-modal-example{
      margin-top: 14px;
      background: #f9fafb;
      border-radius: 14px;
      padding: 12px;
      color: #374151;
      font-size: 14px;
    }
    .joy-word-modal-close{
      margin-top: 14px;
      width: 100%;
      border: 0;
      background: #111827;
      color: #fff;
      border-radius: 14px;
      padding: 10px 14px;
      font-size: 14px;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

function openWordDetail(word, opts = {}) {
  ensureWordModalCSS();

  const lang = opts.lang || window.APP_LANG || "ko";

  const hanzi =
    cleanText(word?.word || word?.hanzi, lang) ||
    cleanText(word?.raw?.word || word?.raw?.hanzi, lang) ||
    "";

  const pinyin = cleanText(word?.pinyin, lang);
  const meaning =
    cleanText(word?.meaning ?? word?.kr ?? word?.ko, lang) ||
    cleanText(word?.raw?.meaning ?? word?.raw?.kr ?? word?.raw?.ko, lang);

  const ex = pickExampleBlock(word);

  const existing = document.querySelector(".joy-word-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "joy-word-modal";

  modal.innerHTML = `
    <div class="joy-word-modal-box">
      <div class="joy-word-modal-hanzi">${escapeHtml(hanzi)}</div>
      ${pinyin ? `<div class="joy-word-modal-pinyin">${escapeHtml(pinyin)}</div>` : ""}
      ${meaning ? `<div class="joy-word-modal-meaning">${escapeHtml(meaning)}</div>` : ""}

      ${
        ex.has
          ? `<div class="joy-word-modal-example">
              ${ex.zh ? `<div>${escapeHtml(ex.zh)}</div>` : ""}
              ${ex.py ? `<div style="color:#2563eb;margin-top:4px;">${escapeHtml(ex.py)}</div>` : ""}
              ${ex.kr ? `<div style="color:#6b7280;margin-top:6px;">${escapeHtml(ex.kr)}</div>` : ""}
              ${ex.cnExplain && !ex.kr ? `<div style="color:#6b7280;margin-top:6px;">${escapeHtml(ex.cnExplain)}</div>` : ""}
            </div>`
          : ""
      }

      <button type="button" class="joy-word-modal-close">닫기</button>
    </div>
  `;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  modal.querySelector(".joy-word-modal-close")?.addEventListener("click", () => modal.remove());

  document.body.appendChild(modal);
}
