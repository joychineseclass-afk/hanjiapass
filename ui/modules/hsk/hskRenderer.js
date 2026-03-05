// /ui/modules/hsk/hskRenderer.js ✅ FINAL
// - renderLessonList(container, lessons, { lang })
// - renderWordCards(gridEl, items, _, { lang })
// - Fixes: [object Object] by pickText()
// - Supports pinyinTitle in lesson list

import { i18n } from "../../i18n.js";

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
              <div class="w-14 text-sm font-bold opacity-70">${lessonNo ? (i18n?.t?.("hsk_lesson_unit", { n: lessonNo }) || `${lessonNo}과`) : ""}</div>
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

const MEANING_FALLBACK = {
  ko: "(뜻 정보 없음)",
  zh: "(暂无释义)",
  en: "(No meaning yet)",
};

// Extract meaning string from word / vocabMap hit. Supports:
// word.ko, word.kr, word.meaning.ko, word.meaning.kr
// word.en, word.meaning.en
// word.zh, word.cn, word.meaning.zh, word.meaning.cn
function extractMeaning(word, lang) {
  if (!word || typeof word !== "object") return "";
  const m = word.meaning;
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

  if (lang === "ko") {
    return str(word.ko) || str(word.kr) || (m && (str(m.ko) || str(m.kr))) || "";
  }
  if (lang === "en") {
    return str(word.en) || (m && str(m.en)) || "";
  }
  // zh
  return str(word.zh) || str(word.cn) || (m && (str(m.zh) || str(m.cn))) || "";
}

function meaningTextOf(val, lang) {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) return val.map(v => meaningTextOf(v, lang)).filter(Boolean).join(" / ");
  if (typeof val === "object") {
    const v = extractMeaning(val, lang);
    if (v) return v;
    const pick = val.meaning ?? val.text ?? val.def ?? val.gloss ?? "";
    if (typeof pick === "string") return pick.trim();
    if (typeof pick === "object") return extractMeaning({ meaning: pick }, lang) || extractMeaning(pick, lang);
    return "";
  }
  return String(val);
}

export function renderWordCards(gridEl, items, _unused, { lang } = {}) {
  if (!gridEl) return;
  const arr = Array.isArray(items) ? items : [];
  const resolvedLang = lang ?? i18n?.getLang?.() ?? "ko"; // ko|zh|en

  gridEl.innerHTML = arr.map((x) => {
    const raw = typeof x === "string" ? { hanzi: x } : (x || {});
    const han = String(raw.hanzi ?? raw.han ?? raw.word ?? raw.zh ?? raw.cn ?? raw.simplified ?? raw.trad ?? "").trim();
    const pinyin = String(raw.pinyin ?? raw.py ?? raw.p ?? "").trim();

    let meaningStr = meaningTextOf(raw, resolvedLang);
    if (meaningStr && meaningStr.includes("object Object")) meaningStr = "";

    if (!meaningStr) {
      console.warn("[renderWordCards] no meaning for word:", han, "| vocab/item:", raw);
      meaningStr = MEANING_FALLBACK[resolvedLang] ?? MEANING_FALLBACK.ko;
    }

    return `
      <div class="word-card bg-white rounded-2xl shadow p-4 border border-slate-100">
        <div class="hanzi text-2xl font-bold">${escapeHtml(han)}</div>
        ${pinyin ? `<div class="pinyin text-sm italic opacity-70 mt-1">${escapeHtml(pinyin)}</div>` : ``}
        <div class="meaning text-sm mt-2">${escapeHtml(meaningStr)}</div>
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
