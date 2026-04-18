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
  normalizeLang,
  selectHskWordPanelVocabulary,
  deriveRegularLessonPanelWordList,
  collectRegularLessonPanelHanziKeys,
} from "../modules/hsk/hskRenderer.js";
import {
  buildLessonReviewData,
  renderLessonReviewHTML,
} from "../modules/hsk/hskLessonReview.js";
import { loadBlueprint } from "../modules/curriculum/blueprintLoader.js";
import { distributeVocabulary, distributeVocabularyByMap, auditVocabularyCoverage } from "../modules/curriculum/vocabDistributor.js";
import {
  resolvePinyin,
  maybeGetManualPinyin,
  shouldShowPinyin,
  normalizePinyinDisplayAllLowercase,
  stripStandalonePinyinLinesForTts,
} from "../utils/pinyinEngine.js";
import {
  collectLessonPinyinToHanziMap,
  resolvePinyinDisplayToSpeakZh,
} from "../utils/hsk30UiMeaningMixedTts.js";
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
  prepareReviewSession,
  stopAllLearningAudio,
} from "../platform/index.js";
import * as PracticeState from "../modules/practice/practiceState.js";
import { mountPractice as mountPracticeFromEngine, rerenderPractice as rerenderPracticeFromEngine } from "../modules/practice/practiceRenderer.js";
import { addWrongItems, addRecentItem } from "../modules/review/reviewEngine.js";
import * as SceneRenderer from "../platform/scene/sceneRenderer.js";
import { getLocalizedSceneText } from "../platform/scene/sceneUtils.js";
import {
  resolveChoiceDisplayKindWithInfer,
  stemTextWithFallback,
} from "../modules/hsk/practiceDisplayStrategy.js";

console.log("[HSK-PRACTICE-DEBUG-BOOT]", {
  file: "page.hsk.js",
  ts: "2026-03-27-debug",
});

const state = {
  lv: 1,
  version: "hsk2.0",
  lessons: [],
  current: null,
  tab: "words",
  searchKeyword: "",
  reviewMode: null,
  /**
   * 来自 lessons.json 的 vocabTargets（每课教学目标子集 / 对话拆词白名单）。
   * 不是正式词表：正式词表以 vocab-distribution 为准；二者允许不等，校验见 scripts/check-hsk1-vocab-targets.mjs。
   */
  hskLessonVocabTargetsByNo: null,
};

let el;

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

/** GCE 曾只把 type 放在 meta；判断复习课需同时看顶层与 meta */
function lessonIsReview(lessonData) {
  return (
    String(lessonData?.type || lessonData?.meta?.type || "")
      .toLowerCase()
      .trim() === "review"
  );
}

/** HSK3.0 · HSK1 试点：单词区使用紧凑正式学习词条（非大卡片网格） */
function shouldUseCompactLearnVocabLayout() {
  return String(state.version || "").toLowerCase() === "hsk3.0" && Number(state.lv) === 1;
}

/** HSK3.0 · HSK1 试点：会话/单词朗读链（中文→系统语言释义） */
function shouldUseHsk30Hsk1SpeakPilot() {
  return String(state.version || "").toLowerCase() === "hsk3.0" && Number(state.lv) === 1;
}

/** 全文朗读：对话 1/2/3 提示音（系统语言 TTS） */
function dialogueSessionIntroTts(sessionIndex1Based) {
  const l = normalizeLang(getLang());
  const n = Number(sessionIndex1Based) || 1;
  if (l === "kr") return `회화 ${n}`;
  if (l === "jp") return `会話 ${n}`;
  if (l === "cn") return `对话 ${n}`;
  return `Dialogue ${n}`;
}

/**
 * Lumina HSK：LESSON_ENGINE 拉取原始课件后，统一经 HSK_LOADER.loadLessonDetail 收口（与 data 权威规则一致）。
 * - lessons.json：仅课程目录/元数据，不是普通课主词表。
 * - 普通课：正式词表 = vocab-distribution；课内 vocab 仅 enrich；practice = 对应 lessonN.json（禁止用引擎侧另一份 practice 覆盖）。
 * - 复习课：词/会话/语法/扩展 = review range 内聚合；practice = 运行时生成（opts.practiceLang 传 UI 语言）。
 */
async function mergeReviewLessonFromHskLoader(lessonData, lessonNo, file) {
  await ensureHSKDeps();
  if (!lessonData || !window.HSK_LOADER?.loadLessonDetail) return lessonData;
  const no = Number(lessonNo) || 1;
  const f = String(file || "");
  try {
    const L = await window.HSK_LOADER.loadLessonDetail(state.lv, no, {
      version: state.version,
      file: f || undefined,
      practiceLang: practiceLangKeyFromUiLang(getLang()),
    });
    if (!L || typeof L !== "object") return lessonData;
    const mergedType = String(L.type || lessonData.type || lessonData.meta?.type || "lesson").trim();
    const mergedPractice = Array.isArray(L.practice) ? L.practice : [];
    const next = {
      ...lessonData,
      type: mergedType,
      vocab: Array.isArray(L.vocab) ? L.vocab : lessonData.vocab,
      words: Array.isArray(L.words) ? L.words : lessonData.words,
      dialogue: L.dialogue != null ? L.dialogue : lessonData.dialogue,
      dialogueCards:
        L.dialogueCards != null
          ? L.dialogueCards
          : L.dialogue != null
            ? L.dialogue
            : lessonData.dialogueCards,
      grammar: L.grammar != null ? L.grammar : lessonData.grammar,
      extension: L.extension != null ? L.extension : lessonData.extension,
      practice: mergedPractice,
      review: L.review ?? lessonData.review,
      steps: L.steps ?? lessonData.steps,
      stepKeys: L.stepKeys ?? lessonData.stepKeys,
      aiLearning: L.aiLearning != null ? L.aiLearning : lessonData.aiLearning,
    };
    if (lessonData.meta && typeof lessonData.meta === "object") {
      next.meta = { ...lessonData.meta, type: mergedType };
    }
    return next;
  } catch (e) {
    console.warn("[HSK] mergeReviewLessonFromHskLoader failed:", e?.message || e);
    return lessonData;
  }
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

  try {
    const fp = lessonForPractice && lessonForPractice.practice;
    console.log("[HSK-PRACTICE-MOUNT]", {
      lessonId: lessonForPractice?.id,
      lessonNo: lessonForPractice?.lessonNo,
      finalCountPassedToEngine: Array.isArray(fp) ? fp.length : 0,
      firstTwoFinal: Array.isArray(fp) ? fp.slice(0, 2).map(_abbrPracticeItemForLog) : [],
    });
  } catch (e) {
    console.warn("[HSK-PRACTICE-MOUNT] log failed:", e?.message || e);
  }

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
 * 可选：会话卡片的场景说明（多语言对象或字符串）
 */
function pickCardSummary(summaryObj) {
  if (summaryObj == null) return "";
  if (typeof summaryObj === "string") return summaryObj.trim();

  const lang = normalizePracticeLangAliases(getLang());
  const v =
    _getStrictLangText(summaryObj, lang) ||
    _trimStr(summaryObj && summaryObj.zh) ||
    _trimStr(summaryObj && summaryObj.cn) ||
    "";

  return v;
}

/**
 * 会话卡标题展示：有分隔符取后半段；否则尝试去掉「会话一 / Dialogue 1」等前缀；都失败则原样。
 * 用于 HSK3.0·HSK1 画布模式，与左侧 01/02 编号并列时不重复堆字。
 */
function pickCardHeadingPrimary(titleObj, cardIndex) {
  const full = pickCardTitle(titleObj, cardIndex).trim();
  if (!full) return "";

  const parts = full.split(/[｜|]/);
  if (parts.length >= 2) {
    const tail = parts.slice(1).join("｜").trim();
    if (tail) return tail;
  }

  const head = parts[0].trim();
  const stripped = stripDialogueCardTitleSessionPrefix(head);
  if (stripped && stripped !== head) return stripped;
  return full;
}

/**
 * 剥离常见「会话/对话 + 编号」类前缀（无 ｜ 时的兜底）
 */
function stripDialogueCardTitleSessionPrefix(text) {
  let s = String(text || "").trim();
  if (!s) return s;

  const rules = [
    /^会话\s*[一二三四五六七八九十百千两〇零0-9]{1,4}\s*[：:｜|\-－—]?\s*/u,
    /^对话\s*[一二三四五六七八九十百千两〇零0-9]{1,4}\s*[：:｜|\-－—]?\s*/u,
    /^会话\s*\d{1,2}\s*[：:｜|\-－—]?\s*/,
    /^对话\s*\d{1,2}\s*[：:｜|\-－—]?\s*/,
    /^Dialogue\s*\d{1,2}\s*[：:.｜|\-－—]?\s*/i,
    /^Session\s*\d{1,2}\s*[：:.｜|\-－—]?\s*/i,
    /^회화\s*\d{1,2}\s*[：:.｜|\-－—]?\s*/u,
    /^第\s*\d{1,2}\s*[课課]\s*[｜|]?\s*/,
  ];

  for (const re of rules) {
    const next = s.replace(re, "").trim();
    if (next !== s) return next || s;
  }
  return s;
}

function dialogueSessionAriaLabel(sessionIndex1Based) {
  const t = i18n.t("dialogue.session", { n: sessionIndex1Based });
  if (t && t !== "dialogue.session") return t;
  return `Session ${sessionIndex1Based}`;
}

/** 整课场景一行标题（不展示 scene.summary，避免与各卡 summary 重复） */
function buildHsk30Hsk1SceneCanvasLessonStrip(raw, lang) {
  if (!raw?.scene || typeof raw.scene !== "object" || !SCENE_ENGINE?.getSceneFromLesson) {
    return "";
  }
  const scene = SCENE_ENGINE.getSceneFromLesson(raw);
  if (!scene?.title) return "";
  const title = getLocalizedSceneText(scene.title, lang);
  if (!title) return "";
  return `<p class="hsk1-dialogue-lesson-strip">${escapeHtml(title)}</p>`;
}

/** HSK 3.0 · HSK1：会话区「一会话一画布」展示（全课次，与 HSK2.0 无关） */
function shouldUseHsk30Hsk1SceneCanvasDialogue(lessonData) {
  if (String(state.version || "").toLowerCase() !== "hsk3.0") return false;
  if (Number(state.lv) !== 1) return false;
  const raw = (lessonData && lessonData._raw) || lessonData || {};
  const no = Number(raw.lessonNo ?? state.current?.lessonNo ?? 0);
  return no >= 1;
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
 * 语法点「一眼能懂」的短提示（系统语言）；与 explanation 长文独立，互不替代。
 * 数据：grammar[].hint = { zh, kr|ko, en, jp|ja } 或扁平 hintKr 等。
 */
function getGrammarPatternHint(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang || getLang());
  const str = (v) => _trimStr(v);

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

function getGrammarPointsArray(raw) {
  const g = raw && raw.grammar;
  if (!g) return [];
  return Array.isArray(g) ? g : Array.isArray(g.points) ? g.points : [];
}

function getExtensionItemsArray(raw) {
  return Array.isArray(raw?.generatedExtensions) && raw.generatedExtensions.length
    ? raw.generatedExtensions
    : Array.isArray(raw?.extension)
      ? raw.extension
      : [];
}

/** HSK3.0 HSK1：语法卡朗读段（不含拼音 / 词性） */
function buildGrammarSpeakSegments(pt, lang) {
  const str = (v) => _trimStr(v);
  const titleZh =
    typeof pt?.title === "object"
      ? str(pt.title.zh || pt.title.cn || "")
      : str(pt?.pattern || pt?.title || pt?.name || "");
  const hintUi = getGrammarPatternHint(pt, lang);
  const explUi = getGrammarExplanation(pt, lang);
  const examples = getGrammarExamples(pt);
  const segs = [];
  if (titleZh) segs.push({ zh: titleZh, ui: "" });
  if (hintUi) segs.push({ ui: stripStandalonePinyinLinesForTts(hintUi) });
  if (explUi && explUi !== hintUi) segs.push({ ui: stripStandalonePinyinLinesForTts(explUi) });
  for (const ex of examples) {
    if (ex.zh) segs.push({ zh: ex.zh, ui: str(ex.trans || "") });
  }
  return segs;
}

/** 扩展：非组卡 */
function buildExtensionFlatSpeakSegments(item, lang) {
  const str = (v) => _trimStr(v);
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

/** 扩展：组卡（阅读材料等） */
function buildExtensionGroupSpeakSegments(item, lang) {
  const str = (v) => _trimStr(v);
  const pickObj = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return _getControlledLangText(obj, lang, "extension object");
  };
  const pickTrans = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return _getControlledLangText(obj, lang, "extension translation");
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

function buildPracticeMatchSpeakSegments(q, langKey, pinyinHanziMap) {
  const str = (v) => _trimStr(v);
  const map = pinyinHanziMap && pinyinHanziMap.size ? pinyinHanziMap : null;
  const pairs = q.pairs ?? [];
  const segs = [];
  for (const p of pairs) {
    const left = str(p?.left ?? p?.[0]);
    const right = str(p?.right ?? p?.[1]);
    const leftSpeak = map ? resolvePracticeTextToSpeakZh(left, typeof p === "object" ? p : null, map) : left;
    const rightSpeak = map ? resolvePracticeTextToSpeakZh(right, typeof p === "object" ? p : null, map) : right;
    const zhPart = leftSpeak || "";
    const uiPart = rightSpeak && rightSpeak !== leftSpeak ? rightSpeak : "";
    if (left || right) segs.push({ zh: zhPart, ui: uiPart });
  }
  return segs;
}

/** 练习选项拼音 → 汉字 TTS（委托 hsk30UiMeaningMixedTts） */
function resolvePracticeTextToSpeakZh(rawDisplay, optionObj, map) {
  return resolvePinyinDisplayToSpeakZh(rawDisplay, optionObj, map);
}

/** 练习单题：题干 + 选项/排序项 + 解析 */
function buildPracticeSpeakSegmentsUnified(q, langKey, lessonData) {
  const str = (v) => _trimStr(v);
  const type = String(q.type || "choice").toLowerCase();
  const usePinyinMap =
    shouldUseHsk30Hsk1SpeakPilot() && lessonData && typeof lessonData === "object";
  const rawLesson = lessonData?._raw || lessonData;
  const pinyinHanziMap = usePinyinMap ? collectLessonPinyinToHanziMap(rawLesson) : null;

  if (type === "match") return buildPracticeMatchSpeakSegments(q, langKey, pinyinHanziMap);

  const prompt = q.prompt ?? q.question ?? {};
  const stemCnRaw =
    prompt && typeof prompt === "object"
      ? str(prompt.cn || prompt.zh || "")
      : str(typeof q.question === "string" ? q.question : "");
  const stemCn =
    pinyinHanziMap && pinyinHanziMap.size
      ? resolvePracticeTextToSpeakZh(stemCnRaw, null, pinyinHanziMap)
      : stemCnRaw;
  const stemUi = practiceStemDisplayText(q, langKey);
  const segs = [];
  if (stemCn) segs.push({ zh: stemCn, ui: stemUi && stemUi !== stemCn ? stemUi : "" });
  else if (stemUi) segs.push({ ui: stemUi });

  if (type === "choice") {
    const options = Array.isArray(q.options) ? q.options : [];
    const LETTERS = ["A", "B", "C", "D", "E", "F"];
    const pickPromptLocal = (obj, lk) => {
      if (!obj || typeof obj !== "object") return "";
      const key =
        lk === "cn" || lk === "zh"
          ? "cn"
          : lk === "kr" || lk === "ko"
            ? "kr"
            : lk === "jp" || lk === "ja"
              ? "jp"
              : "en";
      return str(obj[key] ?? obj.cn ?? obj.zh ?? "");
    };
    const getOptDisplay = (o) => {
      if (o == null) return "";
      if (typeof o === "string") return o;
      return pickPromptLocal(o, langKey) || str(o.zh ?? o.cn ?? o.kr ?? o.en ?? "");
    };
    options.forEach((o, i) => {
      const letter = LETTERS[i] ?? String(i + 1);
      const zhOptRaw = typeof o === "string" ? o : str(o.zh || o.cn || o.kr || o.en || "");
      const zhOpt =
        pinyinHanziMap && pinyinHanziMap.size
          ? resolvePracticeTextToSpeakZh(zhOptRaw, typeof o === "object" ? o : null, pinyinHanziMap)
          : zhOptRaw;
      const uiOpt = getOptDisplay(o);
      const lineZh = zhOpt ? `选项 ${letter}：${zhOpt}` : `选项 ${letter}`;
      segs.push({ zh: lineZh, ui: uiOpt && uiOpt !== zhOptRaw ? uiOpt : "" });
    });
  }

  if (type === "order") {
    const items = q.items ?? q.options ?? [];
    for (const it of items) {
      const lineRaw = str(typeof it === "string" ? it : it?.text ?? it?.zh ?? it?.cn ?? "");
      const line =
        pinyinHanziMap && pinyinHanziMap.size
          ? resolvePracticeTextToSpeakZh(lineRaw, typeof it === "object" ? it : null, pinyinHanziMap)
          : lineRaw;
      if (line) segs.push({ zh: line, ui: "" });
    }
  }

  const expl = q.explanation;
  if (expl && typeof expl === "object") {
    const expTxt = _getControlledLangText(expl, langKey, "practice explanation");
    if (expTxt) segs.push({ ui: expTxt });
  }

  return segs;
}

/** 朗读用题池：优先已 mount 的 PracticeState，避免 loadPractice 重复 reset */
async function resolvePracticeQuestionsForSpeak(lesson) {
  const cached = PracticeState.getQuestions();
  if (Array.isArray(cached) && cached.length) return cached;
  const { filterSupportedQuestions } = await import("../modules/practice/practiceSchema.js");
  const { applyStudentStrategy } = await import("../modules/practice/practiceStrategy.js");
  const ld = lesson?._raw || lesson;
  const rawPractice = Array.isArray(ld?.practice) ? ld.practice : [];
  const filtered = filterSupportedQuestions(rawPractice);
  const raw = String(ld?.level ?? ld?.courseId ?? "");
  const m = raw.match(/(\d+)/);
  const level = m ? "hsk" + Math.min(4, Math.max(1, parseInt(m[1], 10))) : "hsk1";
  return applyStudentStrategy(filtered, level, ld?.type === "review");
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

/** 扩展阅读：月历网格（HSK3.0 数据驱动，需 lesson.extension[].layout === "calendarGrid"） */
function _hsk30CnNumeralDay(d) {
  const t = [
    "",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
    "十一",
    "十二",
    "十三",
    "十四",
    "十五",
    "十六",
    "十七",
    "十八",
    "十九",
    "二十",
    "二十一",
    "二十二",
    "二十三",
    "二十四",
    "二十五",
    "二十六",
    "二十七",
    "二十八",
    "二十九",
    "三十",
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

function buildHsk30ExtensionCalendarArticle(item, index, ctx) {
  const { speakPilot, speakLabel, pickObj, pickTrans, str, escapeHtml } = ctx;
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
      // 试点模式下扩展句默认不绑点读（由顶部 듣기 链式朗读）；日历格必须始终可点读单日（五月一日…）
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
  const speakPilot = shouldUseHsk30Hsk1SpeakPilot();
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

    if (str(item.layout) === "calendarGrid" && item.calendar && typeof item.calendar === "object") {
      return buildHsk30ExtensionCalendarArticle(item, i, {
        lang,
        speakPilot,
        speakLabel,
        pickObj,
        pickTrans,
        str,
        escapeHtml,
      });
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

/**
 * ===============================
 * Practice Display（语义策略，不按 UI 语言丢题）
 * ===============================
 * - 题干：系统语言优先 + 多语言回退
 * - 选项展示模式：resolveChoiceDisplayKindWithInfer（subtype + 形态推断）
 * - 仅做结构性可渲染校验，不因「选项不是韩语」等理由过滤题目
 */

function practiceStemDisplayText(q, langKey) {
  const stem = stemTextWithFallback(_getControlledLangText, q, langKey);
  return normalizeResponseStylePrompt(stem, q, langKey);
}

function normalizeResponseStylePrompt(stem, q, langKey) {
  const text = _trimStr(stem);
  if (!text) return "";
  const subtype = String(q?.subtype ?? q?.subType ?? "").toLowerCase();
  if (!subtype.includes("dialogue_response")) return text;

  const lk = normalizePracticeLangAliases(langKey);

  if (lk === "en") {
    let out = text.replace(
      /Someone says:?\s*["“]?(.+?)["”]?\s*You should say\?/i,
      'If someone says "$1", what would you say?'
    );
    out = out.replace(/You should say\?/gi, "what would you say?");
    return out;
  }

  if (lk === "jp") {
    return text.replace(
      /^相手が「(.+?)」と言ったら、あなたは？$/,
      "相手が「$1」と言ったら、どう答えますか？"
    );
  }

  if (lk === "kr") {
    let out = text.replace(
      /^상대가 말할 때:\s*「(.+?)」\s*답은\?$/,
      "상대가 「$1」라고 말하면, 뭐라고 대답할까요?"
    );
    out = out.replace(
      /^상대가\s*「(.+?)」라고 하면 답할 말은\?$/,
      "상대가 「$1」라고 말하면, 뭐라고 대답할까요?"
    );
    return out;
  }

  return text;
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
    if (_trimStr(v)) return v;
  }

  const g = orig.gloss;
  if (g && typeof g === "object") {
    const v = _getControlledLangText(g, langKey, "gloss");
    if (_isShortMeaning(v)) return v;
    if (_trimStr(v)) return v;
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
    const v = _getControlledLangText(t, langKey, "translation");
    if (_trimStr(v)) return v;
  }

  return "";
}

/** 将 string 选项规范为对象，便于 patch / 判题一致 */
function coerceChoiceStringOptions(q, kind) {
  const opts = Array.isArray(q.options) ? q.options : [];
  for (let i = 0; i < opts.length; i++) {
    if (typeof opts[i] !== "string") continue;
    const s = opts[i].trim();
    if (!s) continue;
    if (kind === "zh_options") {
      opts[i] = { cn: s, zh: s };
    } else if (kind === "meaning_ui") {
      opts[i] = { meaning: { kr: s, ko: s, en: s, jp: s, cn: s, zh: s } };
    } else if (kind === "sentence_translation") {
      opts[i] = { translation: { kr: s, ko: s, en: s, jp: s, cn: s, zh: s } };
    }
  }
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

    const kind = resolveChoiceDisplayKindWithInfer(q);
    coerceChoiceStringOptions(q, kind);

    const opts = Array.isArray(q.options) ? q.options : [];
    for (const o of opts) {
      patchChoiceOptionForDisplayMode(o, kind, langKey);
    }
  }
}

/** 仅过滤明显无法渲染的题目（题干全无、选择题选项不足）；不因语言形态丢弃 */
function isQuestionStructurallyRenderable(q, langKey) {
  const stem = practiceStemDisplayText(q, langKey);
  if (!stem) return false;
  const t = String(q.type || "choice").toLowerCase();
  if (t === "choice") {
    return Array.isArray(q.options) && q.options.length >= 2;
  }
  return true;
}

function _structuralDropReason(q, langKey) {
  const stem = practiceStemDisplayText(q, langKey);
  if (!stem) return "empty stem after system-lang + fallback (prompt/question)";
  const t = String(q.type || "choice").toLowerCase();
  if (t === "choice" && (!Array.isArray(q.options) || q.options.length < 2)) {
    return `choice needs options.length >= 2, got ${Array.isArray(q.options) ? q.options.length : "none"}`;
  }
  return "unknown";
}

function _abbrPracticeItemForLog(q) {
  if (!q || typeof q !== "object") return q;
  const prompt = q.prompt;
  const question = q.question;
  return {
    id: q.id,
    type: q.type,
    subtype: q.subtype,
    optionsLen: Array.isArray(q.options) ? q.options.length : null,
    optionsHead: Array.isArray(q.options)
      ? q.options.slice(0, 2).map((o) =>
          typeof o === "string" ? o.slice(0, 40) : JSON.stringify(o).slice(0, 80)
        )
      : q.options,
    prompt:
      prompt && typeof prompt === "object"
        ? Object.keys(prompt)
        : typeof prompt === "string"
        ? prompt.slice(0, 60)
        : prompt,
    question:
      question && typeof question === "object"
        ? Object.keys(question)
        : typeof question === "string"
        ? question.slice(0, 60)
        : question,
    zh_options: q.zh_options,
  };
}

/**
 * 只在 mount 时：深拷贝 + 语义展示管线（不按 UI 语言筛题池）
 */
function buildLessonWithClonedPracticeForDisplay(lesson, langKey) {
  if (!lesson || !Array.isArray(lesson.practice)) {
    console.log("[HSK-PRACTICE-STRATEGY]", {
      stage: "buildLessonWithClonedPracticeForDisplay",
      inputCount: 0,
      outputCount: 0,
      reason: "lesson.practice missing or not array",
      perQuestion: [],
    });
    return { ...lesson, practice: [] };
  }

  const raw = lesson.practice;
  const cloned = raw.map((q) => JSON.parse(JSON.stringify(q)));

  hydratePracticeDisplayBridge(cloned, langKey);

  const perQuestion = cloned.map((q) => {
    const kind = resolveChoiceDisplayKindWithInfer(q);
    const stem = practiceStemDisplayText(q, langKey);
    const opts = Array.isArray(q.options) ? q.options : [];
    let renderable = true;
    let renderIssue = "";
    try {
      renderable = opts.some((o) => {
        if (typeof o === "string") return _trimStr(o).length > 0;
        if (!o || typeof o !== "object") return false;
        return _trimStr(o.__displayText || o.cn || o.zh || o.kr || o.en || "").length > 0;
      });
    } catch (e) {
      renderIssue = e?.message || String(e);
    }
    if (String(q.type || "choice").toLowerCase() === "choice" && opts.length < 2) {
      renderable = false;
      renderIssue = "options < 2";
    }
    if (!stem) {
      renderable = false;
      renderIssue = "empty stem";
    }
    const ok = isQuestionStructurallyRenderable(q, langKey);
    return {
      id: q.id,
      type: q.type,
      subtype: q.subtype,
      displayKind: kind,
      stemLen: stem ? stem.length : 0,
      optionsCount: opts.length,
      optionsRenderable: renderable,
      renderIssue: renderIssue || undefined,
      passesStructural: ok,
      dropReason: ok ? null : _structuralDropReason(q, langKey),
    };
  });

  const final = cloned.filter((q) => isQuestionStructurallyRenderable(q, langKey));

  console.log("[HSK-PRACTICE-STRATEGY]", {
    stage: "buildLessonWithClonedPracticeForDisplay",
    inputCount: cloned.length,
    outputCount: final.length,
    langKey,
    perQuestion,
  });

  return {
    ...lesson,
    practice: final,
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
    if (!lesson || lesson.blueprintTitle == null) return;
    const no = getLessonNumber(lesson);
    const isRegularL1toL20 = String(lesson.type || "lesson") !== "review" && no >= 1 && no <= 20;
    if (isRegularL1toL20) return;
    if (lesson && lesson.blueprintTitle != null) {
      const nextDisplayTitle = resolveBlueprintTitle(lesson.blueprintTitle, l);
      lesson.displayTitle = nextDisplayTitle;
      if (no >= 1 && no <= 3) {
        try {
          console.log("[HSK-TITLE-DIAG]", {
            phase: "refreshBlueprintDisplayTitles",
            lessonNo: no,
            lang: l,
            blueprintTitle: lesson.blueprintTitle,
            title: lesson.title ?? null,
            displayTitle: lesson.displayTitle ?? null,
            displayTitleType: typeof lesson.displayTitle,
            pickedBlueprintDisplayTitle: nextDisplayTitle,
          });
        } catch {}
      }
    }
  });
}

function applyBlueprintTitles(lessons, blueprint) {
  if (!Array.isArray(lessons) || !blueprint || typeof blueprint !== "object") {
    return lessons;
  }

  return lessons.map((lesson) => {
    const no = getLessonNumber(lesson);
    const isRegularL1toL20 =
      String(lesson?.type || "lesson") !== "review" && no >= 1 && no <= 20;
    if (isRegularL1toL20) return lesson;
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
    const isRegularL1toL20 =
      String(lesson?.type || "lesson") !== "review" && no >= 1 && no <= 20;
    if (isRegularL1toL20) return lesson;
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
  state.hskLessonVocabTargetsByNo = null;

  const lang = getLang();
  const listEl = $("hskLessonList");
  if (listEl) {
    listEl.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(
      i18n.t("common_loading")
    )}</div>`;
  }

  try {
    let lessons = [];
    let lessonsDataSource = "none";

    // 1) Lesson Engine first
    if (LESSON_ENGINE && typeof LESSON_ENGINE.loadCourseIndex === "function") {
      try {
        const index = await LESSON_ENGINE.loadCourseIndex({
          courseType: state.version,
          level: `hsk${state.lv}`,
        });
        lessons = Array.isArray(index?.lessons) ? index.lessons : [];
        if (lessons.length) lessonsDataSource = "LESSON_ENGINE.loadCourseIndex";
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
      lessonsDataSource = "HSK_LOADER.loadLessons";
    }

    lessons = Array.isArray(lessons) ? lessons : [];

    const vocabDist = await getVocabDistribution(state.lv, state.version);

    // lessons.json：目录与元数据（标题、file、vocabTargets…）；列表顺序保持其顺序，不改为按 distribution 排序
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
    try {
      window.__HSK_LESSONS_DATA_SOURCE__ = lessonsDataSource;
      window.__HSK_TITLE_DIAG_LESSONS__ = state.lessons.slice(0, 3).map((x) => ({
        lessonNo: x.lessonNo,
        file: x.file || "",
        type: x.type || "lesson",
        title: x.title ?? null,
        displayTitle: x.displayTitle ?? null,
        titleJp: x?.title?.jp ?? x?.title?.ja ?? null,
        hasBlueprintTitle: x.blueprintTitle != null,
        blueprintTitle: x.blueprintTitle ?? null,
        originalTitle: x.originalTitle ?? null,
      }));
      console.log("[HSK-TITLE-DIAG]", {
        phase: "loadLessons:postRefresh",
        lang,
        engineGetLang: getEngineLang(),
        lessonsDataSource,
        note:
          lessonsDataSource === "LESSON_ENGINE.loadCourseIndex"
            ? "目录项经 courseLoader.normLessonItem 规范化（与原始 lessons.json 字段可能不完全一致）"
            : lessonsDataSource === "HSK_LOADER.loadLessons"
            ? "目录项来自 HSK_LOADER（含 lessons.json 原始字段 + loader 默认）"
            : "无目录数据",
        lessons: window.__HSK_TITLE_DIAG_LESSONS__,
      });
    } catch {}

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

async function ensureHskLessonVocabTargetsByNo() {
  if (state.hskLessonVocabTargetsByNo instanceof Map) {
    return state.hskLessonVocabTargetsByNo;
  }
  const map = new Map();
  const base = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  const root = base ? base + "/" : "/";
  const url = `${root}data/courses/${state.version}/hsk${state.lv}/lessons.json`;
  try {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) {
      state.hskLessonVocabTargetsByNo = map;
      return map;
    }
    const data = await res.json();
    const list = Array.isArray(data?.lessons) ? data.lessons : [];
    for (const it of list) {
      const no = Number(it?.lessonNo ?? it?.no ?? 0) || 0;
      if (!no) continue;
      const targets = Array.isArray(it?.vocabTargets) ? it.vocabTargets : [];
      const ordered = [];
      const seen = new Set();
      for (const t of targets) {
        const s = String(t || "").trim();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        ordered.push(s);
      }
      map.set(no, ordered);
    }
  } catch {
    /* empty map */
  }
  state.hskLessonVocabTargetsByNo = map;
  return map;
}

async function collectPriorRegularLessonHanziSet(lessonNo, _targetsByNo) {
  const set = new Set();
  const n0 = Number(lessonNo) || 0;
  if (n0 <= 1) return set;
  await ensureHSKDeps();
  if (!window.HSK_LOADER?.loadLessonDetail) return set;

  const loads = [];
  for (let n = 1; n < n0; n++) {
    const entry = state.lessons && state.lessons.find((x) => getLessonNumber(x) === n);
    const file = (entry && entry.file) || `lesson${n}.json`;
    loads.push(
      window.HSK_LOADER
        .loadLessonDetail(state.lv, n, {
          version: state.version,
          file,
        })
        .then((lesson) => ({ n, lesson }))
        .catch((err) => ({ n, err }))
    );
  }
  const results = await Promise.all(loads);
  for (const item of results) {
    if (item.err) {
      console.warn(
        "[HSK] prior lesson panel vocab load failed:",
        item.n,
        item.err?.message || item.err
      );
      continue;
    }
    const ld = item.lesson;
    if (!ld || String(ld.type || "") === "review") continue;
    const priorPanelWords = Array.isArray(ld?.vocab)
      ? ld.vocab
      : (Array.isArray(ld?.words) ? ld.words : []);
    for (const h of collectRegularLessonPanelHanziKeys(priorPanelWords)) set.add(h);
  }
  return set;
}

async function openLesson({ lessonNo, file } = {}) {
  stopAllLearningAudio();
  const no = Number(lessonNo || 1) || 1;
  const f = String(file || "");

  if (!LESSON_ENGINE || typeof LESSON_ENGINE.loadLessonDetail !== "function") {
    setError("Lesson engine not available");
    return;
  }

  let lessonData;
  let loadRes;
  try {
    loadRes = await LESSON_ENGINE.loadLessonDetail({
      courseType: state.version,
      level: `hsk${state.lv}`,
      lessonNo: no,
      file: f,
    });
    lessonData = loadRes && loadRes.lesson;
  } catch (e) {
    console.error(e);
    setError("Lesson load failed: " + (e?.message || e));
    return;
  }

  if (!lessonData) {
    setError("Lesson load failed: empty lesson");
    return;
  }

  lessonData = await mergeReviewLessonFromHskLoader(lessonData, no, f);

  try {
    const raw = loadRes && loadRes.raw;
    const rp = raw && raw.practice;
    console.log("[HSK-PRACTICE-RAW]", {
      lessonId: raw?.id ?? lessonData?.id,
      lessonNo: raw?.lessonNo ?? lessonData?.lessonNo ?? no,
      hasPracticeArray: Array.isArray(rp),
      rawPracticeLength: Array.isArray(rp) ? rp.length : 0,
      firstTwoRaw: Array.isArray(rp) ? rp.slice(0, 2).map(_abbrPracticeItemForLog) : [],
    });
    const np = lessonData.practice;
    console.log("[HSK-PRACTICE-NORMALIZED]", {
      lessonId: lessonData.id,
      lessonNo: lessonData.lessonNo,
      normalizedPracticeLength: Array.isArray(np) ? np.length : 0,
      firstTwoNormalized: Array.isArray(np) ? np.slice(0, 2).map(_abbrPracticeItemForLog) : [],
      preservedFieldsSample:
        np && np[0] && typeof np[0] === "object"
          ? {
              id: np[0].id,
              type: np[0].type,
              subtype: np[0].subtype,
              prompt: np[0].prompt,
              question: np[0].question,
              options: np[0].options,
              zh_options: np[0].zh_options,
            }
          : null,
    });
  } catch (e) {
    console.warn("[HSK-PRACTICE-RAW] / [HSK-PRACTICE-NORMALIZED] log failed:", e?.message || e);
  }

  const started =
    LESSON_ENGINE.startLesson && typeof LESSON_ENGINE.startLesson === "function"
      ? LESSON_ENGINE.startLesson({ lesson: lessonData }) || {}
      : {};

  let lessonWords = Array.isArray(started.lessonWords) ? started.lessonWords : [];
  let upstreamField = "LESSON_ENGINE.startLesson.lessonWords";
  if (!lessonWords.length) {
    upstreamField = Array.isArray(lessonData.vocab)
      ? "lessonData.vocab"
      : Array.isArray(lessonData.words)
      ? "lessonData.words"
      : "empty";
    lessonWords = Array.isArray(lessonData.vocab)
      ? lessonData.vocab
      : Array.isArray(lessonData.words)
      ? lessonData.words
      : [];
  }

  const lang = getLang();
  const listEntry =
    state.lessons && state.lessons.find((x) => getLessonNumber(x) === no);

  const isReviewLesson = lessonIsReview(lessonData);
  if (isReviewLesson && (no === 21 || no === 22) && state.tab === "review") {
    state.tab = "words";
  }
  let panelWords;
  if (isReviewLesson) {
    panelWords = selectHskWordPanelVocabulary(lessonWords, {
      lessonData,
      listEntry,
      courseLessons: state.lessons,
      lessonNo: no,
      upstreamField,
    });
  } else {
    // 普通课：显示集合完全以上游 distribution 结果为准，不做 targets/prior 二次过滤
    panelWords = deriveRegularLessonPanelWordList(lessonData, lessonWords, new Set(), {});
  }

  state.tab = "words";
  state.current = {
    lessonNo: no,
    file: f || lessonData.file || "",
    lessonData,
    lessonWords: panelWords,
  };

  const titleText =
    (listEntry && getLessonDisplayTitle(listEntry, lang)) ||
    getLessonDisplayTitle(lessonData, lang) ||
    "";

  showStudyMode(titleText);
  updateLessonContextWindow(no);

  const wordsPanel = $("hskPanelWords");
  if (wordsPanel) {
    if (isReviewLesson) {
      renderReviewWords(wordsPanel, panelWords, {
        lang,
        scope: `hsk${state.lv}`,
      });
    } else {
      renderWordCards(wordsPanel, panelWords, null, {
        lang,
        scope: `hsk${state.lv}`,
        layout: shouldUseCompactLearnVocabLayout() ? "compact-learn" : "cards",
      });
    }
  }

  const courseId = getCourseId();
  const lessonId = lessonData.id || `${courseId}_lesson${no}`;
  touchLessonVocabSafe(courseId, lessonId, panelWords);

  const dialogueEl = $("hskDialogueBody");
  if (dialogueEl) {
    if (isReviewLesson) {
      renderReviewDialogue(dialogueEl, lessonData, { lang });
    } else {
      dialogueEl.innerHTML = buildDialogueHTML(lessonData);
    }
  }

  const grammarEl = $("hskGrammarBody");
  if (grammarEl) {
    if (isReviewLesson) {
      const g = lessonData.grammar;
      const gArr = Array.isArray(g) ? g : Array.isArray(g?.points) ? g.points : [];
      renderReviewGrammar(grammarEl, gArr, { lang, vocab: panelWords });
    } else {
      grammarEl.innerHTML = buildGrammarHTML(lessonData);
    }
  }

  const extensionEl = $("hskExtensionBody");
  if (extensionEl) {
    if (isReviewLesson) {
      const ext = lessonData.extension;
      renderReviewExtension(extensionEl, Array.isArray(ext) ? ext : [], { lang });
    } else {
      extensionEl.innerHTML = buildExtensionHTML(lessonData);
    }
  }

  const reviewEl = $("hskReviewBody");
  if (reviewEl) {
    const reviewData = buildLessonReviewData(lessonData, {
      lang: getLang(),
      lessonWords: panelWords,
      lessonLevel: lessonData.level,
      lessonVersion: lessonData.version,
      glossaryScope: `hsk${state.lv}`,
    });
    reviewEl.innerHTML = renderLessonReviewHTML(reviewData);
  }

  const practiceEl = $("hskPracticeBody");
  if (practiceEl) {
    mountPractice(practiceEl, { lesson: lessonData, lang });
  }

  mountAIPanelSafe(lessonData, lang);
  renderLessonCover(lessonData);
  renderLessonSceneSection(lessonData, lang);
  markLessonStartedSafe(lessonData, no);
  updateTabsUI();
  updateProgressBlock();
}

/**
 * 语言切换等场景：按 state.current 重绘 HSK 学习区（不重新 fetch）。
 * 挂到 window 供 runHSKSanityCheck 校验；缺失时 joy:langChanged 会抛 ReferenceError 并中断后续 UI 更新。
 */
function rerenderHSKFromState() {
  const lang = getLang();
  const listEl = $("hskLessonList");

  if (!state.current || !state.current.lessonData) {
    if (listEl && Array.isArray(state.lessons) && state.lessons.length) {
      const total = state.lessons.length;
      const stats =
        (PROGRESS_SELECTORS &&
        typeof PROGRESS_SELECTORS.getCourseStats === "function"
          ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total)
          : null) || {};
      renderLessonList(listEl, state.lessons, {
        lang,
        currentLessonNo: stats.lastLessonNo || 0,
      });
    }
    return;
  }

  const { lessonData, lessonWords, lessonNo } = state.current;
  const no = Number(lessonNo || 1) || 1;
  const listEntry =
    state.lessons && state.lessons.find((x) => getLessonNumber(x) === no);
  const isReviewLesson = lessonIsReview(lessonData);
  if (isReviewLesson && (no === 21 || no === 22) && state.tab === "review") {
    state.tab = "words";
  }
  const titleText =
    (listEntry && getLessonDisplayTitle(listEntry, lang)) ||
    getLessonDisplayTitle(lessonData, lang) ||
    "";

  showStudyMode(titleText);
  updateLessonContextWindow(no);

  const wordsPanel = $("hskPanelWords");
  if (wordsPanel) {
    if (isReviewLesson) {
      renderReviewWords(wordsPanel, lessonWords, {
        lang,
        scope: `hsk${state.lv}`,
      });
    } else {
      renderWordCards(wordsPanel, lessonWords, null, {
        lang,
        scope: `hsk${state.lv}`,
        layout: shouldUseCompactLearnVocabLayout() ? "compact-learn" : "cards",
      });
    }
  }

  const dialogueEl = $("hskDialogueBody");
  if (dialogueEl) {
    if (isReviewLesson) {
      renderReviewDialogue(dialogueEl, lessonData, { lang });
    } else {
      dialogueEl.innerHTML = buildDialogueHTML(lessonData);
    }
  }

  const grammarEl = $("hskGrammarBody");
  if (grammarEl) {
    if (isReviewLesson) {
      const g = lessonData.grammar;
      const gArr = Array.isArray(g) ? g : Array.isArray(g?.points) ? g.points : [];
      renderReviewGrammar(grammarEl, gArr, { lang, vocab: lessonWords });
    } else {
      grammarEl.innerHTML = buildGrammarHTML(lessonData);
    }
  }

  const extensionEl = $("hskExtensionBody");
  if (extensionEl) {
    if (isReviewLesson) {
      const ext = lessonData.extension;
      renderReviewExtension(extensionEl, Array.isArray(ext) ? ext : [], { lang });
    } else {
      extensionEl.innerHTML = buildExtensionHTML(lessonData);
    }
  }

  const reviewEl = $("hskReviewBody");
  if (reviewEl) {
    const reviewData = buildLessonReviewData(lessonData, {
      lang: getLang(),
      lessonWords,
      lessonLevel: lessonData.level,
      lessonVersion: lessonData.version,
      glossaryScope: `hsk${state.lv}`,
    });
    reviewEl.innerHTML = renderLessonReviewHTML(reviewData);
  }

  const practiceEl = $("hskPracticeBody");
  if (practiceEl) {
    mountPractice(practiceEl, { lesson: lessonData, lang });
  }

  mountAIPanelSafe(lessonData, lang);
  renderLessonCover(lessonData);
  renderLessonSceneSection(lessonData, lang);
  updateTabsUI();
  updateProgressBlock();
}

if (typeof window !== "undefined") {
  window.rerenderHSKFromState = rerenderHSKFromState;
}

/**
 * ===============================
 * Final Event / Mount Layer
 * ===============================
 */

function bindEvents() {
  const controller = new AbortController();
  const { signal } = controller;

  // ===== Level change =====
  el = $("hskLevel");
  if (el) {
    el.addEventListener(
      "change",
      async function (e) {
        state.lv = Number(e.target.value || 1);
        showListMode();
        await loadLessons();
        updateProgressBlock();
      },
      { signal }
    );
  }

  // ===== Version change =====
  el = $("hskVersion");
  if (el) {
    el.addEventListener(
      "change",
      async function (e) {
        const ver =
          (window.HSK_LOADER &&
            typeof window.HSK_LOADER.normalizeVersion === "function"
            ? window.HSK_LOADER.normalizeVersion(e.target.value)
            : null) ||
          (e.target.value === "hsk3.0" ? "hsk3.0" : "hsk2.0");

        state.version = ver;

        try {
          if (
            window.HSK_LOADER &&
            typeof window.HSK_LOADER.setVersion === "function"
          ) {
            window.HSK_LOADER.setVersion(ver);
          }
        } catch {}

        await loadLessons();
        updateProgressBlock();

        if (state.current && state.current.lessonData) {
          const { lessonNo, file } = state.current;
          await openLesson({ lessonNo, file });
        } else {
          showListMode();
        }
      },
      { signal }
    );
  }

  // ===== Back to list =====
  el = $("hskBackToList");
  if (el) {
    el.addEventListener(
      "click",
      function () {
        showListMode();
        const wrap = $("hskLessonListWrap");
        if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      { signal }
    );
  }

  // ===== Review mode =====
  function enterReviewMode(mode, lessonId = "", levelKey = "") {
    stopAllLearningAudio();
    const container = $("hskReviewContainer");
    if (!container || !renderReviewMode) return;

    const { session, questions } = prepareReviewSession({
      mode,
      lessonId,
      levelKey,
    });

    if (!questions.length) {
      container.innerHTML = `<div class="review-empty-state p-4"><p>${escapeHtml(
        i18n.t("review_no_wrong_questions")
      )}</p></div>`;
      container.classList.remove("hidden");
      return;
    }

    container.classList.remove("hidden");

    renderReviewMode(container, session, {
      lang: getLang(),
      onFinish: ({ action }) => {
        if (action === "back") {
          container.classList.add("hidden");
          container.innerHTML = "";
        } else if (action === "continue") {
          const next = prepareReviewSession({ mode, lessonId, levelKey });
          if (!next.questions.length) {
            container.innerHTML = `<div class="review-empty-state p-4"><p>${escapeHtml(
              i18n.t("review_no_wrong_questions")
            )}</p></div>`;
            return;
          }
          renderReviewMode(container, next.session, {
            lang: getLang(),
            onFinish: ({ action: nextAction }) => {
              if (nextAction === "back") {
                container.classList.add("hidden");
                container.innerHTML = "";
              }
            },
          });
        }
      },
    });

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  el = $("hskReviewLesson");
  if (el) {
    el.addEventListener(
      "click",
      function () {
        const lessonId =
          (state.current &&
            state.current.lessonData &&
            state.current.lessonData.id) ||
          (state.current
            ? getCourseId() + "_lesson" + state.current.lessonNo
            : "");

        if (!lessonId) {
          const stats =
            (PROGRESS_SELECTORS &&
            typeof PROGRESS_SELECTORS.getCourseStats === "function"
              ? PROGRESS_SELECTORS.getCourseStats(
                  getCourseId(),
                  (state.lessons && state.lessons.length) || 0
                )
              : null) || {};
          const lastNo = stats.lastLessonNo || 1;
          enterReviewMode("lesson", `${getCourseId()}_lesson${lastNo}`);
        } else {
          enterReviewMode("lesson", lessonId);
        }
      },
      { signal }
    );
  }

  el = $("hskReviewLevel");
  if (el) {
    el.addEventListener(
      "click",
      function () {
        enterReviewMode("level", "", getCourseId());
      },
      { signal }
    );
  }

  el = $("hskReviewAll");
  if (el) {
    el.addEventListener(
      "click",
      function () {
        enterReviewMode("all");
      },
      { signal }
    );
  }

  // ===== Lesson click =====
  el = $("hskLessonList");
  if (el) {
    el.addEventListener(
      "click",
      function (e) {
        const btn = e.target.closest('button[data-open-lesson="1"]');
        if (!btn) return;

        const lessonNo = Number(btn.dataset.lessonNo || 1);
        const file = btn.dataset.file || "";

        openLesson({ lessonNo, file });
      },
      { signal }
    );
  }

  // ===== 朗读：HSK3.0 HSK1 工具栏 + 会话/扩展等点读 =====
  document.addEventListener(
    "click",
    async (e) => {
      const wbtn = e.target.closest("#hskSpeakAllWordsBtn");
      if (wbtn) {
        if (!shouldUseCompactLearnVocabLayout()) return;
        e.preventDefault();
        e.stopPropagation();
        const words = state.current && state.current.lessonWords;
        if (!Array.isArray(words) || !words.length) return;
        const anchor = document.getElementById("hskWordBulkSpeakAnchor");
        const { buildWordBulkTimeline, openBulkSpeakPlayer } = await import("../modules/hsk/hskBulkSpeakPlayer.js");
        const tl = buildWordBulkTimeline(words, { lang: getLang(), scope: `hsk${state.lv}` });
        await openBulkSpeakPlayer("words", tl, anchor || wbtn.parentElement);
        return;
      }

      const wloop = e.target.closest("#hskSpeakAllWordsLoopBtn");
      if (wloop) {
        if (!shouldUseCompactLearnVocabLayout()) return;
        e.preventDefault();
        e.stopPropagation();
        const {
          getBulkTtsPlayer,
          openBulkSpeakPlayer,
          closeBulkSpeakPlayer,
          buildWordBulkTimeline,
        } = await import("../modules/hsk/hskBulkSpeakPlayer.js");
        const p = getBulkTtsPlayer();
        if (p.bulkLoop && p.loopKind === "words") {
          closeBulkSpeakPlayer();
          return;
        }
        const words = state.current && state.current.lessonWords;
        if (!Array.isArray(words) || !words.length) return;
        const anchor = document.getElementById("hskWordBulkSpeakAnchor");
        const tl = buildWordBulkTimeline(words, { lang: getLang(), scope: `hsk${state.lv}` });
        await openBulkSpeakPlayer("words", tl, anchor || wloop.parentElement, { loop: true });
        return;
      }

      const fbtn = e.target.closest("#hskDialogueSpeakFullBtn");
      if (fbtn) {
        if (!shouldUseHsk30Hsk1SpeakPilot()) return;
        e.preventDefault();
        e.stopPropagation();
        const ld = state.current && state.current.lessonData;
        if (!ld) return;
        const anchor =
          document.getElementById("hskDialogueBulkSpeakAnchor") || fbtn.parentElement;
        const { buildDialogueBulkTimeline, openBulkSpeakPlayer } = await import("../modules/hsk/hskBulkSpeakPlayer.js");
        const tl = buildDialogueBulkTimeline(ld, {
          getDialogueCards,
          pickDialogueTranslation,
          dialogueSessionIntroTts,
        });
        await openBulkSpeakPlayer("dialogue", tl, anchor);
        return;
      }

      const floop = e.target.closest("#hskDialogueSpeakFullLoopBtn");
      if (floop) {
        if (!shouldUseHsk30Hsk1SpeakPilot()) return;
        e.preventDefault();
        e.stopPropagation();
        const {
          getBulkTtsPlayer,
          openBulkSpeakPlayer,
          closeBulkSpeakPlayer,
          buildDialogueBulkTimeline,
        } = await import("../modules/hsk/hskBulkSpeakPlayer.js");
        const p = getBulkTtsPlayer();
        if (p.bulkLoop && p.loopKind === "dialogue") {
          closeBulkSpeakPlayer();
          return;
        }
        const ld = state.current && state.current.lessonData;
        if (!ld) return;
        const anchor =
          document.getElementById("hskDialogueBulkSpeakAnchor") || floop.parentElement;
        const tl = buildDialogueBulkTimeline(ld, {
          getDialogueCards,
          pickDialogueTranslation,
          dialogueSessionIntroTts,
        });
        await openBulkSpeakPlayer("dialogue", tl, anchor, { loop: true });
        return;
      }

      const dlineLoop = e.target.closest(".hsk-dialogue-line-loopbtn");
      if (dlineLoop && shouldUseHsk30Hsk1SpeakPilot()) {
        const zh = (dlineLoop.dataset.speakText || "").trim();
        const tr = (dlineLoop.dataset.speakTranslation || "").trim();
        if (!zh || !tr) return;
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const lineEl = dlineLoop.closest(".lesson-dialogue-line");
        const { toggleDialogueLineSpeakLoop } = await import("../modules/hsk/hskRenderer.js");
        await toggleDialogueLineSpeakLoop(zh, tr, lineEl || null);
        return;
      }

      const gListen = e.target.closest(".hsk30-card-listen[data-hsk30-grammar-idx]");
      if (gListen && shouldUseHsk30Hsk1SpeakPilot()) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        const gi = Number(gListen.dataset.hsk30GrammarIdx);
        if (!Number.isFinite(gi)) return;
        const raw = state.current?.lessonData?._raw || state.current?.lessonData;
        const pts = getGrammarPointsArray(raw);
        const pt = pts[gi];
        if (!pt) return;
        const cardEl = gListen.closest(".lesson-grammar-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../modules/hsk/hskRenderer.js");
        const segs = buildGrammarSpeakSegments(pt, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, { lessonForPinyinMap: lessonCtx });
        return;
      }

      const extFlat = e.target.closest(".hsk30-ext-listen[data-hsk30-ext-flat-idx]");
      if (extFlat && shouldUseHsk30Hsk1SpeakPilot()) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        const fi = Number(extFlat.dataset.hsk30ExtFlatIdx);
        if (!Number.isFinite(fi)) return;
        const raw = state.current?.lessonData?._raw || state.current?.lessonData;
        const arr = getExtensionItemsArray(raw);
        const item = arr[fi];
        if (!item) return;
        const cardEl = extFlat.closest(".lesson-extension-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../modules/hsk/hskRenderer.js");
        const segs = buildExtensionFlatSpeakSegments(item, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, { lessonForPinyinMap: lessonCtx });
        return;
      }

      const extGroup = e.target.closest(".hsk30-ext-listen[data-hsk30-ext-group-idx]");
      if (extGroup && shouldUseHsk30Hsk1SpeakPilot()) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        const gi = Number(extGroup.dataset.hsk30ExtGroupIdx);
        if (!Number.isFinite(gi)) return;
        const raw = state.current?.lessonData?._raw || state.current?.lessonData;
        const arr = getExtensionItemsArray(raw);
        const item = arr[gi];
        if (!item) return;
        const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];
        const isGroup = sentences.length > 0 && (item.groupTitle || item.focusGrammar);
        if (!isGroup) return;
        const cardEl = extGroup.closest(".lesson-extension-group-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../modules/hsk/hskRenderer.js");
        const segs = buildExtensionGroupSpeakSegments(item, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, { lessonForPinyinMap: lessonCtx });
        return;
      }

      const prListen = e.target.closest(".hsk30-practice-listen[data-hsk30-practice-id]");
      if (prListen && shouldUseHsk30Hsk1SpeakPilot()) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        const qid = String(prListen.dataset.hsk30PracticeId || "").trim();
        if (!qid) return;
        const ld = state.current?.lessonData;
        if (!ld) return;
        const questions = await resolvePracticeQuestionsForSpeak(ld);
        const q = questions.find((x) => String(x?.id || "") === qid);
        if (!q) return;
        const langKey = practiceLangKeyFromUiLang(getLang());
        const cardEl = prListen.closest(".lesson-practice-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../modules/hsk/hskRenderer.js");
        const segs = buildPracticeSpeakSegmentsUnified(q, langKey, ld);
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, { lessonForPinyinMap: ld });
        return;
      }

      const dzPilot = e.target.closest(".lesson-dialogue-zh[data-speak-kind='dialogue']");
      if (
        dzPilot &&
        shouldUseHsk30Hsk1SpeakPilot() &&
        dzPilot.dataset.speakTranslation != null &&
        String(dzPilot.dataset.speakTranslation || "").trim() !== ""
      ) {
        const zh = (dzPilot.dataset.speakText || "").trim();
        const tr = (dzPilot.dataset.speakTranslation || "").trim();
        if (
          !zh ||
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const lineEl = dzPilot.closest(".lesson-dialogue-line");
        const { speakZhThenUiTranslationPilot } = await import("../modules/hsk/hskRenderer.js");
        await speakZhThenUiTranslationPilot(zh, tr, lineEl || null);
        return;
      }

      const target = e.target.closest(
        "[data-speak-text][data-speak-kind='dialogue'], [data-speak-text][data-speak-kind='extension'], [data-speak-text][data-speak-kind='grammar'], [data-speak-text][data-speak-kind='practice']"
      );
      if (!target) return;

      const text = (target.dataset && target.dataset.speakText || "").trim();
      if (
        !text ||
        !(
          AUDIO_ENGINE &&
          typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
          AUDIO_ENGINE.isSpeechSupported()
        )
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      stopAllLearningAudio();

      const lineEl =
        target.closest(".lesson-dialogue-line") ||
        target.closest(".lesson-extension-card") ||
        target.closest(".lesson-extension-group-card") ||
        target.closest(".lesson-grammar-card") ||
        target.closest(".review-grammar-row") ||
        target.closest(".lesson-practice-card") ||
        target.closest(".review-question-card") ||
        target.closest(".lesson-practice-option") ||
        target.closest(".lesson-review-item") ||
        target.closest(".lesson-review-summary-word-item") ||
        target.closest(".hsk-lr-speak-row");

      if (lineEl) lineEl.classList.add("is-speaking");

      AUDIO_ENGINE.playText(text, {
        lang: "zh-CN",
        onEnd: function () {
          if (lineEl) lineEl.classList.remove("is-speaking");
        },
        onError: function () {
          if (lineEl) lineEl.classList.remove("is-speaking");
        },
      });
    },
    { signal }
  );

  // ===== Tabs =====
  el = $("hskStudyTabs");
  if (el) {
    el.addEventListener(
      "click",
      function (e) {
        const btn = e.target.closest("button[data-tab]");
        if (!btn) return;

        state.tab = btn.dataset.tab;
        stopAllLearningAudio();
        updateTabsUI();

        if (state.tab === "practice") {
          const ld = state.current && state.current.lessonData;
          const lessonId = ld ? ld.id || "" : "";
          const lessonNo = state.current ? state.current.lessonNo : 0;
          console.log("[HSK-PRACTICE-TAB-ENTERED]", {
            lessonId,
            lessonNo,
            ts: "2026-03-27-debug",
          });
        }

        const step = state.tab === "ai" ? "aiPractice" : state.tab;

        if (state.current && state.current.lessonData) {
          const courseId = getCourseId();
          const lessonId =
            state.current.lessonData.id ||
            courseId + "_lesson" + state.current.lessonNo;

          if (
            PROGRESS_ENGINE &&
            typeof PROGRESS_ENGINE.markStepCompleted === "function"
          ) {
            PROGRESS_ENGINE.markStepCompleted({
              courseId,
              lessonId,
              step,
            });
          }

          updateProgressBlock();
        }

        // ⭐ 关键：切到 practice tab 时只 rerender，不重建
        if (state.tab === "practice") {
          const practiceEl = $("hskPracticeBody");
          if (practiceEl) {
            try {
              rerenderPractice(practiceEl, getLang());
            } catch (err) {
              console.warn("[HSK] practice tab rerender failed:", err);
            }
          }
        }
      },
      { signal }
    );
  }

  // ===== Search =====
  el = $("hskSearch");
  if (el) {
    el.addEventListener(
      "input",
      function () {
        const q = String(($("hskSearch") && $("hskSearch").value) || "")
          .trim()
          .toLowerCase();

        const lang = getLang();
        const listEl = $("hskLessonList");
        if (!listEl) return;

        const filtered = !q
          ? state.lessons
          : state.lessons.filter((it) => {
              const title = JSON.stringify(
                (it && it.title) || (it && it.name) || ""
              ).toLowerCase();
              const pinyin = String(
                (it && it.pinyinTitle) || (it && it.pinyin) || ""
              ).toLowerCase();
              const file = String((it && it.file) || "").toLowerCase();
              return title.includes(q) || pinyin.includes(q) || file.includes(q);
            });

        const total = (state.lessons && state.lessons.length) || 0;
        const stats =
          (PROGRESS_SELECTORS &&
          typeof PROGRESS_SELECTORS.getCourseStats === "function"
            ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total)
            : null) || {};

        renderLessonList(listEl, filtered, {
          lang,
          currentLessonNo: stats.lastLessonNo || 0,
        });
      },
      { signal }
    );
  }

  // ===== Language changed =====
  window.addEventListener(
    "joy:langChanged",
    (e) => {
      const newLang = (e && e.detail && e.detail.lang) || getLang();

      if (!isHSKPageActive()) return;

      refreshBlueprintDisplayTitles(state.lessons, newLang);

      if (
        state.current &&
        state.current.lessonData &&
        state.current.lessonData.blueprintTitle != null
      ) {
        state.current.lessonData.displayTitle = resolveBlueprintTitle(
          state.current.lessonData.blueprintTitle,
          newLang
        );
      }

      try {
        i18n.apply(document);
      } catch {}

      setSubTitle();
      rerenderHSKFromState();

      // ⭐ 关键：单独刷新 practice 显示层，不重建池
      const practiceEl = $("hskPracticeBody");
      if (practiceEl) {
        try {
          rerenderPractice(practiceEl, newLang);
        } catch (err) {
          console.warn("[HSK] practice rerender after lang change failed:", err);
        }
      }
    },
    { signal }
  );

  // ===== i18n bus =====
  try {
    if (i18n && typeof i18n.on === "function") {
      i18n.on("change", function () {
        window.dispatchEvent(
          new CustomEvent("joy:langChanged", {
            detail: { lang: i18n?.getLang?.() },
          })
        );
      });
    }
  } catch {}
}

export async function mount() {
  const navRoot = $("siteNav");
  const app = $("app");

  if (!navRoot || !app) {
    console.error("HSK Page Error: missing #siteNav or #app");
    return false;
  }

  await ensureHSKDeps();

  const scope = `hsk${state.lv}`;
  loadGlossary("kr", scope).catch(() => {});
  loadGlossary("en", scope).catch(() => {});
  loadGlossary("jp", scope).catch(() => {});

  navRoot.dataset.mode = "mini";
  mountNavBar(navRoot);

  app.innerHTML = getHSKLayoutHTML();

  const savedVer = localStorage.getItem("hsk_vocab_version") || state.version;
  state.version =
    (window.HSK_LOADER &&
      typeof window.HSK_LOADER.normalizeVersion === "function"
      ? window.HSK_LOADER.normalizeVersion(savedVer)
      : null) ||
    (savedVer === "hsk3.0" ? "hsk3.0" : "hsk2.0");

  if ($("hskLevel")) $("hskLevel").value = String(state.lv);
  if ($("hskVersion")) $("hskVersion").value = String(state.version);

  try {
    i18n.apply(document);
  } catch {}

  bindWordCardActions();
  bindEvents();

  await loadLessons();
  showListMode();

  return true;
}

/**
 * ===============================
 * Final Helpers / Exports
 * ===============================
 * Keep this tail simple.
 * No extra fallback logic here.
 */

function updateTabsLabels() {
  const tabs = [
    ["hskTabWords", "hsk.tab.words"],
    ["hskTabDialogue", "hsk.tab.dialogue"],
    ["hskTabGrammar", "hsk.tab.grammar"],
    ["hskTabExtension", "hsk.tab.extension"],
    ["hskTabPractice", "hsk.tab.practice"],
    ["hskTabAI", "hsk.tab.ai"],
    ["hskTabReview", "hsk.tab.review"],
  ];

  tabs.forEach(([id, key]) => {
    const btn = $(id);
    if (!btn) return;
    const span = btn.querySelector("span") || btn;
    span.textContent = i18n.t(key);
  });

  const reviewLabels = [
    ["hskReviewEntry", "span", "hsk.review_mode"],
    ["hskReviewLesson", null, "hsk.review_this_lesson"],
    ["hskReviewLevel", null, "hsk.review_this_level"],
    ["hskReviewAll", null, "hsk.review_all_wrong"],
  ];

  reviewLabels.forEach(([id, child, key]) => {
    const node = $(id);
    if (!node) return;
    const target = child ? node.querySelector(child) : node;
    if (target) target.textContent = i18n.t(key);
  });
}

function updateProgressBlock() {
  const block = $("hskProgressBlock");
  if (!block) return;

  const courseId = getCourseId();
  const total = (state.lessons && state.lessons.length) || 0;

  const stats =
    (PROGRESS_SELECTORS &&
      typeof PROGRESS_SELECTORS.getCourseStats === "function"
      ? PROGRESS_SELECTORS.getCourseStats(courseId, total)
      : null) || {};

  const {
    completedLessonCount = 0,
    dueReviewCount = 0,
    lastLessonNo = 0,
    lastActivityAt = 0,
  } = stats;

  const lessonUnit = i18n.t("hsk.meta.lesson_unit");
  const wordUnit = i18n.t("hsk.meta.word_unit");

  const chips = [];

  chips.push(
    total > 0
      ? `${i18n.t("hsk.meta.completed")} ${completedLessonCount} / ${total} ${lessonUnit}`
      : "—"
  );

  if (lastLessonNo > 0) {
    chips.push(`${i18n.t("hsk.meta.current_lesson")} ${lastLessonNo} ${lessonUnit}`);
  }

  if (dueReviewCount > 0) {
    chips.push(`${i18n.t("hsk.meta.review_words")} ${dueReviewCount} ${wordUnit}`);
  }

  if (lastActivityAt > 0) {
    const d = new Date(lastActivityAt);
    const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    chips.push(`${i18n.t("hsk.meta.last_study")} ${dateStr}`);
  }

  block.innerHTML = chips
    .map((text) => `<span class="hsk-meta-chip">${escapeHtml(text)}</span>`)
    .join("");
}

function setError(msg = "") {
  const err = $("hskError");
  if (!err) return;

  if (!msg) {
    err.classList.add("hidden");
    err.textContent = "";
    return;
  }

  err.classList.remove("hidden");
  err.textContent = msg;
}

function setSubTitle() {
  const sub = $("hskSubTitle");
  if (!sub) return;
  sub.textContent = `HSK ${state.lv} · ${state.version}`;
}

function showStudyMode(titleText = "") {
  const listWrap = $("hskLessonListWrap");
  const studyBar = $("hskStudyBar");
  const studyPanels = $("hskStudyPanels");
  const titleEl = $("hskStudyTitle");

  if (listWrap) listWrap.classList.add("hidden");
  if (studyBar) studyBar.classList.remove("hidden");
  if (studyPanels) studyPanels.classList.remove("hidden");
  if (titleEl) titleEl.textContent = titleText || "";
}

function showListMode() {
  stopAllLearningAudio();
  const studyBar = $("hskStudyBar");
  const studyPanels = $("hskStudyPanels");
  const listWrap = $("hskLessonListWrap");

  if (studyBar) studyBar.classList.add("hidden");
  if (studyPanels) studyPanels.classList.add("hidden");
  if (listWrap) listWrap.classList.remove("hidden");

  const ids = [
    "hskPanelWords",
    "hskDialogueBody",
    "hskGrammarBody",
    "hskExtensionBody",
    "hskPracticeBody",
    "hskAIResult",
    "hskReviewBody",
  ];

  ids.forEach((id) => {
    const node = $(id);
    if (node) node.innerHTML = "";
  });

  const sceneSection = $("hskSceneSection");
  if (sceneSection) {
    sceneSection.innerHTML = "";
    sceneSection.classList.add("hidden");
  }

  state.current = null;
  state.tab = "words";
  updateTabsUI();
}

function updateTabsUI() {
  const hideReviewTab = (() => {
    const cur = state.current;
    if (!cur) return false;
    const lessonNo = Number(cur.lessonNo) || 0;
    return lessonNo === 21 || lessonNo === 22;
  })();

  const ids = [
    ["words", "hskTabWords", "hskPanelWords"],
    ["dialogue", "hskTabDialogue", "hskPanelDialogue"],
    ["grammar", "hskTabGrammar", "hskPanelGrammar"],
    ["extension", "hskTabExtension", "hskPanelExtension"],
    ["practice", "hskTabPractice", "hskPanelPractice"],
    ["ai", "hskTabAI", "hskPanelAI"],
    ["review", "hskTabReview", "hskPanelReview"],
  ];

  ids.forEach(([tab, btnId, panelId]) => {
    const btn = $(btnId);
    const panel = $(panelId);

    if (tab === "review" && hideReviewTab) {
      if (btn) {
        btn.classList.add("hidden");
        btn.setAttribute("aria-hidden", "true");
      }
      if (panel) panel.classList.add("hidden");
      return;
    }

    if (tab === "review" && btn) {
      btn.classList.remove("hidden");
      btn.removeAttribute("aria-hidden");
    }

    const active = state.tab === tab;

    if (btn) {
      btn.classList.toggle("active", active);
      btn.style.background = active ? "rgba(34,197,94,0.10)" : "";
      btn.style.borderColor = active ? "rgba(34,197,94,0.55)" : "";
    }

    if (panel) {
      panel.classList.toggle("hidden", !active);
    }
  });
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
function renderDialogueLine(line, lang, showPinyin, speakPilot = false) {
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
  const transTrim = trans ? String(trans).trim() : "";
  let zhAttrs = zh
    ? ` data-speak-text="${escapeHtml(zh).replaceAll('"', "&quot;")}" data-speak-kind="dialogue"`
    : "";
  if (zh && speakPilot && transTrim) {
    zhAttrs += ` data-speak-translation="${escapeHtml(transTrim).replaceAll('"', "&quot;")}"`;
  }

  const zAttrQ = escapeHtml(zh).replaceAll('"', "&quot;");
  const trAttrQ = escapeHtml(transTrim).replaceAll('"', "&quot;");
  const lineLoopBtn =
    zh && speakPilot && transTrim
      ? `<button type="button" class="hsk-dialogue-line-loopbtn" data-speak-text="${zAttrQ}" data-speak-translation="${trAttrQ}" aria-label="반복" title="반복">🔁</button>`
      : "";

  return `<article class="lesson-dialogue-line">
  ${spk ? `<div class="lesson-dialogue-speaker">${escapeHtml(spk)}</div>` : ""}
  <div class="hsk-dialogue-zh-row">${zh ? `<div class="lesson-dialogue-zh"${zhAttrs}>${escapeHtml(zh)}</div>${lineLoopBtn}` : ""}</div>
  ${py ? `<div class="lesson-dialogue-pinyin">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="lesson-dialogue-translation">${escapeHtml(trans)}</div>` : ""}
</article>`;
}

/**
 * 预留 lines[].align：left / right / center；缺省则按行号左右交替（与既有试点一致）
 */
function resolveSceneCanvasBubbleSide(line, lineIndex0) {
  const a = String((line && line.align) || "").trim().toLowerCase();
  if (a === "left" || a === "right" || a === "center") return a;
  return lineIndex0 % 2 === 0 ? "left" : "right";
}

/** 预留 lines[].position.{x,y}：仅输出 data 属性，当前样式不解读坐标（避免布局突变） */
function sceneCanvasLinePositionDataAttrs(line) {
  const pos = line && line.position;
  if (!pos || typeof pos !== "object") return "";
  const x = pos.x;
  const y = pos.y;
  const esc = (v) => escapeHtml(String(v)).replaceAll('"', "&quot;");
  const parts = [];
  if (x != null && String(x).trim() !== "") parts.push(`data-pos-x="${esc(x)}"`);
  if (y != null && String(y).trim() !== "") parts.push(`data-pos-y="${esc(y)}"`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** 预留 dialogueCards[].sceneImage / bubbleStyle；仅 data-*，不渲染 img、不接生图 */
function sceneCanvasCardReservedDataAttrs(card, lines) {
  const parts = [];
  const img = card && card.sceneImage;
  if (img != null && String(img).trim() !== "") {
    parts.push(`data-scene-image="${escapeHtml(String(img).trim()).replaceAll('"', "&quot;")}"`);
  }
  const bstyle = card && card.bubbleStyle;
  if (bstyle != null && String(bstyle).trim() !== "") {
    parts.push(`data-bubble-style="${escapeHtml(String(bstyle).trim()).replaceAll('"', "&quot;")}"`);
  }
  const hasFreePos =
    Array.isArray(lines) &&
    lines.some((ln) => {
      const p = ln && ln.position;
      return p && typeof p === "object" && (p.x != null || p.y != null);
    });
  if (hasFreePos) parts.push(`data-layout="free"`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** 场景画布模式：左右交错气泡（保留 lesson-dialogue-line 以兼容点读高亮） */
function renderDialogueLineSceneCanvasBubble(line, showPinyin, lineIndex0, speakPilot = false) {
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
  if (py) py = normalizePinyinDisplayAllLowercase(py);

  const trans = pickDialogueTranslation(line, zh);
  const transTrim = trans ? String(trans).trim() : "";
  let zhAttrs = zh
    ? ` data-speak-text="${escapeHtml(zh).replaceAll('"', "&quot;")}" data-speak-kind="dialogue"`
    : "";
  if (zh && speakPilot && transTrim) {
    zhAttrs += ` data-speak-translation="${escapeHtml(transTrim).replaceAll('"', "&quot;")}"`;
  }

  const zAttrQSc = zh ? escapeHtml(zh).replaceAll('"', "&quot;") : "";
  const trAttrQSc = transTrim ? escapeHtml(transTrim).replaceAll('"', "&quot;") : "";
  const sceneLineLoopBtn =
    zh && speakPilot && transTrim
      ? `<button type="button" class="hsk-dialogue-line-loopbtn" data-speak-text="${zAttrQSc}" data-speak-translation="${trAttrQSc}" aria-label="반복" title="반복">🔁</button>`
      : "";

  const side = resolveSceneCanvasBubbleSide(line, lineIndex0);
  const sideClass =
    side === "right"
      ? "hsk1-scene-bubble-line--right"
      : side === "center"
        ? "hsk1-scene-bubble-line--center"
        : "hsk1-scene-bubble-line--left";

  const posAttrs = sceneCanvasLinePositionDataAttrs(line);

  return `<article class="lesson-dialogue-line hsk1-scene-bubble-line ${sideClass}"${posAttrs}>
  <div class="hsk1-scene-bubble">
  ${spk ? `<div class="hsk1-scene-bubble-speaker">${escapeHtml(spk)}</div>` : ""}
  <div class="hsk1-scene-bubble-zh-row">${zh ? `<div class="lesson-dialogue-zh hsk1-scene-bubble-zh"${zhAttrs}>${escapeHtml(zh)}</div>${sceneLineLoopBtn}` : ""}</div>
  ${py ? `<div class="lesson-dialogue-pinyin hsk1-scene-bubble-pinyin">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="lesson-dialogue-translation hsk1-scene-bubble-trans">${escapeHtml(trans)}</div>` : ""}
  </div>
</article>`;
}

function buildHsk30Hsk1SceneCanvasDialogueHTML(raw, cards, lang, showPinyin, speakPilot) {
  const fullSpeakLabel = escapeHtml(i18n.t("hsk.dialogue_speak_full"));
  const fullSpeakBtn = speakPilot
    ? `<button type="button" class="hsk-dialogue-speak-full-btn" id="hskDialogueSpeakFullBtn" aria-label="${fullSpeakLabel}" title="${fullSpeakLabel}">${fullSpeakLabel}</button>`
    : "";
  const fullSpeakLoopBtn = speakPilot
    ? `<button type="button" class="hsk-dialogue-speak-loop-btn" id="hskDialogueSpeakFullLoopBtn" aria-label="🔁 전체 회화 반복" title="🔁 전체 회화 반복">🔁 전체 회화 반복</button>`
    : "";

  const lessonStripInner = buildHsk30Hsk1SceneCanvasLessonStrip(raw, lang);

  const heroHead =
    speakPilot && !lessonStripInner
      ? `<div class="hsk-dialogue-hero-head hsk-dialogue-hero-head--with-speak" id="hskDialogueBulkSpeakAnchor">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>
  ${fullSpeakBtn}${fullSpeakLoopBtn}
</div>`
      : `<h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>`;

  const heroCanvas = `<section class="lesson-section-hero lesson-dialogue-hero hsk1-dialogue-hero--scene-canvas">
  ${heroHead}
</section>`;

  const lessonStripWrap =
    lessonStripInner && speakPilot
      ? `<div class="hsk1-dialogue-lesson-strip-wrap hsk1-dialogue-topic-row" id="hskDialogueBulkSpeakAnchor">${lessonStripInner}${fullSpeakBtn}${fullSpeakLoopBtn}</div>`
      : lessonStripInner
        ? `<div class="hsk1-dialogue-lesson-strip-wrap">${lessonStripInner}</div>`
        : "";

  const blocks = cards
    .map((card, index) => {
      const lines = Array.isArray(card && card.lines) ? card.lines : [];
      if (!lines.length) return "";
      const sessionNo = index + 1;
      const noLabel = String(sessionNo).padStart(2, "0");
      const aria = dialogueSessionAriaLabel(sessionNo);
      const headingPrimary = pickCardHeadingPrimary(card && card.title, sessionNo);
      const summaryText = pickCardSummary(card && card.summary);
      const cardReservedAttrs = sceneCanvasCardReservedDataAttrs(card, lines);
      const lineHtml = lines
        .map((line, li) => renderDialogueLineSceneCanvasBubble(line, showPinyin, li, speakPilot))
        .join("");

      return `<section class="lesson-dialogue-card hsk1-dialogue-scene-card"${cardReservedAttrs}>
  <header class="hsk1-dialogue-scene-card-head">
    <div class="hsk1-dialogue-scene-card-head-row">
      <span class="hsk1-dialogue-scene-card-no" aria-label="${escapeHtml(aria).replaceAll('"', "&quot;")}">${escapeHtml(noLabel)}</span>
      <h4 class="hsk1-dialogue-scene-card-heading">${escapeHtml(headingPrimary)}</h4>
    </div>
    ${summaryText ? `<p class="hsk1-dialogue-scene-card-summary">${escapeHtml(summaryText)}</p>` : ""}
  </header>
  <div class="hsk1-dialogue-canvas">
    <div class="hsk1-dialogue-bubbles">${lineHtml}</div>
  </div>
</section>`;
    })
    .filter(Boolean)
    .join("\n");

  return `${heroCanvas}${lessonStripWrap}<div class="lesson-dialogue-list hsk1-dialogue-scene-list">${blocks}</div>`;
}

/** 对话渲染 */
function buildDialogueHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const cards = getDialogueCards(raw);
  const lang = getLang();
  const speakPilot = shouldUseHsk30Hsk1SpeakPilot();

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

  if (shouldUseHsk30Hsk1SceneCanvasDialogue(lessonData)) {
    return buildHsk30Hsk1SceneCanvasDialogueHTML(raw, cards, lang, showPinyin, speakPilot);
  }

  return `${hero}<div class="lesson-dialogue-list">
${cards
  .map((card, index) => {
    const lines = Array.isArray(card && card.lines) ? card.lines : [];
    if (!lines.length) return "";
    const titleText = pickCardTitle(card && card.title, index + 1);
    const lineHtml = lines.map((line) => renderDialogueLine(line, lang, showPinyin, speakPilot)).join("");
    return `<section class="lesson-dialogue-card">
    <h4 class="lesson-dialogue-card-title">${escapeHtml(titleText)}</h4>
    <div class="lesson-dialogue-lines">${lineHtml}</div>
  </section>`;
  })
  .filter(Boolean)
  .join("\n")}
</div>`;
}

/** 语法渲染 */
function buildGrammarHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const g = raw && raw.grammar;
  const lang = getLang();
  const speakPilot = shouldUseHsk30Hsk1SpeakPilot();
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
      const examples = getGrammarExamples(pt);
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

/** AI context */
function buildAIContext() {
  if (!state.current || !state.current.lessonData) return "";

  const lang = getLang();
  const ld = state.current.lessonData;
  const no = state.current.lessonNo;

  const found =
    state.lessons && state.lessons.find((x) => getLessonNumber(x) === no);
  const title =
    (found && getLessonDisplayTitle(found, lang)) ||
    getLessonDisplayTitle(ld, lang) ||
    "";

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
    stopAllLearningAudio();
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
  stopAllLearningAudio();
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


