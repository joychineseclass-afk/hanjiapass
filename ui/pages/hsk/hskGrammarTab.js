// /ui/pages/hsk/hskGrammarTab.js
// HSK Grammar tab rendering (split from page.hsk.js Step 4).
// - Regular grammar cards (title / hint / explanation / examples)
// - Per-card TTS buttons; HSK3.0 · HSK1 speak-pilot supported
// - Review-mode dialogue delegated to hskRenderer.renderReviewGrammar
//
// ctx:
// {
//   lessonData,
//   lessonWords,
//   lang,
//   isReviewLesson,
//   isHsk30Hsk1SpeakPilot,
// }

import { i18n } from "../../i18n.js";
import {
  resolvePinyin,
  maybeGetManualPinyin,
  shouldShowPinyin,
  stripStandalonePinyinLinesForTts,
} from "../../utils/pinyinEngine.js";
import { getContentText } from "../../core/languageEngine.js";
import { renderReviewGrammar } from "../../modules/hsk/hskRenderer.js";
import {
  escapeHtml,
  trimStr,
  getControlledLangText,
  normalizePracticeLangAliases,
} from "./hskPageUtils.js";

/**
 * Grammar explanation — only explanation-like fields.
 * No translation/meaning fallback.
 */
export function getGrammarExplanation(item, lang) {
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
    return str(item.explainKr) || str(item.explanationKr) || str(item.explain_kr) || str(item.explanation_kr) || "";
  }
  if (l === "jp") {
    return str(item.explainJp) || str(item.explanationJp) || str(item.explain_jp) || str(item.explanation_jp) || "";
  }
  if (l === "cn") {
    return str(item.explainCn) || str(item.explanationCn) || str(item.explain_zh) || str(item.explanation_zh) || "";
  }
  return str(item.explainEn) || str(item.explanationEn) || str(item.explain_en) || str(item.explanation_en) || "";
}

/**
 * Short hint (system-language) — independent from explanation long-form.
 * Data source: grammar[].hint { zh, kr|ko, en, jp|ja } or flat hintKr etc.
 */
export function getGrammarPatternHint(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang);
  const str = (v) => trimStr(v);

  const hint = item.hint;
  if (hint && typeof hint === "object") {
    if (l === "kr") return str(hint.kr) || str(hint.ko) || "";
    if (l === "jp") return str(hint.jp) || str(hint.ja) || "";
    if (l === "cn") return str(hint.cn) || str(hint.zh) || "";
    return str(hint.en) || "";
  }

  if (l === "kr") {
    return str(item.hintKr) || str(item.hint_kr) || "";
  }
  if (l === "jp") {
    return str(item.hintJp) || str(item.hint_jp) || "";
  }
  if (l === "cn") {
    return str(item.hintCn) || str(item.hintZh) || str(item.hint_zh) || "";
  }
  return str(item.hintEn) || str(item.hint_en) || "";
}

/** Conservative grammar examples: zh + pinyin + translation only. */
export function getGrammarExamples(pt, lang) {
  const ex = (pt && pt.example) || (pt && pt.examples);
  const l = normalizePracticeLangAliases(lang);

  const toItem = (e) => {
    if (typeof e === "string") {
      return { zh: e, pinyin: "", trans: "" };
    }

    const zh = trimStr(e && (e.zh || e.cn || e.line || e.text));
    const pinyin = trimStr(e && (e.pinyin || e.py));

    let trans = "";
    const transObj = e && (e.translation || e.translations || e.trans);
    if (transObj && typeof transObj === "object") {
      trans = getControlledLangText(transObj, l, "grammar example translation");
    } else {
      trans = getContentText(e, "translation", { strict: true, lang: l }) || "";
    }

    return { zh, pinyin, trans };
  };

  if (!ex) return [];
  if (Array.isArray(ex)) return ex.map(toItem).filter((x) => x.zh);
  return [toItem(ex)].filter((x) => x.zh);
}

/** Normalize lesson.grammar to an array of grammar points. */
export function getGrammarPointsArray(raw) {
  const g = raw && raw.grammar;
  if (!g) return [];
  return Array.isArray(g) ? g : Array.isArray(g.points) ? g.points : [];
}

/** HSK3.0 HSK1 grammar card speak segments (no pinyin / no POS). */
export function buildGrammarSpeakSegments(pt, lang) {
  const str = (v) => trimStr(v);
  const titleZh =
    typeof pt?.title === "object"
      ? str(pt.title.zh || pt.title.cn || "")
      : str(pt?.pattern || pt?.title || pt?.name || "");
  const hintUi = getGrammarPatternHint(pt, lang);
  const explUi = getGrammarExplanation(pt, lang);
  const examples = getGrammarExamples(pt, lang);
  const segs = [];
  if (titleZh) segs.push({ zh: titleZh, ui: "" });
  if (hintUi) segs.push({ ui: stripStandalonePinyinLinesForTts(hintUi) });
  if (explUi && explUi !== hintUi) segs.push({ ui: stripStandalonePinyinLinesForTts(explUi) });
  for (const ex of examples) {
    if (ex.zh) segs.push({ zh: ex.zh, ui: str(ex.trans || "") });
  }
  return segs;
}

/** Build grammar tab HTML (non-review). */
export function buildGrammarHTML(lessonData, ctx) {
  const { lang, isHsk30Hsk1SpeakPilot } = ctx || {};
  const raw = (lessonData && lessonData._raw) || lessonData;
  const g = raw && raw.grammar;
  const speakPilot = !!isHsk30Hsk1SpeakPilot;
  const speakLabel = i18n.t("hsk.extension_speak");
  const emptyMsg = `<div class="lesson-grammar-empty">${escapeHtml(i18n.t("hsk.empty_grammar"))}</div>`;

  const hero = `<section class="lesson-section-hero lesson-grammar-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.grammar_title"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.grammar_subtitle"))}</p>
</section>`;

  if (!g) return `${hero}${emptyMsg}`;

  const arr = Array.isArray(g) ? g : Array.isArray(g && g.points) ? g.points : [];
  if (!arr.length) return `${hero}${emptyMsg}`;

  const showPinyin = shouldShowPinyin({
    level: lessonData && lessonData.level,
    version: lessonData && lessonData.version,
  });

  const cards = arr
    .map((pt, i) => {
      const titleZh =
        typeof pt?.title === "object"
          ? pt.title.zh || pt.title.kr || pt.title.en || ""
          : pt?.pattern || pt?.title || pt?.name || "#" + (i + 1);

      let titlePy = maybeGetManualPinyin(pt, "grammarTitle");
      if (showPinyin && titleZh && !titlePy) titlePy = resolvePinyin(titleZh, titlePy);

      const expl = getGrammarExplanation(pt, lang);
      const hintBlurb = getGrammarPatternHint(pt, lang);
      const examples = getGrammarExamples(pt, lang);
      const idx = String(i + 1).padStart(2, "0");
      const titleEsc = escapeHtml(titleZh).replaceAll('"', "&quot;");
      const titleAttrs =
        titleZh && !speakPilot ? ` data-speak-text="${titleEsc}" data-speak-kind="grammar"` : "";
      const btnAttrs = speakPilot
        ? titleZh
          ? ` type="button" class="lesson-grammar-audio-btn hsk30-card-listen" data-hsk30-grammar-idx="${i}"`
          : ` type="button" class="lesson-grammar-audio-btn" disabled`
        : titleZh
          ? ` type="button" class="lesson-grammar-audio-btn" data-speak-text="${titleEsc}" data-speak-kind="grammar"`
          : ` type="button" class="lesson-grammar-audio-btn" disabled`;

      let examplesHtml = "";
      if (examples.length) {
        examplesHtml = examples
          .map((ex) => {
            let exPy = ex.pinyin;
            if (showPinyin && ex.zh && !exPy) exPy = resolvePinyin(ex.zh, exPy);
            const exEsc = escapeHtml(ex.zh).replaceAll('"', "&quot;");
            const exAttrs =
              ex.zh && !speakPilot ? ` data-speak-text="${exEsc}" data-speak-kind="grammar"` : "";
            return `<div class="lesson-grammar-example">
  <div class="lesson-grammar-example-zh"${exAttrs}>${escapeHtml(ex.zh)}</div>
  ${exPy ? `<div class="lesson-grammar-example-pinyin">${escapeHtml(exPy)}</div>` : ""}
  ${ex.trans ? `<div class="lesson-grammar-example-meaning">${escapeHtml(ex.trans)}</div>` : ""}
</div>`;
          })
          .join("");
      }

      return `<article class="lesson-grammar-card">
  <div class="lesson-grammar-card-top">
    <span class="lesson-grammar-index">${idx}</span>
    <button${btnAttrs}>${escapeHtml(speakLabel)}</button>
  </div>
  <div class="lesson-grammar-head">
    <div class="lesson-grammar-zh"${titleAttrs}>${escapeHtml(titleZh)}</div>
    ${titlePy ? `<div class="lesson-grammar-pinyin">${escapeHtml(titlePy)}</div>` : ""}
  </div>
  ${hintBlurb ? `<div class="lesson-grammar-hint">${escapeHtml(hintBlurb)}</div>` : ""}
  ${expl ? `<div class="lesson-grammar-expl">${escapeHtml(expl)}</div>` : ""}
  ${examplesHtml ? `<div class="lesson-grammar-examples">${examplesHtml}</div>` : ""}
</article>`;
    })
    .join("");

  return `${hero}<section class="lesson-grammar-list">${cards}</section>`;
}

/** Render grammar tab into container (#hskGrammarBody). */
export function renderHskGrammarTab(container, ctx) {
  if (!container) return;
  const { lessonData, lessonWords, lang, isReviewLesson } = ctx || {};

  if (isReviewLesson) {
    const g = lessonData && lessonData.grammar;
    const gArr = Array.isArray(g) ? g : Array.isArray(g?.points) ? g.points : [];
    renderReviewGrammar(container, gArr, { lang, vocab: lessonWords });
    return;
  }

  container.innerHTML = buildGrammarHTML(lessonData, ctx);
}
