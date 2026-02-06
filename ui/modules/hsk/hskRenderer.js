// ui/modules/hsk/hskRenderer.js (ultimate, ESM)
// - Fix: meaning/example show as [object Object]
// - KO-first language picking, supports {ko, zh, en, ...}, arrays, nested objects
// - Safe HTML escaping
// - No window globals (ES Module)

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * ✅ pickText: 将任意数据稳定转为字符串（绝不返回 [object Object]）
 * - v: string | number | boolean | array | object
 * - lang: "ko" | "zh" | "en" | ...
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
    // 常见语言键优先（韩语优先）
    const direct =
      pickText(v?.[lang], lang) ||
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

    // 最后兜底：不显示 object
    return "";
  }

  return "";
}

/**
 * lessons: [{id,title,subtitle,words:[]}, ...]
 */
export function renderLessonList(container, lessons, onClickLesson) {
  if (!container) return;
  container.innerHTML = "";

  (lessons || []).forEach((lesson, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition w-full";

    const title = escapeHtml(lesson?.title || `Lesson ${lesson?.id ?? idx + 1}`);
    const sub = escapeHtml(lesson?.subtitle || "");
    const count = Array.isArray(lesson?.words) ? lesson.words.length : 0;

    btn.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-lg font-semibold">${title}</div>
          ${sub ? `<div class="text-sm text-gray-600 mt-1">${sub}</div>` : ""}
        </div>
        <div class="text-xs text-gray-400">${count}개</div>
      </div>
    `;

    btn.addEventListener("click", () => onClickLesson?.(lesson));
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

  const currentLang =
    options.lang ||
    window.APP_LANG || // 你以后全站语言可以继续用这个
    "ko";

  const showLearnBadge = options.showLearnBadge !== false;

  (list || []).forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

    const word = pickText(item?.word, currentLang) || "(빈 항목)";
    const pinyin = pickText(item?.pinyin, currentLang);
    const meaningText = pickText(item?.meaning, currentLang);
    const exampleText = pickText(item?.example, currentLang);

    const line2 = [pinyin, meaningText].filter(Boolean).join(" · ");
    
    // ✅ Example fields (stable, no crash)
// - exampleZh: 永远中文例句（主显示）
// - examplePinyin: 永远显示
// - exampleExplainKr / exampleExplainCn: 解释随系统语言变化
const lang = options?.lang || "kr"; // 你也可以改成从 localStorage 取
const exampleZh =
  item.exampleZh ||
  item.exampleZH ||
  item.example_zh ||
  item.example ||
  item.sentenceZh ||
  item.sentence ||
  "";

const examplePinyin =
  item.examplePinyin ||
  item.sentencePinyin ||
  item.example_py ||
  item.examplePY ||
  "";

const exampleExplainKr =
  item.exampleExplainKr ||
  item.exampleKR ||
  item.explainKr ||
  item.krExplain ||
  "";

const exampleExplainCn =
  item.exampleExplainCn ||
  item.exampleCN ||
  item.explainCn ||
  item.cnExplain ||
  "";

const lang = options?.lang || "ko";
const isZh = lang === "zh" || lang === "cn" || lang === "zh-cn";

const exampleExplain = isZh ? exampleExplainCn : exampleExplainKr;

    card.innerHTML = `
  <div class="flex items-center justify-between gap-2">
    <div class="text-lg font-semibold">${escapeHtml(word)}</div>
    <div class="text-xs text-gray-400">${showLearnBadge ? "Learn" : ""}</div>
  </div>

  ${line2
    ? `<div class="mt-1 text-sm text-gray-600">${escapeHtml(line2)}</div>`
    : `<div class="mt-1 text-sm text-gray-600">&nbsp;</div>`
  }

 ${exampleZh
  ? `<div class="mt-2 text-sm text-gray-700">${escapeHtml(exampleZh)}</div>`
  : ""}

${examplePinyin
  ? `<div class="mt-1 text-xs text-gray-500">${escapeHtml(examplePinyin)}</div>`
  : ""}

${exampleExplain
  ? `<div class="mt-1 text-xs text-gray-400">${escapeHtml(exampleExplain)}</div>`
  : ""}
`;

card.addEventListener("click", () => {
  onClickWord?.(item);
});

container.appendChild(card);
  });
}

// ==============================
// ✅ Global bridge for legacy UI
// ==============================
try {
  window.HSK_RENDER = window.HSK_RENDER || {};
  if (typeof renderWordCards === "function") {
    window.HSK_RENDER.renderWordCards =
      window.HSK_RENDER.renderWordCards || renderWordCards;
  }
  if (typeof renderLessonList === "function") {
    window.HSK_RENDER.renderLessonList =
      window.HSK_RENDER.renderLessonList || renderLessonList;
  }
} catch {}

/* ====== ✅ 新增：单词详情弹窗（放在文件最后）====== */
function openWordDetail(word) {
  const modal = document.createElement("div");
  modal.className = "word-modal";

  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-hanzi">${word.hanzi}</div>
      <div class="modal-pinyin">${word.pinyin}</div>
      <div class="modal-meaning">${word.kr}</div>

      <div class="modal-example">
        <p>${word.example?.zh || ""}</p>
        <p>${word.example?.kr || ""}</p>
      </div>

      <button class="modal-close">닫기</button>
    </div>
  `;

  modal.querySelector(".modal-close").onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  document.body.appendChild(modal);
}
