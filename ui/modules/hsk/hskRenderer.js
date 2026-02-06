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

  const currentLang = options.lang || window.APP_LANG || "ko";
  const showLearnBadge = options.showLearnBadge !== false;

  (list || []).forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

    const word = pickText(item?.word, "zh") || "(빈 항목)";
    const pinyin = pickText(item?.pinyin, "zh");

    // ✅ 韩语意思（你的数据若是 ko 也兼容，因为 pickText 会兜底 ko/kr）
    const meaningKR = pickText(item?.meaning, "kr");

    // ✅ 例句分开取
    const exampleZH = pickText(item?.example, "zh");
    const exampleKR = pickText(item?.example, "kr");

    const line2 = [pinyin, meaningKR].filter(Boolean).join(" · ");

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="text-lg font-semibold">${escapeHtml(word)}</div>
        <div class="text-xs text-gray-400">${showLearnBadge ? "Learn" : ""}</div>
      </div>

      ${
        line2
          ? `<div class="mt-1 text-sm text-gray-600">${escapeHtml(line2)}</div>`
          : `<div class="mt-1 text-sm text-gray-600">&nbsp;</div>`
      }

      ${
        exampleZH
          ? `<div class="mt-2 text-xs text-gray-500">${escapeHtml(exampleZH)}</div>`
          : ""
      }
      ${
        exampleKR
          ? `<div class="text-xs text-gray-400">${escapeHtml(exampleKR)}</div>`
          : ""
      }
    `;

    card.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log("[HSK] card click:", item);
      onClickWord?.(item);
    });

    container.appendChild(card);
  });

  // ==============================
  // ✅ Global bridge for legacy UI (只执行一次，放在 forEach 外)
  // ==============================
  try {
  window.HSK_RENDER = window.HSK_RENDER || {};

  if (typeof window.HSK_RENDER.renderWordCards !== "function") {
    window.HSK_RENDER.renderWordCards = renderWordCards;
  }

  // ✅ 如果你项目里确实有 renderLessonList，就挂上
  if (typeof renderLessonList === "function" && typeof window.HSK_RENDER.renderLessonList !== "function") {
    window.HSK_RENDER.renderLessonList = renderLessonList;
  }
} catch (e) {}
