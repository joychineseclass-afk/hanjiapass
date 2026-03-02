// /ui/modules/hsk/hskRenderer.js
// ✅ HSK Renderer — FINAL (Lesson list + Word cards)
// Goals:
// 1) Lesson list badge ("第1课 / 1과 / Lesson 1") follows system lang (options.lang)
// 2) Right side shows 3 lines like your handwritten format: KO / ZH / PINYIN
// 3) Robust field picking (works with different loader shapes)
// 4) No duplicate identifier crashes, safe HTML, keeps global bridge window.HSK_RENDER.*
//
// Usage:
// renderLessonList(container, lessons, onClick, { lang: currentLang })

/* ===============================
   ✅ Small utils (safe, local)
================================== */
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

// Prefer your global pickText if exists; else fallback
function _pickText(val, lang) {
  const fn = window?.pickText;
  if (typeof fn === "function") return fn(val, lang);

  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const L = String(lang || "").toLowerCase();
    if (L && val[L] != null) return String(val[L]);
    return String(val.ko ?? val.kr ?? val.zh ?? val.cn ?? val.en ?? "");
  }
  return "";
}

function _normLang(lang) {
  const L = String(lang || "").trim().toLowerCase();
  if (!L) return "ko";
  if (L === "kr") return "ko";
  if (L.startsWith("zh")) return "zh";
  if (L.startsWith("en")) return "en";
  if (L.startsWith("ko")) return "ko";
  return L;
}

function _getLessonNo(lesson, idx = 0) {
  const raw =
    lesson?.lessonNo ??
    lesson?.no ??
    lesson?.index ??
    lesson?.lesson ??
    lesson?.id ??
    (idx + 1);

  const m = String(raw).match(/(\d+)/);
  const n = Number(m?.[1] ?? (idx + 1));
  return Number.isFinite(n) ? n : (idx + 1);
}

function _formatLessonBadge(no, lang) {
  const L = _normLang(lang);
  if (L === "ko") return `${no}과`;
  if (L === "zh") return `第${no}课`;
  if (L === "en") return `Lesson ${no}`;
  return `#${no}`;
}

// Accept: string OR {ko/kr/zh/cn/en} OR {title:{ko,zh,...}}
function _pickAny(v, lang) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    // try direct pick by lang + common keys
    const L = _normLang(lang);
    const byLang =
      v?.[L] ??
      v?.ko ?? v?.kr ??
      v?.zh ?? v?.cn ??
      v?.en ??
      "";
    return typeof byLang === "string" ? byLang : "";
  }
  return "";
}

function _pickLessonParts(lesson) {
  // KO
  const ko =
    _pickAny(lesson?.koTitle) ||
    _pickAny(lesson?.titleKo) ||
    _pickAny(lesson?.title_ko) ||
    _pickAny(lesson?.title?.ko) ||
    _pickAny(lesson?.title?.kr) ||
    _pickAny(lesson?.subtitle?.ko) ||
    _pickAny(lesson?.subtitle?.kr) ||
    _pickAny(lesson?.ko) ||
    _pickAny(lesson?.kr) ||
    "";

  // ZH
  const zh =
    _pickAny(lesson?.zhTitle) ||
    _pickAny(lesson?.titleZh) ||
    _pickAny(lesson?.title_zh) ||
    _pickAny(lesson?.title?.zh) ||
    _pickAny(lesson?.title?.cn) ||
    _pickAny(lesson?.zh) ||
    _pickAny(lesson?.cn) ||
    // some lists put main title in `title` as string (often zh)
    (typeof lesson?.title === "string" ? lesson.title : "") ||
    "";

  // PINYIN
  const py =
    _pickAny(lesson?.pinyin) ||
    _pickAny(lesson?.py) ||
    _pickAny(lesson?.titlePinyin) ||
    _pickAny(lesson?.pinyinTitle) ||
    _pickAny(lesson?.title_pinyin) ||
    "";

  return {
    ko: String(ko || "").trim(),
    zh: String(zh || "").trim(),
    py: String(py || "").trim(),
  };
}

/* ===============================
   ✅ Lessons List (Handwritten-style)
   - Left badge: 第1课 / 1과 / Lesson 1  (follows lang)
   - Right: 3 lines (KO / ZH / PINYIN)
================================== */
export function renderLessonList(container, lessons, onClickLesson, options = {}) {
  if (!container) return;

  const lang = _normLang(options?.lang || "ko");
  const arr = Array.isArray(lessons) ? lessons : [];

  container.innerHTML = "";
  container.style.display = "block";
  container.style.padding = "4px 0";

  if (!arr.length) return;

  arr.forEach((lesson, idx) => {
    const no = _getLessonNo(lesson, idx);
    const badge = _formatLessonBadge(no, lang);
    const { ko, zh, py } = _pickLessonParts(lesson);

    const row = document.createElement("button");
    row.type = "button";
    row.style.width = "100%";
    row.style.textAlign = "left";
    row.style.border = "1px solid #e5e7eb";
    row.style.borderRadius = "14px";
    row.style.padding = "12px 14px";
    row.style.margin = "8px 0";
    row.style.background = "#fff";
    row.style.cursor = "pointer";

    // ✅ Keep right side always KO / ZH / PY in this order (your handwritten)
    // If some part missing, it will just not render that line.
    const lineKo = ko ? `<div style="font-weight:800; font-size:15px; color:#111827;">${_escapeHtml(ko)}</div>` : "";
    const lineZh = zh ? `<div style="font-size:13px; color:#111827; opacity:.9;">${_escapeHtml(zh)}</div>` : "";
    const linePy = py ? `<div style="font-size:12px; color:#6b7280; font-style:italic;">${_escapeHtml(py)}</div>` : "";

    // fallback if everything empty (avoid blank)
    const fallbackTitle = (!ko && !zh && !py)
      ? `<div style="font-weight:800; font-size:15px; color:#111827;">${_escapeHtml(badge)}</div>`
      : "";

    row.innerHTML = `
      <div style="display:flex; gap:12px; align-items:stretch;">
        <div
          style="min-width:86px; display:flex; align-items:center; justify-content:center;
                 font-weight:900; font-size:14px; color:#111827;
                 border-radius:14px; padding:10px 12px; background:rgba(0,0,0,.04);">
          ${_escapeHtml(badge)}
        </div>

        <div style="min-width:0; display:flex; flex-direction:column; justify-content:center; gap:4px;">
          ${fallbackTitle}
          ${lineKo}
          ${lineZh}
          ${linePy}
        </div>

        <div style="flex:1 1 auto;"></div>
        <div style="flex:0 0 auto; display:flex; align-items:center; color:#9ca3af; font-size:12px;">▶</div>
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
  const lang = _normLang(options?.lang || "ko");

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
   ✅ Global Bridge (compat)
================================== */
try {
  const g = (window.HSK_RENDER = window.HSK_RENDER || {});
  g.renderLessonList = renderLessonList;
  g.renderWordCards = renderWordCards;
} catch {}
