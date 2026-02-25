// /ui/modules/hsk/hskRenderer.js
// ✅ HSK Renderer (Lesson list + Word cards)
// - ESM exports + global bridge (window.HSK_RENDER.*) for backward compatibility
// - avoids duplicate identifier crashes

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

  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    if (lang && val[lang] != null) return String(val[lang]);
    return String(val.ko ?? val.zh ?? val.en ?? "");
  }
  return "";
}

// ✅ Lessons List (Directory style, safe, no duplicate helpers)
export function renderLessonList(container, lessons, onClickLesson, options = {}) {
  if (!container) return;

  const lang = options.lang || "ko";
  container.innerHTML = "";

  // ---------- helpers (local, no global name collisions) ----------
  const _escape = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const _pick = (v) => {
    // accept string or {ko,kr,zh,cn,en} like objects
    if (typeof v === "string") return v;
    if (!v || typeof v !== "object") return "";

    // try common keys
    const byLang =
      v?.[lang] ||
      v?.ko || v?.kr ||
      v?.zh || v?.cn ||
      v?.en ||
      "";

    return typeof byLang === "string" ? byLang : "";
  };

  const _lessonNo = (lesson, idx) => {
    const raw = lesson?.lessonNo ?? lesson?.lesson ?? lesson?.id ?? lesson?.no ?? lesson?.index;
    const n = Number(String(raw).match(/(\d+)/)?.[1] ?? (idx + 1));
    return Number.isFinite(n) ? n : (idx + 1);
  };

  const _titleBlock = (lesson, idx) => {
    // Try many possible fields (your loader fields differ by version)
    const no = _lessonNo(lesson, idx);

    const titleZh =
      _pick(lesson?.titleZh) ||
      _pick(lesson?.zhTitle) ||
      _pick(lesson?.title?.zh) ||
      _pick(lesson?.title?.cn) ||
      _pick(lesson?.title) ||
      "";

    const titleKo =
      _pick(lesson?.titleKo) ||
      _pick(lesson?.koTitle) ||
      _pick(lesson?.title?.ko) ||
      _pick(lesson?.title?.kr) ||
      _pick(lesson?.subtitle?.ko) ||
      _pick(lesson?.subtitle?.kr) ||
      _pick(lesson?.ko) ||
      _pick(lesson?.kr) ||
      "";

    const pinyin =
      _pick(lesson?.pinyin) ||
      _pick(lesson?.py) ||
      _pick(lesson?.titlePinyin) ||
      _pick(lesson?.pinyinTitle) ||
      "";

    // Fallback label if nothing
    const main =
      titleKo || titleZh || _pick(lesson?.subtitle) || `Lesson ${no}`;

    // Compose a neat 2-line directory item
    const line1 = `第 ${no} 课 · ${main}`;
    const line2Parts = [];
    if (titleZh && titleZh !== main) line2Parts.push(titleZh);
    if (pinyin) line2Parts.push(pinyin);
    if (titleKo && titleKo !== main) line2Parts.push(titleKo);

    return {
      no,
      line1,
      line2: line2Parts.join(" · "),
    };
  };

  // ---------- container styling (inline safe, minimal) ----------
  container.style.display = "block";
  container.style.padding = "4px 0";

  // ---------- render list ----------
  lessons.forEach((lesson, idx) => {
    const { no, line1, line2 } = _titleBlock(lesson, idx);

    const row = document.createElement("button");
    row.type = "button";
    row.style.width = "100%";
    row.style.textAlign = "left";
    row.style.border = "1px solid #e5e7eb";
    row.style.borderRadius = "12px";
    row.style.padding = "12px 14px";
    row.style.margin = "8px 0";
    row.style.background = "#fff";
    row.style.cursor = "pointer";

    row.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="min-width:0;">
          <div style="font-weight:800; font-size:15px; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${_escape(line1)}
          </div>
          ${
            line2
              ? `<div style="margin-top:4px; font-size:12px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                   ${_escape(line2)}
                 </div>`
              : ""
          }
        </div>
        <div style="flex:0 0 auto; font-size:12px; color:#9ca3af;">▶</div>
      </div>
    `;

    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClickLesson?.(lesson);
    });

    container.appendChild(row);
  });
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

/* ===============================
   ✅ Global Bridge (关键：兼容旧代码 window.HSK_RENDER.*)
   你现在页面提示缺 renderLessonList，就是因为这里没桥接
================================== */
try {
  const g = (window.HSK_RENDER = window.HSK_RENDER || {});
  g.renderLessonList = renderLessonList;
  g.renderWordCards = renderWordCards;
} catch {}
