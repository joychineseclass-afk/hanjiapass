// /ui/modules/hsk/hskRenderer.js ✅ FINAL
// - renderLessonList(container, lessons, { lang })
// - renderWordCards(gridEl, items, _, { lang })
// - Fixes: [object Object] by pickText()
// - Supports pinyinTitle in lesson list

function pickText(v, lang = "ko") {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    return (
      v[lang] ||
      v.ko || v.kr ||
      v.zh || v.cn ||
      v.en ||
      ""
    );
  }
  return String(v);
}

export function renderLessonList(containerEl, lessons, { lang = "ko" } = {}) {
  if (!containerEl) return;
  const list = Array.isArray(lessons) ? lessons : [];

  containerEl.innerHTML = `
    <div class="lesson-list">
      ${list.map((it) => {
        const lessonNo = Number(it.lessonNo ?? it.no ?? it.lesson ?? it.id ?? 0) || 0;
        const file = it.file || it.path || it.url || "";
        const titleObj = it.title ?? it.name ?? it.label ?? "";
        const title = pickText(titleObj, lang) || pickText(titleObj, lang === "ko" ? "zh" : "ko") || "";
        const zh = pickText(titleObj, "zh");
        const ko = pickText(titleObj, "ko");
        const pinyin = pickText(it.pinyinTitle ?? it.pinyin ?? it.py ?? "", "zh");

        // Display lines:
        // - KR mode: show KO big, ZH small, pinyin small
        // - CN mode: show ZH big, KO small, pinyin small
        const big = (lang === "zh" || lang === "cn") ? (zh || title) : (ko || title);
        const small = (lang === "zh" || lang === "cn") ? (ko || "") : (zh || "");

        return `
          <button class="lesson-row w-full text-left rounded-2xl border border-slate-200 hover:border-slate-300 px-4 py-3 mb-3"
            data-open-lesson="1"
            data-lesson-no="${lessonNo}"
            data-file="${escapeHtmlAttr(file)}"
          >
            <div class="flex items-center gap-3">
              <div class="w-14 text-sm font-bold opacity-70">${lessonNo ? `${lessonNo}과` : ""}</div>
              <div class="flex-1">
                <div class="text-base font-semibold">${escapeHtml(big)}</div>
                ${small ? `<div class="text-sm opacity-70">${escapeHtml(small)}</div>` : ``}
                ${pinyin ? `<div class="text-sm italic opacity-70">${escapeHtml(pinyin)}</div>` : ``}
              </div>
            </div>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

export function renderWordCards(gridEl, items, _unused, { lang = "ko" } = {}) {
  if (!gridEl) return;
  const arr = Array.isArray(items) ? items : [];

  gridEl.innerHTML = arr.map((x) => {
    // Common fields in your vocab:
    const han = pickText(x.han ?? x.word ?? x.zh ?? x.cn ?? x.simplified ?? x.trad ?? "", "zh");
    const pinyin = pickText(x.pinyin ?? x.py ?? x.p ?? "", "zh");
    const meaning = pickText(x.meaning ?? x.ko ?? x.kr ?? x.def ?? x.gloss ?? "", lang === "cn" ? "zh" : "ko");

    return `
      <div class="word-card bg-white rounded-2xl shadow p-4 border border-slate-100">
        <div class="text-2xl font-bold">${escapeHtml(han)}</div>
        ${pinyin ? `<div class="text-sm italic opacity-70 mt-1">${escapeHtml(pinyin)}</div>` : ``}
        ${meaning ? `<div class="text-sm mt-2">${escapeHtml(meaning)}</div>` : ``}
        <div class="mt-3">
          <button type="button" class="px-3 py-1 rounded-lg border text-sm opacity-80">
            Tap to Learn
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#96;");
}
