// /ui/pages/hsk/hskExtensionTab.js
// HSK Extension tab rendering (split from page.hsk.js Step 5).
// - Flat extension cards (phrase / meaning / explanation / example)
// - Grouped reading material cards
// - HSK3.0 layout=calendarGrid special article
// - HSK3.0 · HSK1 speak-pilot TTS buttons
// - Review-mode delegated to hskRenderer.renderReviewExtension
//
// ctx:
// {
//   lessonData,
//   lang,
//   isReviewLesson,
//   isHsk30Hsk1SpeakPilot,
// }

import { i18n } from "../../i18n.js";
import { renderReviewExtension } from "../../modules/hsk/hskRenderer.js";
import {
  escapeHtml,
  trimStr,
  getControlledLangText,
  getStrictLangText,
  normalizePracticeLangAliases,
} from "./hskPageUtils.js";

/**
 * Extension explanation — only explanation / note-like content.
 * Do NOT mix with main meaning / translation.
 */
export function getExtensionExplanation(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang);
  const str = (v) => trimStr(v);

  const explain = item.explain ?? item.explanation;
  if (explain && typeof explain === "object") {
    if (l === "kr") return str(explain.kr) || str(explain.ko) || "";
    if (l === "jp") return str(explain.jp) || str(explain.ja) || "";
    if (l === "cn") return str(explain.cn) || str(explain.zh) || "";
    return str(explain.en) || "";
  }

  if (l === "kr") {
    const flat = str(item.explainKr) || str(item.explanationKr) || str(item.explain_kr) || str(item.explanation_kr);
    if (flat) return flat;
  }
  if (l === "jp") {
    const flat = str(item.explainJp) || str(item.explanationJp) || str(item.explain_jp) || str(item.explanation_jp);
    if (flat) return flat;
  }
  if (l === "cn") {
    const flat = str(item.explainCn) || str(item.explanationCn) || str(item.explain_zh) || str(item.explanation_zh);
    if (flat) return flat;
  }
  if (l === "en") {
    const flat = str(item.explainEn) || str(item.explanationEn) || str(item.explain_en) || str(item.explanation_en);
    if (flat) return flat;
  }

  const note = item.note;
  if (note && typeof note === "object") {
    return getStrictLangText(note, l) || "";
  }
  if (typeof note === "string" && note.trim()) {
    return str(note);
  }

  return "";
}

/**
 * Extension main meaning
 * Current UI language first, then English, then Chinese.
 * Never jump kr <-> jp randomly.
 */
export function getExtensionMeaning(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang);

  if (l === "kr") {
    return (
      trimStr(item.kr) ||
      trimStr(item.ko) ||
      trimStr(item.translationKr) ||
      trimStr(item.translation_kr) ||
      trimStr(item.en) ||
      trimStr(item.translationEn) ||
      trimStr(item.translation_en) ||
      trimStr(item.cn) ||
      trimStr(item.zh) ||
      ""
    );
  }

  if (l === "jp") {
    return (
      trimStr(item.jp) ||
      trimStr(item.ja) ||
      trimStr(item.translationJp) ||
      trimStr(item.translation_jp) ||
      trimStr(item.en) ||
      trimStr(item.translationEn) ||
      trimStr(item.translation_en) ||
      trimStr(item.cn) ||
      trimStr(item.zh) ||
      ""
    );
  }

  if (l === "cn") {
    return (
      trimStr(item.cn) ||
      trimStr(item.zh) ||
      trimStr(item.en) ||
      trimStr(item.translationEn) ||
      trimStr(item.translation_en) ||
      ""
    );
  }

  return (
    trimStr(item.en) ||
    trimStr(item.translationEn) ||
    trimStr(item.translation_en) ||
    trimStr(item.cn) ||
    trimStr(item.zh) ||
    ""
  );
}

/** Extension items array (generatedExtensions > extension). */
export function getExtensionItemsArray(raw) {
  return Array.isArray(raw?.generatedExtensions) && raw.generatedExtensions.length
    ? raw.generatedExtensions
    : Array.isArray(raw?.extension)
      ? raw.extension
      : [];
}

/** Flat extension card speak segments. */
export function buildExtensionFlatSpeakSegments(item, lang) {
  const str = (v) => trimStr(v);
  const phrase = str(item?.phrase || item?.hanzi || item?.zh || item?.cn || item?.line);
  const meaning = getExtensionMeaning(item, lang);
  const explanation = getExtensionExplanation(item, lang);
  const example = str(item?.example || item?.exampleZh);
  const segs = [];
  if (phrase) segs.push({ zh: phrase, ui: meaning || "" });
  else if (meaning) segs.push({ ui: meaning });
  if (explanation && explanation !== meaning) segs.push({ ui: explanation });
  if (example) {
    const exMean = str(item?.exampleTranslation || item?.exampleMean || item?.exampleKr || "");
    segs.push({ zh: example, ui: exMean });
  }
  return segs;
}

/** Grouped extension card (reading material etc.) speak segments. */
export function buildExtensionGroupSpeakSegments(item, lang) {
  const str = (v) => trimStr(v);
  const pickObj = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return getControlledLangText(obj, lang, "extension object");
  };
  const pickTrans = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return getControlledLangText(obj, lang, "extension translation");
  };
  const gt = item?.groupTitle;
  const titleZh = gt && typeof gt === "object" ? str(gt.zh || gt.cn) : "";
  const titleUi = pickObj(item?.groupTitle) || str(item?.focusGrammar || "");
  const note = pickObj(item?.note);
  const sentences = Array.isArray(item?.sentences) ? item.sentences : [];
  const segs = [];
  if (titleZh) segs.push({ zh: titleZh, ui: titleUi && titleUi !== titleZh ? titleUi : "" });
  else if (titleUi) segs.push({ ui: titleUi });
  if (note) segs.push({ ui: note });
  for (const s of sentences) {
    const cn = str(s?.cn || s?.zh || "");
    const trans = pickTrans(s?.translations || s?.translation);
    if (cn) segs.push({ zh: cn, ui: trans || "" });
  }
  return segs;
}

/* -------- Calendar-grid (HSK3.0 data-driven layout=calendarGrid) -------- */

function _hsk30CnNumeralDay(d) {
  const t = [
    "",
    "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "二十一", "二十二", "二十三", "二十四", "二十五", "二十六", "二十七", "二十八", "二十九", "三十",
    "三十一",
  ];
  return d >= 1 && d <= 31 ? t[d] : String(d);
}

function _hsk30CnNumeralMonth(m) {
  const t = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
  return m >= 1 && m <= 12 ? t[m] : String(m);
}

function _hsk30SpeakZhForCalendarDate(_y, month, day) {
  return `${_hsk30CnNumeralMonth(month)}月${_hsk30CnNumeralDay(day)}日`;
}

function buildHsk30ExtensionCalendarArticle(item, index, lang, speakPilot, speakLabel) {
  const str = (v) => trimStr(v);
  const pickObj = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return getControlledLangText(obj, lang, "extension object");
  };
  const pickTrans = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return getControlledLangText(obj, lang, "extension translation");
  };

  const cal = item.calendar || {};
  const year = Number(cal.year);
  const month = Number(cal.month);
  const y = Number.isFinite(year) && year > 1900 ? year : 2026;
  const mo = Number.isFinite(month) && month >= 1 && month <= 12 ? month : 5;
  const weekStartsOn = Number(cal.weekStartsOn) === 0 ? 0 : 1;

  const first = new Date(y, mo - 1, 1);
  const lastDay = new Date(y, mo, 0).getDate();
  let lead;
  if (weekStartsOn === 1) {
    lead = (first.getDay() + 6) % 7;
  } else {
    lead = first.getDay();
  }

  const monthLabel =
    cal.monthLabel && typeof cal.monthLabel === "object"
      ? pickObj(cal.monthLabel) || `${y}年${mo}月`
      : `${y}年${mo}月`;

  const wdZh =
    Array.isArray(cal.weekdayZh) && cal.weekdayZh.length === 7
      ? cal.weekdayZh
      : ["一", "二", "三", "四", "五", "六", "日"];

  const cells = [];
  for (let k = 0; k < lead; k++) cells.push({ type: "empty" });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({
      type: "day",
      day: d,
      speakZh: _hsk30SpeakZhForCalendarDate(y, mo, d),
    });
  }
  while (cells.length % 7 !== 0) cells.push({ type: "empty" });

  const headerRow = wdZh
    .map((w) => `<div class="hsk30-cal-wdhead">${escapeHtml(w)}</div>`)
    .join("");

  const bodyCells = cells
    .map((c) => {
      if (c.type === "empty") {
        return `<div class="hsk30-cal-cell is-empty" aria-hidden="true"></div>`;
      }
      const zhEsc = escapeHtml(c.speakZh).replaceAll('"', "&quot;");
      // 试点模式下扩展句默认不绑点读（由顶部 듣기 链式朗读）；日历格必须始终可点读单日。
      const attrs = c.speakZh ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";
      return `<div class="hsk30-cal-cell"${attrs}>
  <span class="hsk30-cal-daynum">${escapeHtml(String(c.day))}</span>
</div>`;
    })
    .join("");

  const sentences = Array.isArray(item.sentences) ? item.sentences : [];
  const sentencesHtml = sentences
    .map((s) => {
      const cn = str((s && s.cn) || (s && s.zh) || "");
      const py = str((s && s.pinyin) || (s && s.py) || "");
      const trans = pickTrans(s && (s.translations || s.translation));
      const zhEsc = escapeHtml(cn).replaceAll('"', "&quot;");
      const attrs = cn && !speakPilot ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";
      const sentBtn =
        cn && !speakPilot
          ? `<button type="button" class="lesson-extension-audio-btn text-xs mt-1" data-speak-text="${zhEsc}" data-speak-kind="extension">${escapeHtml(speakLabel)}</button>`
          : "";
      return `<div class="lesson-extension-sentence">
          <div class="lesson-extension-sentence-zh"${attrs}>${escapeHtml(cn)}</div>
          ${py ? `<div class="lesson-extension-sentence-pinyin">${escapeHtml(py)}</div>` : ""}
          ${trans ? `<div class="lesson-extension-sentence-trans">${escapeHtml(trans)}</div>` : ""}
          ${sentBtn}
        </div>`;
    })
    .join("");

  const groupTitle =
    pickObj(item.groupTitle) || str(item.focusGrammar) || i18n.t("hsk.extension_group", "句型练习");

  const note = pickObj(item.note);

  const groupListenBtn =
    speakPilot && sentences.length
      ? `<button type="button" class="lesson-extension-audio-btn hsk30-ext-listen" data-hsk30-ext-group-idx="${index}">${escapeHtml(speakLabel)}</button>`
      : "";

  return `<article class="lesson-extension-group-card lesson-extension-calendar-wrap">
  <div class="lesson-extension-group-header">
    <span class="lesson-extension-group-index">${String(index + 1).padStart(2, "0")}</span>
    <h4 class="lesson-extension-group-title">${escapeHtml(groupTitle)}</h4>
    ${item.focusGrammar ? `<span class="lesson-extension-focus">${escapeHtml(str(item.focusGrammar))}</span>` : ""}
    ${groupListenBtn}
  </div>
  <div class="hsk30-cal-panel">
    <div class="hsk30-cal-monthline">${escapeHtml(monthLabel)}</div>
    <div class="hsk30-cal-wdheadrow">${headerRow}</div>
    <div class="hsk30-cal-grid">${bodyCells}</div>
  </div>
  ${sentencesHtml ? `<div class="lesson-extension-sentences lesson-extension-sentences-after-cal">${sentencesHtml}</div>` : ""}
  ${note ? `<div class="lesson-extension-note">${escapeHtml(note)}</div>` : ""}
</article>`;
}

/** Build extension tab HTML (non-review). */
export function buildExtensionHTML(lessonData, ctx) {
  const { lang, isHsk30Hsk1SpeakPilot } = ctx || {};
  const raw = (lessonData && lessonData._raw) || lessonData;
  const arr =
    Array.isArray(raw && raw.generatedExtensions) && raw.generatedExtensions.length
      ? raw.generatedExtensions
      : Array.isArray(raw && raw.extension)
        ? raw.extension
        : [];

  const speakPilot = !!isHsk30Hsk1SpeakPilot;
  const speakLabel = i18n.t("hsk.extension_speak");

  const hero = `<section class="lesson-section-hero lesson-extension-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.section.extension") || i18n.t("hsk.extension_title"))}</h3>
  <span class="lesson-extension-badge">${escapeHtml(i18n.t("hsk.extension_badge"))}</span>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.desc.extension") || i18n.t("hsk.extension_subtitle"))}</p>
  <p class="lesson-extension-tip">${escapeHtml(i18n.t("extension.tip"))}</p>
</section>`;

  if (!arr.length) {
    const emptyMsg = i18n.t("hsk.extension_no_content") || "本课暂无额外扩展内容。";
    return `${hero}<div class="lesson-extension-empty">${escapeHtml(emptyMsg)}</div>`;
  }

  const str = (v) => trimStr(v);

  const pickObj = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return getControlledLangText(obj, lang, "extension object");
  };

  const pickTrans = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return getControlledLangText(obj, lang, "extension translation");
  };

  const cards = arr.map((item, i) => {
    const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];

    if (str(item.layout) === "calendarGrid" && item.calendar && typeof item.calendar === "object") {
      return buildHsk30ExtensionCalendarArticle(item, i, lang, speakPilot, speakLabel);
    }

    const isGroup = sentences.length > 0 && (item.groupTitle || item.focusGrammar);

    if (isGroup) {
      const groupTitle =
        pickObj(item.groupTitle) ||
        str(item.focusGrammar) ||
        `${i18n.t("hsk.extension_group", "句型练习")} ${i + 1}`;

      const note = pickObj(item.note);

      const sentencesHtml = sentences.map((s) => {
        const cn = str((s && s.cn) || (s && s.zh) || "");
        const py = str((s && s.pinyin) || (s && s.py) || "");
        const trans = pickTrans(s && (s.translations || s.translation));
        const zhEsc = escapeHtml(cn).replaceAll('"', "&quot;");
        const attrs = cn && !speakPilot ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";
        const sentBtn =
          cn && !speakPilot
            ? `<button type="button" class="lesson-extension-audio-btn text-xs mt-1" data-speak-text="${zhEsc}" data-speak-kind="extension">${escapeHtml(speakLabel)}</button>`
            : "";

        return `<div class="lesson-extension-sentence">
          <div class="lesson-extension-sentence-zh"${attrs}>${escapeHtml(cn)}</div>
          ${py ? `<div class="lesson-extension-sentence-pinyin">${escapeHtml(py)}</div>` : ""}
          ${trans ? `<div class="lesson-extension-sentence-trans">${escapeHtml(trans)}</div>` : ""}
          ${sentBtn}
        </div>`;
      }).join("");

      const groupListenBtn = speakPilot
        ? `<button type="button" class="lesson-extension-audio-btn hsk30-ext-listen" data-hsk30-ext-group-idx="${i}">${escapeHtml(speakLabel)}</button>`
        : "";

      return `<article class="lesson-extension-group-card">
  <div class="lesson-extension-group-header">
    <span class="lesson-extension-group-index">${String(i + 1).padStart(2, "0")}</span>
    <h4 class="lesson-extension-group-title">${escapeHtml(groupTitle)}</h4>
    ${item.focusGrammar ? `<span class="lesson-extension-focus">${escapeHtml(str(item.focusGrammar))}</span>` : ""}
    ${groupListenBtn}
  </div>
  <div class="lesson-extension-sentences">${sentencesHtml}</div>
  ${note ? `<div class="lesson-extension-note">${escapeHtml(note)}</div>` : ""}
</article>`;
    }

    const phrase = str(item && (item.phrase || item.hanzi || item.zh || item.cn || item.line));
    const pinyin = str(item && (item.pinyin || item.py));
    const example = str(item && (item.example || item.exampleZh));
    const examplePinyin = str(item && (item.examplePinyin || item.examplePy));
    const meaning = getExtensionMeaning(item, lang);
    const explanation = getExtensionExplanation(item, lang);

    const idx = String(i + 1).padStart(2, "0");
    const zhEsc = escapeHtml(phrase).replaceAll('"', "&quot;");
    const zhAttrs = phrase && !speakPilot ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";
    const btnAttrs = speakPilot
      ? phrase
        ? ` type="button" class="lesson-extension-audio-btn hsk30-ext-listen" data-hsk30-ext-flat-idx="${i}"`
        : ` type="button" class="lesson-extension-audio-btn" disabled`
      : phrase
        ? ` type="button" class="lesson-extension-audio-btn" data-speak-text="${zhEsc}" data-speak-kind="extension"`
        : ` type="button" class="lesson-extension-audio-btn" disabled`;

    return `<article class="lesson-extension-card">
  <div class="lesson-extension-card-top">
    <span class="lesson-extension-index">${idx}</span>
    <button${btnAttrs}>${escapeHtml(speakLabel)}</button>
  </div>
  <div class="lesson-extension-body">
    <div class="lesson-extension-zh"${zhAttrs}>${escapeHtml(phrase)}</div>
    ${pinyin ? `<div class="lesson-extension-pinyin">${escapeHtml(pinyin)}</div>` : ""}
    ${meaning ? `<div class="lesson-extension-meaning">${escapeHtml(meaning)}</div>` : ""}
    ${explanation ? `<div class="lesson-extension-explanation">${escapeHtml(explanation)}</div>` : ""}
    ${example ? `<div class="lesson-extension-example">${escapeHtml(example)}</div>` : ""}
    ${examplePinyin ? `<div class="lesson-extension-example-pinyin">${escapeHtml(examplePinyin)}</div>` : ""}
  </div>
</article>`;
  }).filter(Boolean).join("");

  return `${hero}<section class="lesson-extension-list">${cards}</section>`;
}

/** Render extension tab into container (#hskExtensionBody). */
export function renderHskExtensionTab(container, ctx) {
  if (!container) return;
  const { lessonData, lang, isReviewLesson } = ctx || {};

  if (isReviewLesson) {
    const ext = lessonData && lessonData.extension;
    renderReviewExtension(container, Array.isArray(ext) ? ext : [], { lang });
    return;
  }

  container.innerHTML = buildExtensionHTML(lessonData, ctx);
}
