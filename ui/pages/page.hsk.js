// /ui/pages/page.hsk.js
// HSK Page - cleaned incremental version
// Strategy:
// 1) Keep page skeleton stable
// 2) Fix practice pipeline step by step
// 3) Avoid mutating validation logic
// 4) Keep extension meaning/explanation separated

import { i18n } from "../i18n.js";
import { pick, getContentText, getLang as getEngineLang, getLessonDisplayTitle } from "../core/languageEngine.js";
import { mountNavBar } from "../components/navBar.js";
import { ensureHSKDeps } from "../modules/hsk/hskDeps.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";
import {
  renderLessonList,
  renderWordCards,
  renderReviewWords,
  renderReviewDialogue,
  renderReviewGrammar,
  renderReviewExtension,
  bindWordCardActions,
  wordKey,
  wordPinyin,
  wordMeaning,
  normalizeLang
} from "../modules/hsk/hskRenderer.js";
import { loadBlueprint } from "../modules/curriculum/blueprintLoader.js";
import { distributeVocabulary, distributeVocabularyByMap, auditVocabularyCoverage } from "../modules/curriculum/vocabDistributor.js";
import { resolvePinyin, maybeGetManualPinyin, shouldShowPinyin } from "../utils/pinyinEngine.js";
import { loadGlossary } from "../utils/glossary.js";
import {
  LESSON_ENGINE,
  AI_CAPABILITY,
  IMAGE_ENGINE,
  SCENE_ENGINE,
  PROGRESS_ENGINE,
  PROGRESS_SELECTORS,
  AUDIO_ENGINE,
  renderReviewMode,
  prepareReviewSession
} from "../platform/index.js";
import * as PracticeState from "../modules/practice/practiceState.js";
import { mountPractice as mountPracticeFromEngine, rerenderPractice as rerenderPracticeFromEngine } from "../modules/practice/practiceRenderer.js";
import { addWrongItems, addRecentItem } from "../modules/review/reviewEngine.js";
import * as SceneRenderer from "../platform/scene/sceneRenderer.js";

const state = {
  lv: 1,
  version: "hsk2.0",
  lessons: [],
  current: null,
  tab: "words",
  searchKeyword: "",
  reviewMode: null,
};

let el;

const _HANZI_RE = /[\u4e00-\u9fff]/;
const _KOREAN_RE = /[가-힣]/;
const _JAPANESE_RE = /[ぁ-んァ-ン]/;
const _LATIN_RE = /[A-Za-z]/;

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stringifyMaybe(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function _trimStr(v) {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function getLang() {
  return normalizeLang(getEngineLang());
}

function getHskState() {
  return {
    version: state.version,
    level: state.lv,
    lessonId: state.current ? (state.current.lessonData?.id || getCourseId() + "_lesson" + state.current.lessonNo) : "",
    lessonNo: state.current?.lessonNo || 0,
    file: state.current?.file || "",
    activeTab: state.tab,
    reviewMode: state.reviewMode,
    searchKeyword: state.searchKeyword,
  };
}

function isHSKPageActive() {
  const hash = ((typeof location !== "undefined" && location.hash) || "").toLowerCase();
  const path = ((typeof location !== "undefined" && location.pathname) || "").toLowerCase();
  return hash.includes("hsk") || path.includes("hsk");
}

function getCourseId() {
  return `${state.version}_hsk${state.lv}`;
}

function practiceLangKeyFromUiLang(lang) {
  const l = String(lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return "cn";
  if (l === "en") return "en";
  if (l === "jp" || l === "ja") return "jp";
  return "kr";
}

function normalizePracticeLangAliases(langKey) {
  const k = String(langKey || "").toLowerCase();
  if (k === "ko") return "kr";
  if (k === "ja") return "jp";
  if (k === "zh") return "cn";
  return k || "kr";
}

function _safeGetTextWithFallback(text, context = "text") {
  const out = _trimStr(text);
  if (out) return out;

  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Safety] Missing ${context}`);
  }
  return "";
}

/**
 * Controlled text getter
 * Rule:
 * current UI lang -> English -> Chinese
 * Never jump randomly into unrelated languages
 */
function _getControlledLangText(obj, langKey, context = "text") {
  if (!obj || typeof obj !== "object") return "";

  const key = normalizePracticeLangAliases(langKey);
  const primary =
    key === "kr" ? ["kr", "ko"] :
    key === "jp" ? ["jp", "ja"] :
    key === "cn" ? ["cn", "zh"] :
    ["en"];

  const order = [...primary, "en", "cn", "zh"];
  const tried = [];

  for (const k of order) {
    tried.push(k);
    const value = _trimStr(obj[k]);
    if (value) {
      if (!primary.includes(k) && typeof console !== "undefined" && console.warn) {
        console.warn(`[HSK Language] Fallback triggered for ${context}: ${key} -> ${k}`);
      }
      return value;
    }
  }

  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Language] No available text for ${context}; tried=${tried.join(",")}`);
  }
  return "";
}

/**
 * Strict direct getter
 * No fallback. Only current language family.
 */
function _getStrictLangText(obj, langKey) {
  if (!obj || typeof obj !== "object") return "";
  const key = normalizePracticeLangAliases(langKey);

  if (key === "kr") return _trimStr(obj.kr) || _trimStr(obj.ko) || "";
  if (key === "jp") return _trimStr(obj.jp) || _trimStr(obj.ja) || "";
  if (key === "cn") return _trimStr(obj.cn) || _trimStr(obj.zh) || "";
  return _trimStr(obj.en) || "";
}

/**
 * Keep only real explanation-like polluted fields removable.
 * Do NOT delete meaning / translation sources here.
 */
function _stripPollutedFields(obj) {
  if (!obj || typeof obj !== "object") return;

  const pollutedFields = [
    "explain",
    "explanation",
    "explainKr",
    "explainEn",
    "explainJp",
    "explainCn",
    "explanation_kr",
    "explanation_en",
    "explanation_jp",
    "explanation_cn",
    "usage",
    "example",
    "examples",
    "notes",
    "note",
    "definition",
    "definitions",
    "desc",
    "description"
  ];

  pollutedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(obj, field)) {
      delete obj[field];
    }
  });
}

function _stripOptionExplainFields(o) {
  if (!o || typeof o !== "object") return;
  delete o.explain;
  delete o.explanation;
  delete o.explainKr;
  delete o.explainEn;
  delete o.explainJp;
  delete o.explainCn;
  delete o.explanation_kr;
  delete o.explanation_en;
  delete o.explanation_jp;
  delete o.explanation_cn;
  delete o.usage;
  delete o.example;
  delete o.examples;
  delete o.notes;
  delete o.note;
  delete o.definition;
  delete o.definitions;
  delete o.desc;
  delete o.description;
}

/**
 * Short meaning detector
 * Used only for compact option text, not for sentence translation.
 */
function _isShortMeaning(text) {
  const t = _trimStr(text);
  if (!t) return false;
  if (t.length > 40) return false;
  if (/；|;|：/.test(t)) return false;
  if (/(例如|用法|同义词|反义词|词性)/.test(t)) return false;
  if (((t.match(/,/g) || []).length) > 2) return false;
  return true;
}

/**
 * Pure pinyin cleaner
 * Keep only pinyin-ish characters.
 */
function _cleanPinyin(text) {
  if (!text || typeof text !== "string") return "";
  let cleaned = text;

  // remove obvious long English fragments
  cleaned = cleaned.replace(/[A-Za-z]{3,}/g, (m) => {
    const hasTone = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/i.test(m);
    return hasTone ? m : "";
  });

  cleaned = cleaned.replace(/[^A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s'’-]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Lightweight language validity checker.
 * This is ONLY for displayed text, not raw object validation.
 */
function isTextValidForLang(text, langKey) {
  const t = _trimStr(text);
  if (!t) return false;

  const key = normalizePracticeLangAliases(langKey);

  if (key === "kr") {
    return _KOREAN_RE.test(t);
  }

  if (key === "jp") {
    return _JAPANESE_RE.test(t) || /[一-龯]/.test(t);
  }

  if (key === "cn") {
    return _HANZI_RE.test(t);
  }

  // en
  return _LATIN_RE.test(t);
}


/**
 * Practice display patch restore
 * 这里只清空 display 层，不碰原始字段
 */
function restoreHskChoiceOptionDisplayPatch() {
  const qs = PracticeState.getQuestions();
  if (!Array.isArray(qs)) return;

  for (const q of qs) {
    const opts = Array.isArray(q.options) ? q.options : [];
    for (const o of opts) {
      if (!o || typeof o !== "object") continue;
      delete o.__displayText;
      delete o.__displayLang;
    }
  }
}

/**
 * Practice mount
 * ✅ 只在 mount 时构建语言安全题池
 */
function mountPractice(container, opts) {
  if (!container) return;

  const langKey = practiceLangKeyFromUiLang(opts && opts.lang);
  const lesson = opts && opts.lesson;

  const lessonForPractice = lesson
    ? buildLessonWithClonedPracticeForDisplay(lesson, langKey)
    : lesson;

  mountPracticeFromEngine(container, {
    ...(opts || {}),
    lesson: lessonForPractice,
  });
}


/**
 * Practice rerender
 * ✅ 只重新应用显示逻辑
 * ❌ 不再重建题池
 * ❌ 不再重新过滤题目
 */
function rerenderPractice(container, lang) {
  if (!container) return;

  const langKey = practiceLangKeyFromUiLang(lang);

  restoreHskChoiceOptionDisplayPatch();

  const currentQuestions = PracticeState.getQuestions();
  if (Array.isArray(currentQuestions) && currentQuestions.length) {
   hydratePracticeDisplayBridge(currentQuestions, langKey);
  }

  rerenderPracticeFromEngine(container, lang);
}

/**
 * ===============================
 * Practice Display Bridge
 * ===============================
 * Purpose:
 * Keep engine-compatible visible fields in sync with __displayText
 * without destroying original semantic data too early.
 */

/** 把 __displayText 同步到当前 UI 对应字段，供 practiceRenderer 读取 */
function syncPracticeOptionDisplayFields(options, langKey) {
  if (!Array.isArray(options)) return;

  const lk = normalizePracticeLangAliases(langKey);

  for (const o of options) {
    if (!o || typeof o !== "object") continue;

    const text = _trimStr(o.__displayText);
    if (!text) continue;

    // 先清掉显示层语言字段，避免旧显示残留
    delete o.kr;
    delete o.ko;
    delete o.en;
    delete o.jp;
    delete o.ja;
    delete o.cn;
    delete o.zh;

    if (lk === "kr") {
      o.kr = text;
      o.ko = text;
    } else if (lk === "jp") {
      o.jp = text;
      o.ja = text;
    } else if (lk === "cn") {
      o.cn = text;
      o.zh = text;
    } else {
      o.en = text;
    }
  }
}

/** 把题目当前显示模式下的选项文本桥接到 renderer 可读字段 */
function syncPracticeQuestionDisplayFields(question, langKey) {
  if (!question || typeof question !== "object") return;
  const opts = Array.isArray(question.options) ? question.options : [];
  syncPracticeOptionDisplayFields(opts, langKey);
}

/** 批量桥接 */
function syncPracticeQuestionListDisplayFields(questions, langKey) {
  if (!Array.isArray(questions)) return;
  for (const q of questions) {
    syncPracticeQuestionDisplayFields(q, langKey);
  }
}

/**
 * 统一做 practice 显示刷新：
 * 1. 重新应用 display mode
 * 2. 同步 __displayText -> renderer 可见字段
 */
function refreshPracticeDisplayOnly(currentQuestions, langKey) {
  if (!Array.isArray(currentQuestions)) return;

  // 清旧 patch
  for (const q of currentQuestions) {
    const opts = Array.isArray(q.options) ? q.options : [];
    for (const o of opts) {
      if (!o || typeof o !== "object") continue;
      delete o.__displayText;
      delete o.__displayLang;
    }
  }

  // 重新生成显示文本
  applyChoiceDisplayToQuestionList(currentQuestions, langKey);

  // 同步给 renderer
  syncPracticeQuestionListDisplayFields(currentQuestions, langKey);
}

/**
 * 如果 practice 引擎依赖 prompt 对象，也同步一个当前语言可读题干
 * 这里只桥接显示，不改原题 schema 结构
 */
function syncPracticeStemDisplayField(question, langKey) {
  if (!question || typeof question !== "object") return;

  const stem = practiceStemDisplayText(question, langKey);
  if (!stem) return;

  const lk = normalizePracticeLangAliases(langKey);

  if (!question.prompt || typeof question.prompt !== "object") {
    question.prompt = {};
  }

  if (lk === "kr") {
    question.prompt.kr = stem;
    question.prompt.ko = stem;
  } else if (lk === "jp") {
    question.prompt.jp = stem;
    question.prompt.ja = stem;
  } else if (lk === "cn") {
    question.prompt.cn = stem;
    question.prompt.zh = stem;
  } else {
    question.prompt.en = stem;
  }
}

function syncPracticeStemDisplayList(questions, langKey) {
  if (!Array.isArray(questions)) return;
  for (const q of questions) {
    syncPracticeStemDisplayField(q, langKey);
  }
}

/**
 * 最终统一调用：
 * 给 mount / rerender 使用
 */
function hydratePracticeDisplayBridge(questions, langKey) {
  if (!Array.isArray(questions)) return;
  refreshPracticeDisplayOnly(questions, langKey);
  syncPracticeStemDisplayList(questions, langKey);
}

/**
 * ===============================
 * Dialogue / Grammar / Extension
 * ===============================
 */

/**
 * Dialogue translation
 * Strict within current language family only.
 * No cross-language fallback here.
 */
function getDialogueTranslation(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang || getLang());

  const str = (v) => _trimStr(v);

  const trans = item.translation ?? item.trans ?? item.translations;
  if (trans && typeof trans === "object") {
    if (l === "kr") return str(trans.kr) || str(trans.ko) || "";
    if (l === "jp") return str(trans.jp) || str(trans.ja) || "";
    if (l === "cn") return str(trans.cn) || str(trans.zh) || "";
    return str(trans.en) || "";
  }

  if (l === "kr") {
    return str(item.kr) || str(item.ko) || str(item.translationKr) || str(item.translation_kr) || "";
  }
  if (l === "jp") {
    return str(item.jp) || str(item.ja) || str(item.translationJp) || str(item.translation_jp) || "";
  }
  if (l === "cn") {
    return str(item.cn) || str(item.zh) || str(item.translationCn) || str(item.translation_cn) || "";
  }
  return str(item.en) || str(item.translationEn) || str(item.translation_en) || "";
}

function pickDialogueTranslation(line, zhMain = "") {
  const lang = getLang();
  const out = getDialogueTranslation(line, lang);
  if (out && zhMain && out === zhMain) return "";
  return out;
}

/**
 * Dialogue/scene/review card title
 * Prefer strict current language, then zh/cn as fallback
 */
function pickCardTitle(obj, cardIndex = 1) {
  if (obj != null && typeof obj === "string") return obj.trim();

  const lang = normalizePracticeLangAliases(getLang());
  const v =
    _getStrictLangText(obj, lang) ||
    _trimStr(obj && obj.zh) ||
    _trimStr(obj && obj.cn) ||
    "";

  if (v) return v;

  const sessionText = i18n.t("dialogue.session", { n: cardIndex });
  if (sessionText && sessionText !== "dialogue.session") return sessionText;
  return (i18n.t("lesson.dialogue_card") || "会话") + cardIndex;
}

/**
 * Grammar explanation
 * Only explanation-like fields, no translation/meaning fallback
 */
function getGrammarExplanation(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang || getLang());
  const str = (v) => _trimStr(v);

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
 * Grammar examples
 * Keep it conservative:
 * zh + pinyin + translation only
 */
function getGrammarExamples(pt) {
  const ex = (pt && pt.example) || (pt && pt.examples);
  const lang = normalizePracticeLangAliases(getLang());

  const toItem = (e) => {
    if (typeof e === "string") {
      return { zh: e, pinyin: "", trans: "" };
    }

    const zh = _trimStr(e && (e.zh || e.cn || e.line || e.text));
    const pinyin = _trimStr(e && (e.pinyin || e.py));

    let trans = "";
    const transObj = e && (e.translation || e.translations || e.trans);
    if (transObj && typeof transObj === "object") {
      trans = _getControlledLangText(transObj, lang, "grammar example translation");
    } else {
      trans = getContentText(e, "translation", { strict: true, lang }) || "";
    }

    return { zh, pinyin, trans };
  };

  if (!ex) return [];
  if (Array.isArray(ex)) return ex.map(toItem).filter((x) => x.zh);
  return [toItem(ex)].filter((x) => x.zh);
}

/**
 * Extension explanation
 * Only explanation / note-like content.
 * Do NOT mix with main meaning/translation.
 */
function getExtensionExplanation(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang || getLang());
  const str = (v) => _trimStr(v);

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
    return _getStrictLangText(note, l) || "";
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
function getExtensionMeaning(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang || getLang());

  // 1) flat language fields
  if (l === "kr") {
    return (
      _trimStr(item.kr) ||
      _trimStr(item.ko) ||
      _trimStr(item.translationKr) ||
      _trimStr(item.translation_kr) ||
      _trimStr(item.en) ||
      _trimStr(item.translationEn) ||
      _trimStr(item.translation_en) ||
      _trimStr(item.cn) ||
      _trimStr(item.zh) ||
      ""
    );
  }

  if (l === "jp") {
    return (
      _trimStr(item.jp) ||
      _trimStr(item.ja) ||
      _trimStr(item.translationJp) ||
      _trimStr(item.translation_jp) ||
      _trimStr(item.en) ||
      _trimStr(item.translationEn) ||
      _trimStr(item.translation_en) ||
      _trimStr(item.cn) ||
      _trimStr(item.zh) ||
      ""
    );
  }

  if (l === "cn") {
    return (
      _trimStr(item.cn) ||
      _trimStr(item.zh) ||
      _trimStr(item.en) ||
      _trimStr(item.translationEn) ||
      _trimStr(item.translation_en) ||
      ""
    );
  }

  // en
  return (
    _trimStr(item.en) ||
    _trimStr(item.translationEn) ||
    _trimStr(item.translation_en) ||
    _trimStr(item.cn) ||
    _trimStr(item.zh) ||
    ""
  );
}

/**
 * Extension tab
 * Keep meaning and explanation separated
 */
function buildExtensionHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const arr =
    Array.isArray(raw && raw.generatedExtensions) && raw.generatedExtensions.length
      ? raw.generatedExtensions
      : Array.isArray(raw && raw.extension)
        ? raw.extension
        : [];

  const lang = getLang();
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

  const str = (v) => _trimStr(v);

  const pickObj = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return _getControlledLangText(obj, lang, "extension object");
  };

  const pickTrans = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return _getControlledLangText(obj, lang, "extension translation");
  };

  const cards = arr.map((item, i) => {
    const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];
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
        const attrs = cn ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";

        return `<div class="lesson-extension-sentence">
          <div class="lesson-extension-sentence-zh"${attrs}>${escapeHtml(cn)}</div>
          ${py ? `<div class="lesson-extension-sentence-pinyin">${escapeHtml(py)}</div>` : ""}
          ${trans ? `<div class="lesson-extension-sentence-trans">${escapeHtml(trans)}</div>` : ""}
          ${cn ? `<button type="button" class="lesson-extension-audio-btn text-xs mt-1" data-speak-text="${zhEsc}" data-speak-kind="extension">${escapeHtml(speakLabel)}</button>` : ""}
        </div>`;
      }).join("");

      return `<article class="lesson-extension-group-card">
  <div class="lesson-extension-group-header">
    <span class="lesson-extension-group-index">${String(i + 1).padStart(2, "0")}</span>
    <h4 class="lesson-extension-group-title">${escapeHtml(groupTitle)}</h4>
    ${item.focusGrammar ? `<span class="lesson-extension-focus">${escapeHtml(str(item.focusGrammar))}</span>` : ""}
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
    const zhAttrs = phrase ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";
    const btnAttrs = phrase ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";

    return `<article class="lesson-extension-card">
  <div class="lesson-extension-card-top">
    <span class="lesson-extension-index">${idx}</span>
    <button type="button" class="lesson-extension-audio-btn"${btnAttrs}>${escapeHtml(speakLabel)}</button>
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

/**
 * ===============================
 * Practice Display Core (FIXED)
 * ===============================
 * Strategy:
 * 1) NEVER mutate original data destructively
 * 2) NEVER validate raw object directly
 * 3) ONLY validate final display text
 * 4) rerender ≠ rebuild pool
 */


/**
 * 🔥 修复核心逻辑（你之前问题就在这里）
 */
function practiceChoiceDisplayKindResolved(q, langKey) {
  let kind = practiceChoiceDisplayKind(q);
  if (kind !== "infer") return kind;

  const opts = q.options;
  const stem = practiceStemDisplayText(q, langKey);

  const hasChinese = /[\u4e00-\u9fff]/.test(stem);

  // 👉 关键规则（你之前错在这里）
  // ❗ 没有中文 → 用中文选项
  if (!hasChinese) return "zh_options";

  // ❗ 有中文 → 用系统语言
  return _optionsLookLikeLetterKeyedMeanings(opts)
    ? "meaning_ui"
    : "sentence_translation";
}


/**
 * Get final stem display text
 * 🔥 修复点：只返回最终显示，不做验证逻辑
 */
function practiceStemDisplayText(q, langKey) {
  if (!q || typeof q !== "object") return "";

  const prompt = q.prompt ?? q.question;

  // object
  if (prompt && typeof prompt === "object") {
    return _getControlledLangText(prompt, langKey, "prompt");
  }

  // string
  if (typeof prompt === "string") {
    return prompt.trim();
  }

  return "";
}

/**
 * Pick meaning for option (SAFE)
 */
function pickShortMeaningForOption(orig, langKey) {
  if (!orig || typeof orig !== "object") return "";

  const m = orig.meaning;
  if (m && typeof m === "object") {
    const v = _getControlledLangText(m, langKey, "meaning");
    if (_isShortMeaning(v)) return v;
  }

  const g = orig.gloss;
  if (g && typeof g === "object") {
    const v = _getControlledLangText(g, langKey, "gloss");
    if (_isShortMeaning(v)) return v;
  }

  return "";
}

/**
 * Pick translation for option (SAFE)
 */
function pickSentenceTranslationForOption(orig, langKey) {
  if (!orig || typeof orig !== "object") return "";

  const t = orig.translation ?? orig.translations ?? orig.trans;
  if (t && typeof t === "object") {
    return _getControlledLangText(t, langKey, "translation");
  }

  return "";
}

/**
 * 🔥 关键修复：只覆盖显示字段，不删除原字段
 */
function _applyDisplayOnlyText(o, langKey, text) {
  if (!o || typeof o !== "object") return;

  // 不再 delete 全部字段！！
  o.__displayText = text || "";

  // 标记语言
  o.__displayLang = langKey;
}

/**
 * Patch option display (SAFE)
 */
function patchChoiceOptionForDisplayMode(o, kind, langKey) {
  if (!o || typeof o !== "object") return;

  const orig = o;

  if (kind === "zh_options") {
    const text = orig.cn || orig.zh || "";
    _applyDisplayOnlyText(o, "cn", text);
    return;
  }

  if (kind === "meaning_ui") {
    const text = pickShortMeaningForOption(orig, langKey);
    _applyDisplayOnlyText(o, langKey, text);
    return;
  }

  if (kind === "sentence_translation") {
    const text = pickSentenceTranslationForOption(orig, langKey);
    _applyDisplayOnlyText(o, langKey, text);
    return;
  }
}

/**
 * Apply display patch to question list
 */
function applyChoiceDisplayToQuestionList(questions, langKey) {
  if (!Array.isArray(questions)) return;

  for (const q of questions) {
    if (String(q.type || "choice") !== "choice") continue;

    const kind = practiceChoiceDisplayKindResolved(q, langKey);
    const opts = Array.isArray(q.options) ? q.options : [];

    for (const o of opts) {
      patchChoiceOptionForDisplayMode(o, kind, langKey);
    }
  }
}

/**
 * 🔥 核心修复：验证只基于“最终显示文本”
 */
function isQuestionDisplaySafe(q, langKey) {
  const stem = practiceStemDisplayText(q, langKey);
  if (!isTextValidForLang(stem, langKey)) return false;

  if (q.type === "choice" && Array.isArray(q.options)) {
    const valid = q.options.filter(o => {
      const txt = o.__displayText || "";
      return isTextValidForLang(txt, langKey);
    });

    return valid.length >= 2;
  }

  return true;
}

/**
 * 🔥 修复版：构建题池（只负责组池）
 */
function buildLanguageSafePracticePool(rawQuestions, langKey, min = 3) {
  if (!Array.isArray(rawQuestions)) return [];

  const main = rawQuestions.filter(q =>
    isTextValidForLang(practiceStemDisplayText(q, langKey), langKey)
  );

  let pool = [...main];

  // fallback（仅 English）
  if (pool.length < min) {
    const en = rawQuestions.filter(q =>
      isTextValidForLang(practiceStemDisplayText(q, "en"), "en")
    );

    const need = min - pool.length;
    pool = [...pool, ...en.slice(0, need)];
  }

  return pool;
}

/**
 * 🔥 重要：只在 mount 时调用
 */
function buildLessonWithClonedPracticeForDisplay(lesson, langKey) {
  if (!lesson || !Array.isArray(lesson.practice)) {
    return { ...lesson, practice: [] };
  }

  const raw = lesson.practice;

  // 1️⃣ 构建题池
  const pool = buildLanguageSafePracticePool(raw, langKey, 3);

  // 2️⃣ 深拷贝
  const cloned = pool.map(q => JSON.parse(JSON.stringify(q)));

  // 3️⃣ 应用显示规则
  hydratePracticeDisplayBridge(cloned, langKey);

  // 4️⃣ 最终显示验证（轻量）
  const final = cloned.filter(q => isQuestionDisplaySafe(q, langKey));

  return {
    ...lesson,
    practice: final
  };
}


/**
 * ===============================
 * Lesson / Blueprint / Distribution Helpers
 * ===============================
 */

const HSK1_THEME_TRANSLATIONS = {
  "打招呼": { ko: "인사하기", en: "Greetings", jp: "あいさつ" },
  "介绍名字": { ko: "이름 소개하기", en: "Introducing names", jp: "名前の紹介" },
  "国籍/国家": { ko: "국적 / 국가", en: "Nationality", jp: "国籍" },
  "家庭": { ko: "가족", en: "Family", jp: "家族" },
  "数字与数量": { ko: "숫자와 수량", en: "Numbers and quantity", jp: "数字と数量" },
  "年龄": { ko: "나이 묻기", en: "Age", jp: "年齢" },
  "日期": { ko: "날짜", en: "Date", jp: "日付" },
  "时间": { ko: "시간", en: "Time", jp: "時間" },
  "打电话": { ko: "전화하기", en: "Making calls", jp: "電話をかける" },
  "问地点/在哪儿": { ko: "장소 묻기 / 어디에", en: "Asking location", jp: "場所を聞く" },
  "学校生活": { ko: "학교 생활", en: "School life", jp: "学校生活" },
  "工作": { ko: "직업", en: "Work", jp: "仕事" },
  "爱好": { ko: "취미", en: "Hobbies", jp: "趣味" },
  "饮食1": { ko: "음식 1", en: "Food 1", jp: "飲食1" },
  "饮食2": { ko: "음식 2", en: "Food 2", jp: "飲食2" },
  "位置/方向": { ko: "위치 / 방향", en: "Location / direction", jp: "位置・方向" },
  "交通/出行": { ko: "교통 / 출행", en: "Transport", jp: "交通" },
  "购物": { ko: "쇼핑", en: "Shopping", jp: "買い物" },
  "天气": { ko: "날씨", en: "Weather", jp: "天気" },
  "看病/综合应用": { ko: "병원 / 종합 활용", en: "Doctor visit", jp: "病院・総合" },
  "复习1": { ko: "복습 1", en: "Review 1", jp: "復習1" },
  "复习2": { ko: "복습 2", en: "Review 2", jp: "復習2" },
};

function getLessonNumber(lesson) {
  if (!lesson || typeof lesson !== "object") return 0;
  return Number(
    lesson.lessonNo ?? lesson.no ?? lesson.id ?? lesson.lesson ?? lesson.index ?? 0
  ) || 0;
}

/**
 * Blueprint title resolver
 * Strict current language only
 */
function resolveBlueprintTitle(titleObj, lang) {
  if (!titleObj) return "";
  if (typeof titleObj === "string") return titleObj.trim();
  if (typeof titleObj !== "object") return "";

  const l = (lang || getLang()).toLowerCase();

  const key =
    l === "kr" || l === "ko"
      ? "ko"
      : l === "jp" || l === "ja"
      ? "ja"
      : l === "cn" || l === "zh"
      ? "zh"
      : "en";

  const v = titleObj[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function refreshBlueprintDisplayTitles(lessons, lang) {
  if (!Array.isArray(lessons)) return;
  const l = lang || getLang();

  lessons.forEach((lesson) => {
    if (lesson && lesson.blueprintTitle != null) {
      lesson.displayTitle = resolveBlueprintTitle(lesson.blueprintTitle, l);
    }
  });
}

function applyBlueprintTitles(lessons, blueprint) {
  if (!Array.isArray(lessons) || !blueprint || typeof blueprint !== "object") {
    return lessons;
  }

  return lessons.map((lesson) => {
    const no = getLessonNumber(lesson);
    const entry = no ? blueprint[String(no)] : null;
    const rawTitle = entry && entry.title != null ? entry.title : null;
    if (!rawTitle) return lesson;

    return {
      ...lesson,
      originalTitle: lesson.title,
      blueprintTitle: rawTitle,
    };
  });
}

function applyVocabDistributionTitles(lessons, lessonThemes) {
  if (!Array.isArray(lessons) || !lessonThemes || typeof lessonThemes !== "object") {
    return lessons;
  }

  return lessons.map((lesson) => {
    const no = getLessonNumber(lesson);
    const theme = no ? (lessonThemes[String(no)] || lessonThemes[no]) : null;
    if (!theme || typeof theme !== "string") return lesson;

    const tr = HSK1_THEME_TRANSLATIONS[theme];

    return {
      ...lesson,
      title: {
        zh: theme,
        kr: (tr && tr.ko) || "",
        en: (tr && tr.en) || "",
        jp: (tr && tr.jp) || "",
      },
      titleKo: (tr && tr.ko) || "",
      titleEn: (tr && tr.en) || "",
      titleJp: (tr && tr.jp) || "",
    };
  });
}

/** 合并 coreWords + extraWords */
function mergeLessonVocabulary(lesson) {
  if (!lesson) return [];

  const core = Array.isArray(lesson.coreWords)
    ? lesson.coreWords
    : Array.isArray(lesson.distributedWords)
    ? lesson.distributedWords
    : [];

  const extra = Array.isArray(lesson.extraWords) ? lesson.extraWords : [];

  if (core.length === 0 && extra.length === 0) {
    const fallback = lesson.words ?? lesson.originalWords;
    return Array.isArray(fallback) ? fallback : [];
  }

  const seen = new Set();
  const result = [];

  for (const w of [...core, ...extra]) {
    const k = wordKey(w);
    if (k && !seen.has(k)) {
      seen.add(k);
      result.push(w);
    }
  }

  return result;
}

const _vocabDistCache = new Map();
async function getVocabDistribution(lv, version) {
  const key = `${version}:hsk${lv}`;
  if (_vocabDistCache.has(key)) return _vocabDistCache.get(key);

  const base = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  const root = base ? base + "/" : "/";
  const url = `${root}data/courses/${version}/hsk${lv}/vocab-distribution.json`;

  try {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) return null;
    const data = await res.json();

    const dist = data && data.distribution;
    const order = dist && typeof dist === "object" ? Object.keys(dist) : null;
    const lessonThemes =
      data && data.lessonThemes && typeof data.lessonThemes === "object"
        ? data.lessonThemes
        : null;

    const out = { order, lessonThemes };
    _vocabDistCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

function sortLessonsByDistributionOrder(lessons, order) {
  if (!Array.isArray(lessons) || !Array.isArray(order) || order.length === 0) {
    return lessons;
  }

  const idxMap = new Map(order.map((k, i) => [k, i]));

  return [...lessons].sort((a, b) => {
    const noA = getLessonNumber(a);
    const noB = getLessonNumber(b);

    const keyA = noA ? `lesson${noA}` : "";
    const keyB = noB ? `lesson${noB}` : "";

    const iA = idxMap.has(keyA) ? idxMap.get(keyA) : Infinity;
    const iB = idxMap.has(keyB) ? idxMap.get(keyB) : Infinity;

    return iA - iB;
  });
}

function applyVocabDistribution(lessons, distribution) {
  if (!Array.isArray(lessons) || !distribution || typeof distribution !== "object") {
    return lessons;
  }

  const hasCoreExtra = distribution.core != null && distribution.extra != null;
  const reviewByLesson = distribution.reviewWordsByLesson;

  return lessons.map((lesson) => {
    const no = getLessonNumber(lesson);
    const key = String(no);

    let coreWords = [];
    let extraWords = [];

    if (hasCoreExtra) {
      coreWords = Array.isArray(distribution.core[key]) ? distribution.core[key] : [];
      extraWords = Array.isArray(distribution.extra[key]) ? distribution.extra[key] : [];
    } else {
      const assigned = distribution[key];
      coreWords = Array.isArray(assigned) ? assigned : [];
    }

    const originalWords = Array.isArray(lesson.words)
      ? lesson.words
      : Array.isArray(lesson.vocab)
      ? lesson.vocab
      : [];

    const distributedWords = coreWords;
    const reviewWordsByLesson =
      reviewByLesson && typeof reviewByLesson[key] === "object"
        ? reviewByLesson[key]
        : null;

    return {
      ...lesson,
      originalWords,
      coreWords,
      extraWords,
      distributedWords,
      // ⭐ 不强行覆盖 words，避免和 detail vocab 冲突
      words: originalWords,
      ...(reviewWordsByLesson && { reviewWordsByLesson }),
    };
  });
}

/**
 * ===============================
 * Lesson List Loading
 * ===============================
 */

async function loadLessons() {
  setError("");
  setSubTitle();

  const lang = getLang();
  const listEl = $("hskLessonList");
  if (listEl) {
    listEl.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(
      i18n.t("common_loading")
    )}</div>`;
  }

  try {
    let lessons = [];

    // 1) Lesson Engine first
    if (LESSON_ENGINE && typeof LESSON_ENGINE.loadCourseIndex === "function") {
      try {
        const index = await LESSON_ENGINE.loadCourseIndex({
          courseType: state.version,
          level: `hsk${state.lv}`,
        });
        lessons = Array.isArray(index?.lessons) ? index.lessons : [];
      } catch (engineErr) {
        console.warn(
          "[HSK] Lesson Engine loadCourseIndex failed, fallback to HSK_LOADER:",
          engineErr?.message
        );
      }
    }

    // 2) fallback to HSK_LOADER
    if (
      !lessons.length &&
      window.HSK_LOADER &&
      typeof window.HSK_LOADER.loadLessons === "function"
    ) {
      lessons = await window.HSK_LOADER.loadLessons(state.lv, {
        version: state.version,
      });
    }

    lessons = Array.isArray(lessons) ? lessons : [];

    const vocabDist = await getVocabDistribution(state.lv, state.version);

    // 当前先不依赖 distribution 排序，保持 lessons.json 目录顺序
    let result = lessons;

    // optional theme titles
    if (vocabDist && vocabDist.lessonThemes) {
      result = applyVocabDistributionTitles(result, vocabDist.lessonThemes);
    }

    const blueprint = await loadBlueprint(`hsk${state.lv}`);
    if (blueprint) {
      result = applyBlueprintTitles(result, blueprint);

      let vocabList = null;
      try {
        if (
          window.HSK_LOADER &&
          typeof window.HSK_LOADER.loadVocab === "function"
        ) {
          vocabList = await window.HSK_LOADER.loadVocab(state.lv, {
            version: state.version,
          });
        }
      } catch (vocabErr) {
        console.warn("[VocabDistributor] vocabList load failed:", vocabErr?.message);
      }

      if (Array.isArray(vocabList) && vocabList.length > 0) {
        const levelKey = `hsk${state.lv}`;
        const vocabMap = await loadVocabMap(levelKey);

        let distribution = null;

        if (vocabMap && Object.keys(vocabMap).some((k) => k !== "description" && k !== "version")) {
          distribution = distributeVocabularyByMap(levelKey, vocabMap, vocabList);
          try {
            auditVocabularyCoverage(vocabMap, vocabList);
          } catch {}
        }

        if (!distribution || Object.keys(distribution).length === 0) {
          distribution = distributeVocabulary(levelKey, blueprint, vocabList);
        }

        if (distribution && Object.keys(distribution).length > 0) {
          result = applyVocabDistribution(result, distribution);
        }
      }
    }

    state.lessons = result;
    refreshBlueprintDisplayTitles(state.lessons, lang);

    const total = state.lessons.length;
    const stats =
      (PROGRESS_SELECTORS &&
        typeof PROGRESS_SELECTORS.getCourseStats === "function"
        ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total)
        : null) || {};

    if (listEl) {
      renderLessonList(listEl, state.lessons, {
        lang,
        currentLessonNo: stats.lastLessonNo || 0,
      });
    }

    updateProgressBlock();
  } catch (e) {
    console.error(e);
    setError("Lessons load failed: " + (e?.message || e));
  }
}

/**
 * ===============================
 * Lesson Peripheral Helpers
 * ===============================
 * Cover / Scene / Progress / Review compatibility
 */

function markLessonStartedSafe(lessonData, lessonNo) {
  const courseId = (lessonData && lessonData.courseId) || getCourseId();
  const lessonId =
    (lessonData && lessonData.id) || `${courseId}_lesson${lessonNo}`;

  if (
    PROGRESS_ENGINE &&
    typeof PROGRESS_ENGINE.markLessonStarted === "function"
  ) {
    PROGRESS_ENGINE.markLessonStarted({
      courseId,
      lessonId,
      lessonNo,
    });
  }

  return { courseId, lessonId };
}

function touchLessonVocabSafe(courseId, lessonId, lessonWords) {
  if (
    !PROGRESS_ENGINE ||
    typeof PROGRESS_ENGINE.touchLessonVocab !== "function"
  ) {
    return;
  }

  const vocabItems = (lessonWords || [])
    .map((w) => wordKey(w) || w)
    .filter(Boolean);

  PROGRESS_ENGINE.touchLessonVocab({
    courseId,
    lessonId,
    vocabItems,
  });
}

function renderLessonCover(lessonData) {
  const lessonCoverUrl =
    IMAGE_ENGINE && typeof IMAGE_ENGINE.getLessonImage === "function"
      ? IMAGE_ENGINE.getLessonImage(lessonData, {
          courseType: state.version,
          level: "hsk" + state.lv,
        })
      : null;

  const coverWrap = $("hskLessonCoverWrap");
  const coverImg = $("hskLessonCover");

  if (!coverWrap || !coverImg) return;

  if (lessonCoverUrl) {
    coverImg.src = lessonCoverUrl;
    coverImg.alt =
      typeof lessonData?.title === "object"
        ? lessonData.title?.zh || lessonData.title?.en || ""
        : String(lessonData?.title || "");

    coverImg.onerror = () => {
      coverWrap.classList.add("hidden");
    };

    coverWrap.classList.remove("hidden");
  } else {
    coverWrap.classList.add("hidden");
  }
}

function renderLessonSceneSection(lessonData, lang) {
  const sceneSection = $("hskSceneSection");
  if (!sceneSection) return;

  if (
    SCENE_ENGINE &&
    typeof SCENE_ENGINE.hasScene === "function" &&
    SCENE_ENGINE.hasScene(lessonData)
  ) {
    const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);

    sceneSection.innerHTML =
      SceneRenderer.renderSceneHeader(scene, lang) +
      SceneRenderer.renderSceneGoals(scene, lang) +
      SceneRenderer.renderSceneCharacters(scene, lang);

    sceneSection.classList.remove("hidden");
  } else {
    sceneSection.innerHTML = "";
    sceneSection.classList.add("hidden");
  }
}

function updateLessonContextWindow(lessonNo) {
  window.__HSK_PAGE_CTX = {
    version: state.version,
    level: state.lv,
    lessonNo,
    from:
      typeof location !== "undefined"
        ? location.pathname
        : "/pages/hsk.html",
  };
}

function markStepCompletedSafe(stepKey) {
  if (!state.current || !state.current.lessonData) return;

  const courseId = getCourseId();
  const lessonId =
    state.current.lessonData.id ||
    `${courseId}_lesson${state.current.lessonNo}`;

  if (
    PROGRESS_ENGINE &&
    typeof PROGRESS_ENGINE.markStepCompleted === "function"
  ) {
    PROGRESS_ENGINE.markStepCompleted({
      courseId,
      lessonId,
      step: stepKey,
    });
  }

  updateProgressBlock();
}

function recordPracticeCompletionSafe({
  total,
  correct,
  score,
  lesson,
  wrongItems = [],
}) {
  if (!state.current || !state.current.lessonData) return;

  const courseId = getCourseId();
  const lessonId =
    state.current.lessonData.id ||
    `${courseId}_lesson${state.current.lessonNo}`;

  if (
    PROGRESS_ENGINE &&
    typeof PROGRESS_ENGINE.recordPracticeResult === "function"
  ) {
    PROGRESS_ENGINE.recordPracticeResult({
      courseId,
      lessonId,
      total,
      correct,
      score,
      vocabItems: ((lesson && lesson.vocab) || (lesson && lesson.words) || [])
        .map((w) =>
          typeof w === "string"
            ? w
            : (w && w.hanzi) || (w && w.word) || ""
        )
        .filter(Boolean),
      wrongItems,
    });
  }

  if (
    PROGRESS_ENGINE &&
    typeof PROGRESS_ENGINE.markLessonCompleted === "function"
  ) {
    PROGRESS_ENGINE.markLessonCompleted({ courseId, lessonId });
  }

  addWrongItems(wrongItems, { lessonId, courseId });
  addRecentItem({
    lessonId,
    courseId,
    total,
    correct,
    score,
    practicedAt: Date.now(),
  });

  updateProgressBlock();
}

function mountAIPanelSafe(lessonData, lang) {
  const aiRoot = $("hskAIResult");
  if (!aiRoot) return;

  if (
    AI_CAPABILITY &&
    typeof AI_CAPABILITY.mountAIPanel === "function"
  ) {
    try {
      AI_CAPABILITY.mountAIPanel(aiRoot, {
        lesson: lessonData,
        lang,
        wordsWithMeaning: (w) => wordMeaning(w, lang),
      });
      return;
    } catch (e) {
      console.warn("[HSK] AI panel mount failed:", e?.message || e);
    }
  }

  aiRoot.innerHTML = "";
}

function _optionHasLetterKey(o) {
  return !!(o && typeof o === "object" && _trimStr(o.key));
}

function _optionsLookLikeLetterKeyedMeanings(opts) {
  if (!Array.isArray(opts) || !opts.length) return false;
  if (!opts.every((x) => x && typeof x === "object")) return false;
  if (!opts.some((o) => _optionHasLetterKey(o))) return false;

  return opts.some((o) => {
    const z = _trimStr(o.zh ?? o.cn);
    return (
      z &&
      /[\u4e00-\u9fff]/.test(z) &&
      (_trimStr(o.kr) ||
        _trimStr(o.ko) ||
        _trimStr(o.en) ||
        _trimStr(o.jp) ||
        _trimStr(o.ja))
    );
  });
}

/**
 * 选择题展示模式（只影响显示，不影响判题）
 */
function practiceChoiceDisplayKind(q) {
  const st = String(q.subtype ?? q.subType ?? "").toLowerCase();
  const listen = !!(q.audioUrl ?? q.listen ?? q.hasListen);

  // 听力 → 一律中文选项
  if (listen) return "zh_options";

  // 拼音 → 中文
  if (st.includes("pinyin_to_vocab")) return "zh_options";

  // 外语 → 中文
  if (st.includes("meaning_to_vocab") || st.includes("native_to_zh"))
    return "zh_options";

  // 词义题
  if (
    st.includes("vocab_meaning_choice") ||
    st.includes("extension_meaning_choice")
  ) {
    return "meaning_ui";
  }

  // 句子理解
  if (
    st.includes("dialogue") ||
    st.includes("sentence") ||
    st.includes("translation")
  ) {
    return "sentence_translation";
  }

  // 中文 → 释义
  if (st.includes("zh_to_meaning")) {
    const opts = q.options;
    if (!Array.isArray(opts) || !opts.length) return "infer";

    const first = opts[0];
    if (typeof first === "string") return "zh_options";

    if (_optionsLookLikeLetterKeyedMeanings(opts)) return "meaning_ui";

    return "zh_options";
  }

  // grammar / 填空 / 排序 → 中文
  if (
    st.includes("grammar") ||
    st.includes("blank") ||
    st.includes("order")
  ) {
    return "zh_options";
  }

  return "infer";
}



/**
 * ===============================
 * Dialogue / Grammar / Extension / Review / AI
 * ===============================
 */

/** 统一获取会话卡片：generatedDialogues > structuredDialogues > dialogueCards > dialogue */
function getDialogueCards(lesson) {
  const arr =
    lesson && Array.isArray(lesson.generatedDialogues) && lesson.generatedDialogues.length
      ? lesson.generatedDialogues
      : lesson && Array.isArray(lesson.structuredDialogues) && lesson.structuredDialogues.length
      ? lesson.structuredDialogues
      : lesson && Array.isArray(lesson.dialogueCards) && lesson.dialogueCards.length
      ? lesson.dialogueCards
      : lesson && Array.isArray(lesson.dialogue) && lesson.dialogue.length
      ? lesson.dialogue
      : [];

  if (!arr.length) return [];

  const first = arr[0];
  const isCard = first && first.lines && Array.isArray(first.lines);
  const isLine =
    first &&
    (first.speaker != null ||
      first.spk != null ||
      first.cn != null ||
      first.zh != null ||
      first.text != null);

  if (isCard) return arr;
  if (isLine) return [{ title: null, lines: arr }];
  return [];
}

/** 渲染单条对话行 */
function renderDialogueLine(line, lang, showPinyin) {
  const spk = String((line && line.spk) || (line && line.speaker) || "").trim();
  const zh = String(
    (line && line.text) ||
      (line && line.zh) ||
      (line && line.cn) ||
      (line && line.line) ||
      ""
  ).trim();

  let py = maybeGetManualPinyin(line, "dialogue");
  if (showPinyin && zh && !py) py = resolvePinyin(zh, py);

  const trans = pickDialogueTranslation(line, zh);
  const zhAttrs = zh
    ? ` data-speak-text="${escapeHtml(zh).replaceAll('"', "&quot;")}" data-speak-kind="dialogue"`
    : "";

  return `<article class="lesson-dialogue-line">
  ${spk ? `<div class="lesson-dialogue-speaker">${escapeHtml(spk)}</div>` : ""}
  <div class="lesson-dialogue-zh"${zhAttrs}>${escapeHtml(zh)}</div>
  ${py ? `<div class="lesson-dialogue-pinyin">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="lesson-dialogue-translation">${escapeHtml(trans)}</div>` : ""}
</article>`;
}

/** 对话渲染 */
function buildDialogueHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const cards = getDialogueCards(raw);
  const lang = getLang();

  const hero = `<section class="lesson-section-hero lesson-dialogue-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.dialogue_subtitle"))}</p>
</section>`;

  if (!cards.length) {
    return `${hero}<div class="lesson-empty-state">${escapeHtml(i18n.t("hsk.empty_dialogue"))}</div>`;
  }

  if (
    SCENE_ENGINE &&
    typeof SCENE_ENGINE.hasScene === "function" &&
    SCENE_ENGINE.hasScene(lessonData)
  ) {
    const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);
    const framesHtml = SceneRenderer.renderSceneFrames(scene, lessonData, lang);
    if (framesHtml) return hero + framesHtml;
  }

  const showPinyin = shouldShowPinyin({
    level: lessonData && lessonData.level,
    version: lessonData && lessonData.version,
  });

  return `${hero}<div class="lesson-dialogue-list">
${cards
  .map((card, index) => {
    const lines = Array.isArray(card && card.lines) ? card.lines : [];
    if (!lines.length) return "";
    const titleText = pickCardTitle(card && card.title, index + 1);
    const lineHtml = lines.map((line) => renderDialogueLine(line, lang, showPinyin)).join("");
    return `<section class="lesson-dialogue-card">
    <h4 class="lesson-dialogue-card-title">${escapeHtml(titleText)}</h4>
    <div class="lesson-dialogue-lines">${lineHtml}</div>
  </section>`;
  })
  .filter(Boolean)
  .join("\n")}
</div>`;
}


/** 语法例句 */
function getGrammarExamples(pt) {
  const ex = (pt && pt.example) || (pt && pt.examples);
  const lang = normalizePracticeLangAliases(getLang());

  const toItem = (e) => {
    if (typeof e === "string") {
      return { zh: e, pinyin: "", trans: "" };
    }

    const zh = _trimStr(e && (e.zh || e.cn || e.line || e.text));
    const pinyin = _trimStr(e && (e.pinyin || e.py));

    let trans = "";
    const transObj = e && (e.translation || e.translations || e.trans);
    if (transObj && typeof transObj === "object") {
      trans = _getControlledLangText(transObj, lang, "grammar example translation");
    } else {
      trans = getContentText(e, "translation", { strict: true, lang }) || "";
    }

    return { zh, pinyin, trans };
  };

  if (!ex) return [];
  if (Array.isArray(ex)) return ex.map(toItem).filter((x) => x.zh);
  return [toItem(ex)].filter((x) => x.zh);
}

/** 语法渲染 */
function buildGrammarHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const g = raw && raw.grammar;
  const lang = getLang();
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
      const examples = getGrammarExamples(pt);
      const idx = String(i + 1).padStart(2, "0");
      const titleEsc = escapeHtml(titleZh).replaceAll('"', "&quot;");
      const titleAttrs = titleZh
        ? ` data-speak-text="${titleEsc}" data-speak-kind="grammar"`
        : "";
      const btnAttrs = titleZh
        ? ` data-speak-text="${titleEsc}" data-speak-kind="grammar"`
        : "";

      let examplesHtml = "";
      if (examples.length) {
        examplesHtml = examples
          .map((ex) => {
            let exPy = ex.pinyin;
            if (showPinyin && ex.zh && !exPy) exPy = resolvePinyin(ex.zh, exPy);
            const exEsc = escapeHtml(ex.zh).replaceAll('"', "&quot;");
            const exAttrs = ex.zh
              ? ` data-speak-text="${exEsc}" data-speak-kind="grammar"`
              : "";
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
    <button type="button" class="lesson-grammar-audio-btn"${btnAttrs}>${escapeHtml(speakLabel)}</button>
  </div>
  <div class="lesson-grammar-head">
    <div class="lesson-grammar-zh"${titleAttrs}>${escapeHtml(titleZh)}</div>
    ${titlePy ? `<div class="lesson-grammar-pinyin">${escapeHtml(titlePy)}</div>` : ""}
  </div>
  ${expl ? `<div class="lesson-grammar-expl">${escapeHtml(expl)}</div>` : ""}
  ${examplesHtml ? `<div class="lesson-grammar-examples">${examplesHtml}</div>` : ""}
</article>`;
    })
    .join("");

  return `${hero}<section class="lesson-grammar-list">${cards}</section>`;
}

/** Extension explanation：只读 explain / note */
function getExtensionExplanation(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang || getLang());
  const explain = item.explain ?? item.explanation;

  if (explain && typeof explain === "object") {
    if (l === "kr") return _trimStr(explain.kr) || _trimStr(explain.ko) || "";
    if (l === "jp") return _trimStr(explain.jp) || _trimStr(explain.ja) || "";
    if (l === "cn") return _trimStr(explain.cn) || _trimStr(explain.zh) || "";
    return _trimStr(explain.en) || "";
  }

  if (l === "kr") {
    const flat =
      _trimStr(item.explainKr) ||
      _trimStr(item.explanationKr) ||
      _trimStr(item.explain_kr) ||
      _trimStr(item.explanation_kr);
    if (flat) return flat;
  }

  if (l === "jp") {
    const flat =
      _trimStr(item.explainJp) ||
      _trimStr(item.explanationJp) ||
      _trimStr(item.explain_jp) ||
      _trimStr(item.explanation_jp);
    if (flat) return flat;
  }

  if (l === "cn") {
    const flat =
      _trimStr(item.explainCn) ||
      _trimStr(item.explanationCn) ||
      _trimStr(item.explain_zh) ||
      _trimStr(item.explanation_zh);
    if (flat) return flat;
  }

  if (l === "en") {
    const flat =
      _trimStr(item.explainEn) ||
      _trimStr(item.explanationEn) ||
      _trimStr(item.explain_en) ||
      _trimStr(item.explanation_en);
    if (flat) return flat;
  }

  const note = item.note;
  if (note && typeof note === "object") {
    return _getStrictLangText(note, l) || "";
  }
  if (typeof note === "string" && note.trim()) return _trimStr(note);

  return "";
}

/** Extension 主译文：当前语言 -> English -> Chinese，不乱跳 */
function getExtensionMeaning(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang || getLang());

  if (l === "kr") {
    return (
      _trimStr(item.kr) ||
      _trimStr(item.ko) ||
      _trimStr(item.translationKr) ||
      _trimStr(item.translation_kr) ||
      _trimStr(item.en) ||
      _trimStr(item.translationEn) ||
      _trimStr(item.translation_en) ||
      _trimStr(item.cn) ||
      _trimStr(item.zh) ||
      ""
    );
  }

  if (l === "jp") {
    return (
      _trimStr(item.jp) ||
      _trimStr(item.ja) ||
      _trimStr(item.translationJp) ||
      _trimStr(item.translation_jp) ||
      _trimStr(item.en) ||
      _trimStr(item.translationEn) ||
      _trimStr(item.translation_en) ||
      _trimStr(item.cn) ||
      _trimStr(item.zh) ||
      ""
    );
  }

  if (l === "cn") {
    return (
      _trimStr(item.cn) ||
      _trimStr(item.zh) ||
      _trimStr(item.en) ||
      _trimStr(item.translationEn) ||
      _trimStr(item.translation_en) ||
      ""
    );
  }

  return (
    _trimStr(item.en) ||
    _trimStr(item.translationEn) ||
    _trimStr(item.translation_en) ||
    _trimStr(item.cn) ||
    _trimStr(item.zh) ||
    ""
  );
}

/** Extension 渲染 */
function buildExtensionHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const arr =
    Array.isArray(raw && raw.generatedExtensions) && raw.generatedExtensions.length
      ? raw.generatedExtensions
      : Array.isArray(raw && raw.extension)
      ? raw.extension
      : [];

  const lang = getLang();
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

  const str = (v) => _trimStr(v);

  const pickObj = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return _getControlledLangText(obj, lang, "extension object");
  };

  const pickTrans = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return _getControlledLangText(obj, lang, "extension translation");
  };

  const cards = arr
    .map((item, i) => {
      const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];
      const isGroup = sentences.length > 0 && (item.groupTitle || item.focusGrammar);

      if (isGroup) {
        const groupTitle =
          pickObj(item.groupTitle) ||
          str(item.focusGrammar) ||
          `${i18n.t("hsk.extension_group", "句型练习")} ${i + 1}`;

        const note = pickObj(item.note);

        const sentencesHtml = sentences
          .map((s) => {
            const cn = str((s && s.cn) || (s && s.zh) || "");
            const py = str((s && s.pinyin) || (s && s.py) || "");
            const trans = pickTrans(s && (s.translations || s.translation));
            const zhEsc = escapeHtml(cn).replaceAll('"', "&quot;");
            const attrs = cn
              ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"`
              : "";

            return `<div class="lesson-extension-sentence">
          <div class="lesson-extension-sentence-zh"${attrs}>${escapeHtml(cn)}</div>
          ${py ? `<div class="lesson-extension-sentence-pinyin">${escapeHtml(py)}</div>` : ""}
          ${trans ? `<div class="lesson-extension-sentence-trans">${escapeHtml(trans)}</div>` : ""}
          ${
            cn
              ? `<button type="button" class="lesson-extension-audio-btn text-xs mt-1" data-speak-text="${zhEsc}" data-speak-kind="extension">${escapeHtml(speakLabel)}</button>`
              : ""
          }
        </div>`;
          })
          .join("");

        return `<article class="lesson-extension-group-card">
  <div class="lesson-extension-group-header">
    <span class="lesson-extension-group-index">${String(i + 1).padStart(2, "0")}</span>
    <h4 class="lesson-extension-group-title">${escapeHtml(groupTitle)}</h4>
    ${
      item.focusGrammar
        ? `<span class="lesson-extension-focus">${escapeHtml(str(item.focusGrammar))}</span>`
        : ""
    }
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
      const zhAttrs = phrase
        ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"`
        : "";
      const btnAttrs = phrase
        ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"`
        : "";

      return `<article class="lesson-extension-card">
  <div class="lesson-extension-card-top">
    <span class="lesson-extension-index">${idx}</span>
    <button type="button" class="lesson-extension-audio-btn"${btnAttrs}>${escapeHtml(speakLabel)}</button>
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
    })
    .filter(Boolean)
    .join("");

  return `${hero}<section class="lesson-extension-list">${cards}</section>`;
}

/** 复习 tab */
function buildReviewHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const r = raw && raw.review;
  const lang = getLang();

  const pickSummary = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    const key =
      lang === "cn" || lang === "zh"
        ? "cn"
        : lang === "kr" || lang === "ko"
        ? "kr"
        : lang === "jp" || lang === "ja"
        ? "jp"
        : "en";

    return (
      _trimStr(obj[key]) ||
      _trimStr(obj.summary) ||
      _trimStr(obj.focus) ||
      _trimStr(obj.cn) ||
      _trimStr(obj.zh) ||
      ""
    );
  };

  if (!r || typeof r !== "object") {
    return `<div class="lesson-review-empty text-sm opacity-70">${escapeHtml(
      i18n.t("hsk.review_empty") || "暂无复习内容"
    )}</div>`;
  }

  const parts = [];
  const isReviewLesson = raw && raw.type === "review";
  const lessonWords = Array.isArray(r.lessonWords) ? r.lessonWords : [];
  const relatedOldWords = Array.isArray(r.relatedOldWords) ? r.relatedOldWords : [];
  const grammarReview = Array.isArray(r.grammarReview) ? r.grammarReview : [];
  const summaryTasks = Array.isArray(r.summaryTasks) ? r.summaryTasks : [];
  const reviewRange = Array.isArray(r.lessonRange)
    ? r.lessonRange
    : Array.isArray(r.reviewRange)
    ? r.reviewRange
    : [];

  if (isReviewLesson && reviewRange.length >= 2) {
    const rangeText =
      i18n.t("hsk.review_range_lessons", {
        from: reviewRange[0],
        to: reviewRange[1],
      }) || `第 ${reviewRange[0]}～${reviewRange[1]} 课 综合复习`;
    parts.push(
      `<div class="lesson-review-range text-sm font-medium mb-3">${escapeHtml(rangeText)}</div>`
    );
  }

  if (lessonWords.length) {
    const label = isReviewLesson
      ? i18n.t("hsk.review_words") || "复习词汇"
      : i18n.t("hsk.lesson_words_review") || "本课词汇";
    parts.push(`<section class="lesson-review-section"><h4 class="text-sm font-semibold mb-2">${escapeHtml(
      label
    )}</h4><div class="flex flex-wrap gap-2">${lessonWords
      .map(
        (w) =>
          `<span class="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">${escapeHtml(
            String(w)
          )}</span>`
      )
      .join("")}</div></section>`);
  }

  if (relatedOldWords.length && !isReviewLesson) {
    parts.push(`<section class="lesson-review-section"><h4 class="text-sm font-semibold mb-2">${escapeHtml(
      i18n.t("hsk.related_old_words") || "关联旧词"
    )}</h4><div class="flex flex-wrap gap-2">${relatedOldWords
      .map(
        (w) =>
          `<span class="px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">${escapeHtml(
            String(w)
          )}</span>`
      )
      .join("")}</div></section>`);
  }

  if (grammarReview.length) {
    parts.push(`<section class="lesson-review-section"><h4 class="text-sm font-semibold mb-2">${escapeHtml(
      i18n.t("hsk.grammar_review") || "语法回顾"
    )}</h4><ul class="space-y-1">${grammarReview
      .map((g) => {
        const name = escapeHtml(_trimStr(g.name) || "-");
        const summaryObj =
          g.summary && typeof g.summary === "object"
            ? g.summary
            : g.summary
            ? { cn: g.summary, kr: g.summary, en: g.summary, jp: g.summary }
            : g;
        const summary = escapeHtml(pickSummary(summaryObj));
        return `<li><span class="font-medium">${name}</span>${
          summary ? ` — ${summary}` : ""
        }</li>`;
      })
      .join("")}</ul></section>`);
  }

  if (summaryTasks.length) {
    parts.push(`<section class="lesson-review-section"><h4 class="text-sm font-semibold mb-2">${escapeHtml(
      i18n.t("hsk.summary_tasks") || "复习任务"
    )}</h4><ul class="space-y-1">${summaryTasks
      .map((t) => `<li>${escapeHtml(typeof t === "string" ? t : t?.cn || t?.text || "")}</li>`)
      .join("")}</ul></section>`);
  }

  if (!parts.length) {
    return `<div class="lesson-review-empty text-sm opacity-70">${escapeHtml(
      i18n.t("hsk.review_empty") || "暂无复习内容"
    )}</div>`;
  }

  return `<div class="lesson-review-content space-y-4">${parts.join("")}</div>`;
}

/** AI context */
function buildAIContext() {
  if (!state.current || !state.current.lessonData) return "";

  const lang = getLang();
  const ld = state.current.lessonData;
  const no = state.current.lessonNo;

  const found =
    state.lessons && state.lessons.find((x) => getLessonNumber(x) === no);
  const title = found ? getLessonDisplayTitle(found, lang) : "";

  const words = Array.isArray(state.current.lessonWords) ? state.current.lessonWords : [];
  const wordsLine = words
    .slice(0, 12)
    .map((w) => {
      const han = wordKey(w);
      const py = wordPinyin(w);
      const mean = wordMeaning(w, lang);
      return `${han}${py ? `(${py})` : ""}${mean ? `: ${mean}` : ""}`;
    })
    .join("\n");

  const lessonLabel =
    i18n.t("hsk.lesson_no_format", { n: no }) ||
    (lang === "jp"
      ? `第 ${no} 課`
      : lang === "kr"
      ? `제 ${no}과`
      : `Lesson ${no}`);

  const questionLabel =
    i18n.t("practice.question_label") ||
    (lang === "jp" ? "質問" : "Question");

  const titleLabel = lang === "jp" ? "タイトル" : "Title";

  return [
    lessonLabel,
    title ? `${titleLabel}: ${title}` : "",
    wordsLine ? `Words:\n${wordsLine}` : "",
    "",
    questionLabel + ":",
  ]
    .filter(Boolean)
    .join("\n");
}

/** vocab-map loader */
const _vocabMapCache = new Map();

async function loadVocabMap(levelKey) {
  if (_vocabMapCache.has(levelKey)) return _vocabMapCache.get(levelKey);

  const base = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  const root = base ? base + "/" : "/";
  const url = `${root}data/pedagogy/${levelKey}-vocab-map.json`;

  try {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) return null;
    const data = await res.json();
    const map = data && typeof data === "object" ? data : null;
    _vocabMapCache.set(levelKey, map);
    return map;
  } catch {
    return null;
  }
}

function rerenderPractice(container, lang) {
  if (!container) return;

  const langKey = practiceLangKeyFromUiLang(lang);

  // ⭐ 不再重新 build pool（这是导致题目消失的核心原因）
  const questions = PracticeState.getQuestions();

  if (!Array.isArray(questions) || questions.length === 0) {
    console.warn("[Practice] No questions in state");
    return;
  }

  // ⭐ 只做“显示层处理”，不做过滤！
  applyChoiceDisplayToQuestionList(questions, langKey);

  // ⭐ 只rerender UI
  rerenderPracticeFromEngine(container, lang);
}

function mountPractice(container, opts) {
  if (!container) return;

  const langKey = practiceLangKeyFromUiLang(opts?.lang);

  const lesson = opts?.lesson;

  if (!lesson) return;

  // ⭐ 只在这里 build 一次
  const safeLesson = buildLessonWithClonedPracticeForDisplay(
    lesson,
    langKey
  );

  mountPracticeFromEngine(container, {
    ...(opts || {}),
    lesson: safeLesson,
  });
}

window.addEventListener("joy:langChanged", (e) => {
  const newLang =
    (e && e.detail && e.detail.lang) || getLang();

  if (!isHSKPageActive()) return;

  try {
    i18n.apply(document);
  } catch {}

  setSubTitle();

  // ⭐ 只刷新 UI，不重建数据
  rerenderHSKFromState();

  // ⭐ 单独刷新 Practice（关键！）
  const practiceEl = $("hskPracticeBody");
  if (practiceEl) {
    try {
      rerenderPractice(practiceEl, newLang);
    } catch (e) {
      console.warn("[Practice] rerender failed:", e);
    }
  }
});

el = $("hskStudyTabs");
if (el)
  el.addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;

    state.tab = btn.dataset.tab;
    updateTabsUI();

    // ⭐ 只有切到 practice 时才 rerender
    if (state.tab === "practice") {
      const practiceEl = $("hskPracticeBody");
      if (practiceEl) {
        rerenderPractice(practiceEl, getLang());
      }
    }
  });

function enterReviewMode(mode, lessonId = "", levelKey = "") {
  const container = $("hskReviewContainer");
  if (!container || !renderReviewMode) return;

  const { session, questions } = prepareReviewSession({
    mode,
    lessonId,
    levelKey,
  });

  if (!questions.length) {
    container.innerHTML = `<div class="p-4">No data</div>`;
    container.classList.remove("hidden");
    return;
  }

  container.classList.remove("hidden");

  renderReviewMode(container, session, {
    lang: getLang(),
    onFinish: () => {
      container.classList.add("hidden");
      container.innerHTML = "";
    },
  });
}

/**
 * ===============================
 * Small Utility Tail
 * ===============================
 */

function _optionHasLetterKey(o) {
  return !!(o && typeof o === "object" && _trimStr(o.key));
}

function _optionsLookLikeLetterKeyedMeanings(opts) {
  if (!Array.isArray(opts) || !opts.length) return false;
  if (!opts.every((x) => x && typeof x === "object")) return false;
  if (!opts.some((o) => _optionHasLetterKey(o))) return false;

  return opts.some((o) => {
    const z = _trimStr(o.zh ?? o.cn);
    return (
      z &&
      _HANZI_RE.test(z) &&
      (_trimStr(o.kr) ||
        _trimStr(o.ko) ||
        _trimStr(o.en) ||
        _trimStr(o.jp) ||
        _trimStr(o.ja))
    );
  });
}

/**
 * ===============================
 * Final Safety Utilities Layer
 * ===============================
 * 防止隐藏错误 / 统一兜底 / 提升稳定性
 */

/** 安全调用（防止 undefined function 崩溃） */
function safeCall(fn, ...args) {
  try {
    if (typeof fn === "function") {
      return fn(...args);
    }
  } catch (e) {
    console.warn("[SAFE CALL ERROR]", e?.message || e);
  }
  return undefined;
}

/** DOM 安全写入 */
function safeSetHTML(el, html) {
  if (!el) return;
  try {
    el.innerHTML = html || "";
  } catch (e) {
    console.warn("[SAFE HTML ERROR]", e?.message || e);
  }
}

/** DOM 安全文本 */
function safeSetText(el, text) {
  if (!el) return;
  try {
    el.textContent = text || "";
  } catch (e) {
    console.warn("[SAFE TEXT ERROR]", e?.message || e);
  }
}

/** 数组安全 */
function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

/** 对象安全 */
function safeObject(obj) {
  return obj && typeof obj === "object" ? obj : {};
}

/** 字符串安全 */
function safeString(v) {
  return typeof v === "string" ? v : "";
}

/** 防止 JSON clone 崩溃 */
function safeClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

/** 统一 key 归一（语言 key 防错） */
function normalizeLangKey(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "ko") return "kr";
  if (l === "ja") return "jp";
  if (l === "zh") return "cn";
  return l || "en";
}

/** debug 开关（以后可以全局关闭） */
const HSK_DEBUG = true;

function debugLog(...args) {
  if (!HSK_DEBUG) return;
  console.log("[HSK DEBUG]", ...args);
}

function debugWarn(...args) {
  if (!HSK_DEBUG) return;
  console.warn("[HSK WARN]", ...args);
}

function debugError(...args) {
  if (!HSK_DEBUG) return;
  console.error("[HSK ERROR]", ...args);
}

/**
 * ===============================
 * 初始化完整性检查（非常重要）
 * ===============================
 */
function runHSKSanityCheck() {
  try {
    debugLog("=== HSK SANITY CHECK START ===");

    // 检查核心依赖
    const required = [
      "buildLessonWithClonedPracticeForDisplay",
      "buildLanguageSafePracticePool",
      "applyChoiceDisplayToQuestionList",
      "rerenderHSKFromState",
      "mountPractice",
      "rerenderPractice",
    ];

    const missing = required.filter((fn) => typeof window[fn] !== "function");

    if (missing.length) {
      console.warn("[HSK CHECK] Missing functions:", missing);
    } else {
      debugLog("[HSK CHECK] All core functions OK");
    }

    // 检查关键容器
    const domCheck = [
      "hskLessonList",
      "hskPracticeBody",
      "hskDialogueBody",
      "hskGrammarBody",
      "hskExtensionBody",
    ];

    domCheck.forEach((id) => {
      if (!document.getElementById(id)) {
        console.warn(`[HSK CHECK] Missing DOM: #${id}`);
      }
    });

    debugLog("=== HSK SANITY CHECK END ===");
  } catch (e) {
    console.warn("[HSK CHECK ERROR]", e?.message || e);
  }
}

/**
 * ===============================
 * 页面初始化增强（补丁层）
 * ===============================
 */
function enhanceHSKMount() {
  try {
    runHSKSanityCheck();

    // 防止 PracticeState 崩溃
    if (
      typeof PracticeState !== "undefined" &&
      typeof PracticeState.getQuestions !== "function"
    ) {
      console.warn("[HSK PATCH] PracticeState incomplete");
    }

    // 防止 i18n 未加载
    if (!i18n || typeof i18n.t !== "function") {
      console.warn("[HSK PATCH] i18n not ready");
    }

    // 防止 AUDIO_ENGINE 未加载
    if (!window.AUDIO_ENGINE) {
      console.warn("[HSK PATCH] AUDIO_ENGINE missing");
    }
  } catch (e) {
    console.warn("[HSK ENHANCE ERROR]", e?.message || e);
  }
}

export async function mount() {
  const navRoot = $("siteNav");
  const app = $("app");

  if (!navRoot || !app) {
    console.error("HSK Page Error: missing #siteNav or #app");
    return false;
  }

  await ensureHSKDeps();

  // ✅ glossary 预加载（用于词义 fallback）
  const scope = `hsk${state.lv}`;
  loadGlossary("kr", scope).catch(() => {});
  loadGlossary("en", scope).catch(() => {});
  loadGlossary("jp", scope).catch(() => {});

  // ✅ mini nav
  navRoot.dataset.mode = "mini";
  mountNavBar(navRoot);

  app.innerHTML = getHSKLayoutHTML();

  // 初始化版本
  const savedVer = localStorage.getItem("hsk_vocab_version") || state.version;
  state.version =
    (window.HSK_LOADER &&
    typeof window.HSK_LOADER.normalizeVersion === "function"
      ? window.HSK_LOADER.normalizeVersion(savedVer)
      : null) ||
    (savedVer === "hsk3.0" ? "hsk3.0" : "hsk2.0");

  $("hskLevel") && ($("hskLevel").value = String(state.lv));
  $("hskVersion") && ($("hskVersion").value = String(state.version));

  try {
    i18n.apply(document);
  } catch {}

  bindWordCardActions();
  bindEvents();

  // ⭐⭐⭐ 关键补丁入口（你刚刚问的）
  enhanceHSKMount();

  await loadLessons();
  showListMode();

  return true;
}
