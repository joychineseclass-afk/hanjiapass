// /ui/modules/hsk/hskRenderer.js
// ✅ HSK Renderer (Lesson list + Word cards)
// - no duplicate identifier declarations (avoid escapeHtml redeclare crash)

function _escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}

// 兼容：如果你项目里已有 pickText，就用全局；没有就简单兜底
function _pickText(val, lang) {
  const fn = window?.pickText;
  if (typeof fn === "function") return fn(val, lang);

  // 常见结构：{ ko:"", zh:"", en:"" } 或 string
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    if (lang && val[lang] != null) return String(val[lang]);
    return String(val.ko ?? val.zh ?? val.en ?? "");
  }
  return "";
}

/* ===============================
   ✅ Lesson List (目录式纵向渲染)
   - 你要的“像课本目录那样一行一课”
================================== */
export function renderLessonList(container, lessons, onClickLesson, options = {}) {
  if (!container) return;
  const { lang = "ko" } = options;

  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "flex flex-col gap-2";

  lessons.forEach((lesson, idx) => {
    const titleText =
      _pickText(lesson?.title, lang) ||
      `Lesson ${lesson?.lesson ?? lesson?.id ?? idx + 1}`;

    const subText = _pickText(lesson?.subtitle, lang);
    const count = Array.isArray(lesson?.words) ? lesson.words.length : (Number(lesson?.count) || 0);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "w-full text-left border border-gray-200 rounded-xl px-4 py-3 bg-white hover:bg-gray-50 active:bg-gray-100 transition";

    btn.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-base font-bold text-gray-800 truncate">${_escapeHtml(titleText)}</div>
          ${subText ? `<div class="text-sm text-gray-500 mt-1">${_escapeHtml(subText)}</div>` : ""}
        </div>
        <div class="shrink-0 text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
          ${count ? `${count} 단어` : " "}
        </div>
      </div>
    `;

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof onClickLesson === "function") onClickLesson(lesson);
    };

    wrap.appendChild(btn);
  });

  container.appendChild(wrap);
}

/* ===============================
   ✅ Word Cards
================================== */
export function renderWordCards(container, list, onClickWord, options = {}) {
  if (!container) return;
  const { lang = "ko" } = options;

  container.innerHTML = "";
  const arr = Array.isArray(list) ? list : [];
  if (!arr.length) return;

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

  arr.forEach((w) => {
    const word = w?.word ?? "";
    const pinyin = w?.pinyin ?? "";
    const meaning = _pickText(w?.meaning ?? w?.def ?? w?.translation, lang);

    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "text-left bg-white border border-gray-200 rounded-2xl shadow-sm p-4 hover:bg-gray-50 active:bg-gray-100 transition";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-2xl font-extrabold text-gray-900">${_escapeHtml(word)}</div>
          ${pinyin ? `<div class="text-sm text-gray-500 mt-1">${_escapeHtml(pinyin)}</div>` : ""}
          ${meaning ? `<div class="text-sm text-gray-700 mt-2">${_escapeHtml(meaning)}</div>` : ""}
        </div>
        <div class="shrink-0 text-xs text-gray-400">Tap to Learn</div>
      </div>
    `;

    card.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof onClickWord === "function") onClickWord(w);
    };

    grid.appendChild(card);
  });

  container.appendChild(grid);
}
