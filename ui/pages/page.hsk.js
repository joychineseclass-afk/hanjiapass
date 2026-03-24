// /ui/pages/page.hsk.js ✅ FINAL (Study Tabs)
// ✅ Clean HSK page: no mountGlobalComponents()
// ✅ Directory <-> Study mode
// ✅ Study Tabs: words/dialogue/grammar/ai

import { i18n } from "../i18n.js";
import { pick, getContentText, getLang as getEngineLang, getLessonDisplayTitle } from "../core/languageEngine.js";
import { mountNavBar } from "../components/navBar.js";
import { ensureHSKDeps } from "../modules/hsk/hskDeps.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";
import { renderLessonList, renderWordCards, renderReviewWords, renderReviewDialogue, renderReviewGrammar, renderReviewExtension, bindWordCardActions, wordKey, wordPinyin, wordMeaning, normalizeLang } from "../modules/hsk/hskRenderer.js";
import { loadBlueprint } from "../modules/curriculum/blueprintLoader.js";
import { distributeVocabulary, distributeVocabularyByMap, auditVocabularyCoverage } from "../modules/curriculum/vocabDistributor.js";
import { resolvePinyin, maybeGetManualPinyin, shouldShowPinyin } from "../utils/pinyinEngine.js";
import { loadGlossary } from "../utils/glossary.js";
import { LESSON_ENGINE, AI_CAPABILITY, IMAGE_ENGINE, SCENE_ENGINE, PROGRESS_ENGINE, PROGRESS_SELECTORS, AUDIO_ENGINE, renderReviewMode, prepareReviewSession } from "../platform/index.js";
import * as PracticeState from "../modules/practice/practiceState.js";
import { mountPractice as mountPracticeFromEngine, rerenderPractice as rerenderPracticeFromEngine } from "../modules/practice/practiceRenderer.js";
import { addWrongItems, addRecentItem } from "../modules/review/reviewEngine.js";
import * as SceneRenderer from "../platform/scene/sceneRenderer.js";

const state = {
  lv: 1,
  version: "hsk2.0",
  lessons: [],
  current: null,        // { lessonNo, file, lessonData, lessonWords }
  tab: "words",         // words | dialogue | grammar | extension | practice | ai
  searchKeyword: "",
  reviewMode: null,
};

var el;

/** 当前 hskState，供 rerender 使用 */
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
  const hash = (typeof location !== "undefined" && location.hash || "").toLowerCase();
  const path = (typeof location !== "undefined" && location.pathname || "").toLowerCase();
  return hash.includes("hsk") || path.includes("hsk");
}

function getLang() {
  return normalizeLang(getEngineLang());
}

/** 与 modules/practice/practiceRenderer 一致，供练习题干/选项显示规则使用 */
function practiceLangKeyFromUiLang(lang) {
  const l = String(lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return "cn";
  if (l === "en") return "en";
  if (l === "jp" || l === "ja") return "jp";
  return "kr";
}

const _HANZI_IN_STEM = /[\u4e00-\u9fff]/;

function _trimStr(v) {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Safety guard: Never return empty string, always fallback with logging */
function _safeGetTextWithFallback(text, context = "text") {
  if (text && typeof text === "string" && text.trim()) {
    return text.trim();
  }
  
  // Log warning for debugging
  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Safety] Empty ${context}, using fallback`);
  }
  
  return "[Missing Data]";
}

/** Strict short-text filter: reject long definitions, dictionary-style text, and explanations */
function _isShortMeaning(text) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  
  // Length check: reject if too long
  if (trimmed.length > 40) return false;
  
  // Dictionary/explanation patterns to reject
  const badPatterns = [
    /；/, // Chinese semicolon
    /;/, // English semicolon  
    /\([^)]*\([^)]*\)/, // Nested parentheses (dictionary style)
    /\d+\./, // Numbered definitions (1. 2. 3.)
    /：/, // Chinese colon
    /例[如句]/, // Examples
    /同义词/,
    /反义词/,
    /词性/,
    /用法/,
    /例如/,
  ];
  
  // Reject if any bad pattern found
  for (const pattern of badPatterns) {
    if (pattern.test(trimmed)) return false;
  }
  
  // Reject if has multiple commas (likely list/explanation)
  const commaCount = (trimmed.match(/,/g) || []).length;
  if (commaCount > 2) return false;
  
  return true;
}

/** Strict pinyin cleaner: allow only valid pinyin characters, remove English and explanations */
function _cleanPinyin(text) {
  if (!text || typeof text !== "string") return "";
  
  // Remove English words and explanations (2+ consecutive Latin letters)
  let cleaned = text.replace(/[a-zA-Z]{2,}/g, "");
  
  // Allow only: Latin letters, tone marks, spaces, apostrophes, hyphens, basic punctuation
  cleaned = cleaned.replace(/[^a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǪ\s'-]/g, "");
  
  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // Remove leading/trailing punctuation
  cleaned = cleaned.replace(/^[^\wāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǪ]+|[^\wāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǪ]+$/g, "");
  
  return cleaned;
}

/** 受控fallback语言获取：UI语言 → English → Chinese → Missing */
function _getControlledLangText(obj, langKey, context = "text") {
  if (!obj || typeof obj !== "object") {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[HSK Language] Missing object for ${context} (${langKey})`);
    }
    return _safeGetTextWithFallback("", `${context} object`);
  }
  
  // 主要语言映射
  const primaryKeys = langKey === "cn" || langKey === "zh" ? ["cn", "zh"]
    : langKey === "kr" || langKey === "ko" ? ["kr", "ko"] 
    : langKey === "jp" || langKey === "ja" ? ["jp", "ja"]
    : ["en"];
  
  // 受控fallback链：UI语言 → English → Chinese
  const fallbackChain = [
    ...primaryKeys,
    "en",  // English作为第一fallback
    "cn", "zh"  // Chinese作为最后fallback
  ];
  
  const availableKeys = Object.keys(obj).filter(k => obj[k] && typeof obj[k] === "string" && obj[k].trim());
  
  for (const key of fallbackChain) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      // 如果使用了fallback，记录日志
      if (!primaryKeys.includes(key)) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(`[HSK Language] Fallback triggered: ${langKey} → ${key} for ${context}, available: [${availableKeys.join(",")}]`);
        }
      }
      return value.trim();
    }
  }
  
  // 最后fallback：返回空而不是"[Missing Data]"
  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Language] No text available for ${context} (${langKey}), tried: [${fallbackChain.join(",")}]`);
  }
  
  return "";
}

/** 验证文本是否真正属于目标语言 */
function isTextValidForLang(text, langKey) {
  if (!text || typeof text !== 'string') return false;

  switch (langKey) {
    case 'jp':
    case 'ja':
      return /[ぁ-んァ-ン一-龯]/.test(text);

    case 'kr':
    case 'ko':
      return /[가-힣]/.test(text);

    case 'en':
      return /^[A-Za-z0-9 ,.'"?-]+$/.test(text);

    case 'zh':
    case 'cn':
      return /[\u4e00-\u9fff]/.test(text);

    default:
      return false;
  }
}

/** 清理污染字段：只删除解释类字段，保留meaning/translation等有效字段 */
function _stripPollutedFields(obj) {
  if (!obj || typeof obj !== "object") return;
  
  // 只删除真正的污染字段（解释、用法、示例等）
  const pollutedFields = [
    // 解释类
    'explain', 'explanation', 'explainKr', 'explainEn', 'explainJp', 'explainCn',
    'explanation_kr', 'explanation_en', 'explanation_jp', 'explanation_cn',
    // 语法/扩展类
    'grammar', 'grammarExplain', 'extension', 'extensionExplain',
    // 用法/示例类
    'usage', 'example', 'examples', 'notes', 'note',
    // 其他说明类
    'definition', 'definitions', 'desc', 'description'
  ];
  
  pollutedFields.forEach(field => {
    if (obj.hasOwnProperty(field)) {
      delete obj[field];
    }
  });
}

/** 与 practiceChoice.pickPrompt 键位一致；各语种缺省时按链回填，避免日语等界面题干空白 */
function _practicePickPrompt(obj, langKey) {
  if (!obj || typeof obj !== "object") return _safeGetTextWithFallback("", "prompt object");
  const primary =
    langKey === "cn" || langKey === "zh"
      ? ["cn", "zh"]
      : langKey === "kr" || langKey === "ko"
        ? ["kr", "ko"]
        : langKey === "jp" || langKey === "ja"
          ? ["jp", "ja"]
          : ["en"];
  const fallbacks = ["cn", "zh", "kr", "ko", "en", "jp", "ja"];
  const tryKeys = [...new Set([...primary, ...fallbacks])];
  for (const k of tryKeys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return _safeGetTextWithFallback("", "prompt all languages");
}

/** 将生成器里的多语言 question 合并进 prompt，避免 normalize 只保留短 prompt 导致丢 KR/EN/JP 模板句 */
function mergePracticePromptForDisplay(q) {
  const p = q.prompt;
  const qu = q.question;
  if (typeof p === "string" || typeof qu === "string") {
    const ps = _trimStr(typeof p === "string" ? p : "");
    const qs = _trimStr(typeof qu === "string" ? qu : "");
    const base = ps || qs;
    if (!base) return typeof p === "object" && p && !Array.isArray(p) ? { ...p } : typeof qu === "object" && qu && !Array.isArray(qu) ? { ...qu } : {};
    return { cn: base, zh: base, kr: base, ko: base, en: base, jp: base, ja: base };
  }
  const pObj = p && typeof p === "object" && !Array.isArray(p) ? { ...p } : {};
  const qObj = qu && typeof qu === "object" && !Array.isArray(qu) ? qu : null;
  if (!qObj) return Object.keys(pObj).length ? pObj : {};
  const keys = ["cn", "zh", "kr", "ko", "en", "jp", "ja"];
  for (const k of keys) {
    const qv = _trimStr(qObj[k]);
    if (!qv) continue;
    const hasP =
      _trimStr(pObj[k]) ||
      (k === "kr" ? _trimStr(pObj.ko) : "") ||
      (k === "cn" ? _trimStr(pObj.zh) : "") ||
      (k === "jp" ? _trimStr(pObj.ja) : "");
    if (!hasP) {
      if (k === "ko") pObj.ko = qv;
      else if (k === "zh") pObj.zh = qv;
      else if (k === "ja") pObj.ja = qv;
      else pObj[k] = qv;
    }
  }
  return pObj;
}

/** 仅填空槽位：jp 缺用 en→kr→cn；kr 缺用 en→cn；en 缺用 kr→cn */
function backfillPracticePromptEmptyLocales(promptObj) {
  if (!promptObj || typeof promptObj !== "object") return;
  if (!_trimStr(promptObj.jp) && !_trimStr(promptObj.ja)) {
    const fb =
      _trimStr(promptObj.en) ||
      _trimStr(promptObj.kr) ||
      _trimStr(promptObj.ko) ||
      _trimStr(promptObj.cn) ||
      _trimStr(promptObj.zh);
    if (fb) {
      promptObj.jp = fb;
      promptObj.ja = fb;
    }
  }
  if (!_trimStr(promptObj.kr) && !_trimStr(promptObj.ko)) {
    const fb =
      _trimStr(promptObj.en) ||
      _trimStr(promptObj.cn) ||
      _trimStr(promptObj.zh) ||
      _trimStr(promptObj.jp) ||
      _trimStr(promptObj.ja);
    if (fb) {
      promptObj.kr = fb;
      promptObj.ko = fb;
    }
  }
  if (!_trimStr(promptObj.en)) {
    const fb =
      _trimStr(promptObj.kr) ||
      _trimStr(promptObj.ko) ||
      _trimStr(promptObj.cn) ||
      _trimStr(promptObj.zh) ||
      _trimStr(promptObj.jp) ||
      _trimStr(promptObj.ja);
    if (fb) promptObj.en = fb;
  }
  if (!_trimStr(promptObj.cn) && !_trimStr(promptObj.zh)) {
    const fb =
      _trimStr(promptObj.en) ||
      _trimStr(promptObj.kr) ||
      _trimStr(promptObj.ko) ||
      _trimStr(promptObj.jp) ||
      _trimStr(promptObj.ja);
    if (fb) {
      promptObj.cn = fb;
      promptObj.zh = fb;
    }
  }
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
    return z && _HANZI_IN_STEM.test(z) && (_trimStr(o.kr) || _trimStr(o.ko) || _trimStr(o.en) || _trimStr(o.jp) || _trimStr(o.ja));
  });
}

/**
 * 选择题展示模式（与判题 key 无关，只影响选项/题干克隆上的展示字段）
 * zh_options：选项只显示中文
 * meaning_ui：汉字→释义类，选项只显示当前界面语短释义，不用 explain
 * sentence_translation：整句/对话理解，选项只显示当前界面语句译，不用词汇义/语法说明
 * mixed_keep：不改写选项（如手写课中中韩英混排题干+中文串选项）
 */
function practiceChoiceDisplayKind(q) {
  const st = String(q.subtype ?? q.subType ?? "").toLowerCase();
  const listen = !!(q.audioUrl ?? q.listen ?? q.hasListen);
  if (listen) return "zh_options";

  if (st.includes("pinyin_to_vocab")) return "zh_options";
  if (st.includes("meaning_to_vocab") || st.includes("native_to_zh")) return "zh_options";

  if (st.includes("vocab_meaning_choice") || st.includes("extension_meaning_choice")) return "meaning_ui";

  if (
    st.includes("dialogue_meaning_choice") ||
    st.includes("grammar_example_meaning") ||
    st.includes("sentence_meaning") ||
    st.includes("sentence_translation") ||
    st.includes("choose_translation")
  ) {
    return "sentence_translation";
  }

  if (st.includes("zh_to_meaning")) {
    const opts = q.options;
    if (!Array.isArray(opts) || !opts.length) return "infer";
    const first = opts[0];
    if (typeof first === "string") return "zh_options";
    if (_optionsLookLikeLetterKeyedMeanings(opts)) return "meaning_ui";
    return "zh_options";
  }

  if (st.includes("extension") && st.includes("meaning")) return "meaning_ui";

  if (st.includes("dialogue_response") || st.includes("dialogue_detail")) return "zh_options";
  if (st.includes("grammar_fill") || st.includes("grammar_pattern")) return "zh_options";
  if (st.includes("sentence_blank") || st.includes("sentence_completion")) return "zh_options";
  if (st.includes("sentence_order")) return "zh_options";

  return "infer";
}

function practiceChoiceDisplayKindResolved(q, langKey) {
  let kind = practiceChoiceDisplayKind(q);
  if (kind !== "infer") return kind;
  const opts = q.options;
  const stem = practiceStemDisplayText(q, langKey);
  const stemHz = _HANZI_IN_STEM.test(stem);
  const allStrings = Array.isArray(opts) && opts.length && opts.every((x) => typeof x === "string");
  if (allStrings) {
    const anyHz = opts.some((s) => _HANZI_IN_STEM.test(String(s)));
    return anyHz ? "zh_options" : "mixed_keep";
  }
  // Fixed logic: If stem HAS Chinese → show system language, if NO Chinese → show Chinese
  if (!stemHz) {
    // Stem has NO Chinese → show options in Chinese
    return "zh_options";
  }
  // Stem HAS Chinese → show options in system language (meaning_ui for meanings, sentence_translation for translations)
  return _optionsLookLikeLetterKeyedMeanings(opts) ? "meaning_ui" : "sentence_translation";
}

function _pickFromLangObject(obj, langKey) {
  if (!obj || typeof obj !== "object") return _safeGetTextWithFallback("", "language object");
  const order =
    langKey === "jp"
      ? ["jp", "ja", "en", "kr", "ko", "cn", "zh"]
      : langKey === "kr"
        ? ["kr", "ko", "en", "jp", "ja", "cn", "zh"]
        : langKey === "en"
          ? ["en", "kr", "ko", "jp", "ja", "cn", "zh"]
          : ["cn", "zh", "kr", "ko", "en", "jp", "ja"];
  for (const k of order) {
    const v = _trimStr(obj[k]);
    if (v) return v;
  }
  return _safeGetTextWithFallback("", "all language fields");
}

/** 受控fallback句子翻译获取：UI语言 → English → Chinese + 语言验证 */
function pickSentenceTranslationForOption(orig, langKey) {
  if (!orig || typeof orig !== "object") {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[HSK Language] Invalid option object for translation (${langKey})`);
    }
    return "";
  }
  
  // 清理污染字段（保留translation）
  const cleanedOrig = { ...orig };
  _stripPollutedFields(cleanedOrig);
  
  // 1. 优先使用 translation[lang] 对象
  const transObj = cleanedOrig.translation ?? cleanedOrig.translations ?? cleanedOrig.trans;
  if (transObj && typeof transObj === "object") {
    const trans = _getControlledLangText(transObj, langKey, "translation object");
    if (trans && isTextValidForLang(trans, langKey)) {
      return trans;
    }
  }
  
  // 2. 尝试平铺的翻译字段
  const flatTrans = _getControlledLangText(cleanedOrig, langKey, "flat translation");
  if (flatTrans && isTextValidForLang(flatTrans, langKey)) {
    return flatTrans;
  }
  
  // 最后fallback：返回空而不是"[Missing Data]"
  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Language] No valid translation for ${langKey}, available: ${Object.keys(cleanedOrig).join(",")}`);
  }
  
  return "";
}

/** 受控fallback选项词义获取：UI语言 → English → Chinese + 语言验证 */
function pickShortMeaningForOption(orig, langKey) {
  if (!orig || typeof orig !== "object") {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[HSK Language] Invalid option object for meaning (${langKey})`);
    }
    return "";
  }
  
  // 清理污染字段（保留meaning/gloss）
  const cleanedOrig = { ...orig };
  _stripPollutedFields(cleanedOrig);
  
  // 1. 优先使用 meaning[lang] 对象
  const meaningObj = cleanedOrig.meaning;
  if (meaningObj && typeof meaningObj === "object") {
    const meaning = _getControlledLangText(meaningObj, langKey, "meaning object");
    if (meaning && _isShortMeaning(meaning) && isTextValidForLang(meaning, langKey)) {
      return meaning;
    }
  }
  
  // 2. 尝试 gloss[lang] 对象
  const glossObj = cleanedOrig.gloss;
  if (glossObj && typeof glossObj === "object") {
    const gloss = _getControlledLangText(glossObj, langKey, "gloss object");
    if (gloss && _isShortMeaning(gloss) && isTextValidForLang(gloss, langKey)) {
      return gloss;
    }
  }
  
  // 3. 尝试平铺的语言字段
  const flatText = _getControlledLangText(cleanedOrig, langKey, "option flat text");
  if (flatText && _isShortMeaning(flatText) && isTextValidForLang(flatText, langKey)) {
    return flatText;
  }
  
  // 4. 宽松模式：尝试任何可用的短文本，但必须通过语言验证
  for (const key of ["kr", "ko", "en", "jp", "ja", "cn", "zh"]) {
    const value = cleanedOrig[key];
    if (value && _isShortMeaning(value) && isTextValidForLang(value, langKey)) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[HSK Language] Using fallback meaning: ${langKey} → ${key} for option`);
      }
      return value.trim();
    }
  }
  
  // 最后fallback：返回空而不是"[Missing Data]"
  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Language] No valid short meaning for ${langKey}, available: ${Object.keys(cleanedOrig).join(",")}`);
  }
  
  return "";
}

function _stripOptionExplainFields(o) {
  if (!o || typeof o !== "object") return;
  // Remove all explanation/polluted sources
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
  delete o.grammar;
  delete o.grammarExplain;
  delete o.extension;
  delete o.extensionExplain;
  delete o.usage;
  delete o.example;
  delete o.examples;
  delete o.notes;
  delete o.note;
}

function _applyDisplayOnlyText(o, langKey, text) {
  if (!o || typeof o !== "object") return;
  
  // First strip all polluted/explanation fields
  _stripOptionExplainFields(o);
  
  // Then clear all language/meaning fields to prevent contamination
  ["kr", "ko", "en", "jp", "ja", "cn", "zh", "pinyin", "py", "meaning", "gloss", "translation", "translations", "trans"].forEach((k) => {
    delete o[k];
  });
  
  // Strip again to ensure no polluted fields remain
  _stripOptionExplainFields(o);
  
  if (!text) return;
  
  // Set only the clean, filtered text in the target language
  if (langKey === "kr") {
    o.kr = text;
    o.ko = text;
  } else if (langKey === "en") o.en = text;
  else if (langKey === "jp") {
    o.jp = text;
    o.ja = text;
  } else {
    o.cn = text;
    o.zh = text;
  }
}

function patchChoiceOptionForDisplayMode(o, kind, langKey) {
  if (!o || typeof o !== "object") return;
  _ensureChoiceOptionOrig(o);
  _restoreChoiceOptionFields(o);
  _stripOptionExplainFields(o);

  if (kind === "mixed_keep") return;

  if (kind === "zh_options") {
    ["kr", "ko", "en", "jp", "ja"].forEach((k) => {
      delete o[k];
    });
    return;
  }

  const orig = o.__hskChoiceOptOrig;
  if (kind === "meaning_ui") {
    const text = pickShortMeaningForOption(orig, langKey);
    _applyDisplayOnlyText(o, langKey, text);
    return;
  }
  if (kind === "sentence_translation") {
    const text = pickSentenceTranslationForOption(orig, langKey);
    _applyDisplayOnlyText(o, langKey, text);
  }
}

/** 受控fallback题干显示：UI语言 → English → Chinese */
function practiceStemDisplayText(q, langKey) {
  if (!q || typeof q !== "object") {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[HSK Language] Invalid question object for stem (${langKey})`);
    }
    return "";
  }
  
  // 优先使用 prompt 对象
  const prompt = q.prompt ?? q.question ?? {};
  if (prompt && typeof prompt === "object") {
    // 清理污染字段（保留meaning/translation）
    const cleanedPrompt = { ...prompt };
    _stripPollutedFields(cleanedPrompt);
    
    // 受控fallback获取文本
    const text = _getControlledLangText(cleanedPrompt, langKey, "prompt");
    if (text) {
      return text;
    }
  }
  
  // 回退到字符串格式的 question
  if (typeof q.question === "string") {
    const questionText = String(q.question).trim();
    if (questionText) {
      return questionText;
    }
  }
  
  // 最后尝试从题目对象直接获取
  const directText = _getControlledLangText(q, langKey, "question direct");
  if (directText) {
    return directText;
  }
  
  // 禁止返回空字符串，至少返回一个占位符
  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Language] No stem text available for ${langKey}, question keys: ${Object.keys(q).join(",")}`);
  }
  
  return "?";  // 返回占位符而不是空
}

function _ensureChoiceOptionOrig(o) {
  if (!o || typeof o !== "object") return;
  if (o.__hskChoiceOptOrig) return;
  const { __hskChoiceOptOrig: _drop, ...rest } = o;
  o.__hskChoiceOptOrig = { ...rest };
}

function _restoreChoiceOptionFields(o) {
  if (!o || typeof o !== "object") return;
  const snap = o.__hskChoiceOptOrig;
  if (!snap || typeof snap !== "object") return;
  Object.keys(o).forEach((k) => {
    if (k === "__hskChoiceOptOrig") return;
    delete o[k];
  });
  Object.assign(o, snap);
  o.__hskChoiceOptOrig = snap;
}

/**
 * 选择题选项显示层：按 subtype / 推断模式选用字段，不修改 key，不影响判题。
 * 仅作用于克隆后的 practice 或 PracticeState 内题目对象。
 */
function applyChoiceDisplayToQuestionList(questions, langKey) {
  if (!Array.isArray(questions)) return;
  for (const q of questions) {
    if (String(q.type || "choice").toLowerCase() !== "choice") continue;
    if (q.prompt && typeof q.prompt === "object") backfillPracticePromptEmptyLocales(q.prompt);
    const kind = practiceChoiceDisplayKindResolved(q, langKey);
    const opts = Array.isArray(q.options) ? q.options : [];
    for (const o of opts) {
      if (!o || typeof o !== "object") continue;
      patchChoiceOptionForDisplayMode(o, kind, langKey);
    }
  }
}

/** 检查题目是否有当前UI语言的有效文本（升级版：语言验证） */
function _isQuestionValidForLanguage(q, langKey) {
  if (!q || typeof q !== "object") return false;
  
  // 获取题干文本
  const prompt = q.prompt ?? q.question ?? {};
  let stemText = "";
  
  if (prompt && typeof prompt === "object") {
    stemText = _getControlledLangText(prompt, langKey, "prompt");
  }
  
  // 如果prompt没有，检查字符串question
  if (!stemText && typeof q.question === "string") {
    stemText = q.question.trim();
  }
  
  // 验证题干文本是否真正属于目标语言
  if (!stemText || !isTextValidForLang(stemText, langKey)) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn('[LANG INVALID] Stem text for', langKey, ':', stemText);
    }
    return false;
  }
  
  // 检查选项语言可用性（如果是选择题）
  if (q.type === "choice" && Array.isArray(q.options)) {
    const validOptions = q.options.filter(o => {
      if (!o || typeof o !== "object") return false;
      
      // 获取选项文本
      const optionText = _getControlledLangText(o, langKey, "option");
      
      // 验证选项文本是否真正属于目标语言
      if (!optionText || !isTextValidForLang(optionText, langKey)) {
        return false;
      }
      
      return true;
    });
    
    // 至少要有2个有效选项
    if (validOptions.length < 2) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[HSK Language] Question has insufficient valid options for ${langKey}: ${validOptions.length}/${q.options.length}`);
      }
      return false;
    }
  }
  
  return true;
}

/** 统一练习数据处理入口：语言安全过滤 + 受控fallback */
function buildLessonWithClonedPracticeForDisplay(lesson, langKey) {
  if (!lesson || typeof lesson !== "object") {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[HSK Language] Invalid lesson object for ${langKey}`);
    }
    return lesson;
  }
  
  const raw = Array.isArray(lesson.practice) ? lesson.practice : [];
  if (!raw.length) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[HSK Language] No practice questions in lesson for ${langKey}`);
    }
    return { ...lesson, practice: [] };
  }
  
  // 第一步：语言安全过滤 - 只保留有当前UI语言有效文本的题目
  let languageSafeQuestions = raw.filter((q, index) => {
    const isValid = _isQuestionValidForLanguage(q, langKey);
    if (!isValid) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[HSK Language] Skipping question ${index} - no valid text for ${langKey}`);
      }
    }
    return isValid;
  });
  
  if (typeof console !== "undefined" && console.debug) {
    console.debug(`[HSK Language] Language-safe filtering: ${languageSafeQuestions.length}/${raw.length} questions valid for ${langKey}`);
  }
  
  // 安全fallback：如果过滤后题目太少，允许受控fallback
  if (languageSafeQuestions.length < 3) {  // 至少需要3道题
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[HSK Language] Too few valid questions for ${langKey}, applying controlled fallback`);
    }
    
    // 尝试English fallback
    const fallbackQuestions = raw.filter((q, index) => {
      const isValid = _isQuestionValidForLanguage(q, "en");
      if (isValid) {
        // 验证English文本确实有效
        const prompt = q.prompt ?? q.question ?? {};
        let stemText = "";
        if (prompt && typeof prompt === "object") {
          stemText = _getControlledLangText(prompt, "en", "prompt");
        }
        if (!stemText && typeof q.question === "string") {
          stemText = q.question.trim();
        }
        if (stemText && isTextValidForLang(stemText, "en")) {
          return true;
        }
      }
      return false;
    });
    
    // 对fallback题目也应用语言验证（防止混合语言泄露）
    const safeFallback = fallbackQuestions.filter(q =>
      _isQuestionValidForLanguage(q, langKey)
    );
    
    // 只填补缺少的空位，不批量合并
    let finalQuestions = [...languageSafeQuestions];
    if (finalQuestions.length < 3) {
      const needed = 3 - finalQuestions.length;
      finalQuestions = [
        ...finalQuestions,
        ...safeFallback.slice(0, needed)
      ];
    }
    
    // 最终安全过滤：确保所有题目都通过语言验证
    finalQuestions = finalQuestions.filter(q =>
      _isQuestionValidForLanguage(q, langKey)
    );
    
    if (typeof console !== "undefined" && console.debug) {
      console.debug('[LANG FILTER MAIN]', languageSafeQuestions.length);
      console.debug('[LANG FILTER FALLBACK]', safeFallback?.length || 0);
      console.debug('[LANG FILTER FINAL]', finalQuestions.length);
    }
  } else {
    // 如果不需要fallback，直接使用主过滤结果
    var finalQuestions = languageSafeQuestions;
    
    if (typeof console !== "undefined" && console.debug) {
      console.debug('[LANG FILTER MAIN]', languageSafeQuestions.length);
      console.debug('[LANG FILTER FALLBACK]', 0);
      console.debug('[LANG FILTER FINAL]', finalQuestions.length);
    }
  }
  
  // 第二步：统一处理和清理（使用最终验证的题目）
  const clonedPractice = finalQuestions.map((q, index) => {
    try {
      // 深度克隆题目
      const next = JSON.parse(JSON.stringify(q));
      
      // 统一清理污染字段（保留meaning/translation）
      _stripPollutedFields(next);
      
      // 清理拼音字段（只使用pinyin，不参与fallback）
      if (next.pinyin) next.pinyin = _cleanPinyin(next.pinyin);
      if (next.py) next.py = _cleanPinyin(next.py);
      
      // 统一处理选择题选项
      if (Array.isArray(next.options)) {
        next.options = next.options.map((o, optIndex) => {
          if (!o || typeof o !== "object") {
            if (typeof console !== "undefined" && console.warn) {
              console.warn(`[HSK Language] Invalid option ${optIndex} in question ${index} for ${langKey}`);
            }
            return o;
          }
          
          // 清理选项中的污染字段
          const cleanedOption = { ...o };
          _stripPollutedFields(cleanedOption);
          
          // 清理选项中的拼音（独立处理）
          if (cleanedOption.pinyin) cleanedOption.pinyin = _cleanPinyin(cleanedOption.pinyin);
          if (cleanedOption.py) cleanedOption.py = _cleanPinyin(cleanedOption.py);
          
          return cleanedOption;
        });
      }
      
      // 统一处理题干
      if (next.prompt && typeof next.prompt === "object") {
        _stripPollutedFields(next.prompt);
      }
      
      return next;
      
    } catch (error) {
      if (typeof console !== "undefined" && console.error) {
        console.error(`[HSK Language] Error processing question ${index} for ${langKey}:`, error);
      }
      return q; // 返回原题作为fallback
    }
  });
  
  // 应用选项显示规则（使用受控fallback）
  applyChoiceDisplayToQuestionList(clonedPractice, langKey);
  
  if (typeof console !== "undefined" && console.debug) {
    console.debug(`[HSK Language] Final processing: ${clonedPractice.length} questions for ${langKey}`);
  }
  
  return { ...lesson, practice: clonedPractice };
}

function restoreHskChoiceOptionDisplayPatch() {
  const qs = PracticeState.getQuestions();
  if (!Array.isArray(qs)) return;
  for (const q of qs) {
    const opts = Array.isArray(q.options) ? q.options : [];
    for (const o of opts) _restoreChoiceOptionFields(o);
  }
}

function mountPractice(container, opts) {
  if (!container) return;
  const langKey = practiceLangKeyFromUiLang(opts && opts.lang);
  const lesson = opts && opts.lesson;
  const lessonForPractice = lesson ? buildLessonWithClonedPracticeForDisplay(lesson, langKey) : lesson;
  mountPracticeFromEngine(container, { ...(opts || {}), lesson: lessonForPractice });
}

function rerenderPractice(container, lang) {
  if (!container) return;
  const langKey = practiceLangKeyFromUiLang(lang);
  
  if (typeof console !== "undefined" && console.debug) {
    console.debug(`[HSK Language] Rerendering practice with ${langKey}`);
  }
  
  restoreHskChoiceOptionDisplayPatch();
  
  // 获取现有题目并应用语言安全过滤
  const currentQuestions = PracticeState.getQuestions();
  if (Array.isArray(currentQuestions)) {
    // 应用语言安全过滤 - 移除无效题目
    const validQuestions = currentQuestions.filter((q, index) => {
      const isValid = _isQuestionValidForLanguage(q, langKey);
      if (!isValid) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(`[HSK Language] Filtering out invalid question ${index} for ${langKey} during rerender`);
        }
      }
      return isValid;
    });
    
    // 安全fallback：如果有效题目太少，尝试English fallback
    let finalQuestions = validQuestions;
    if (finalQuestions.length < 3) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[HSK Language] Too few valid questions for ${langKey} during rerender, applying fallback`);
      }
      
      const fallbackQuestions = currentQuestions.filter((q, index) => {
        const isValid = _isQuestionValidForLanguage(q, "en");
        if (isValid) {
          // 验证English文本确实有效
          const prompt = q.prompt ?? q.question ?? {};
          let stemText = "";
          if (prompt && typeof prompt === "object") {
            stemText = _getControlledLangText(prompt, "en", "prompt");
          }
          if (!stemText && typeof q.question === "string") {
            stemText = q.question.trim();
          }
          if (stemText && isTextValidForLang(stemText, "en")) {
            return true;
          }
        }
        return false;
      });
      
      // 对fallback题目也应用语言验证（防止混合语言泄露）
      const safeFallback = fallbackQuestions.filter(q =>
        _isQuestionValidForLanguage(q, langKey)
      );
      
      // 只填补缺少的空位，不批量合并
      finalQuestions = [...validQuestions];
      if (finalQuestions.length < 3) {
        const needed = 3 - finalQuestions.length;
        finalQuestions = [
          ...finalQuestions,
          ...safeFallback.slice(0, needed)
        ];
      }
      
      // 最终安全过滤：确保所有题目都通过语言验证
      finalQuestions = finalQuestions.filter(q =>
        _isQuestionValidForLanguage(q, langKey)
      );
      
      if (typeof console !== "undefined" && console.debug) {
        console.debug('[LANG FILTER RERENDER MAIN]', validQuestions.length);
        console.debug('[LANG FILTER RERENDER FALLBACK]', safeFallback.length);
        console.debug('[LANG FILTER RERENDER FINAL]', finalQuestions.length);
      }
    }
    
    // 对最终题目应用清理和语言控制
    finalQuestions.forEach((q, index) => {
      // 清理题干污染字段（保留meaning/translation）
      if (q.prompt && typeof q.prompt === "object") {
        _stripPollutedFields(q.prompt);
      }
      _stripPollutedFields(q);
      
      // 清理拼音（独立处理，不参与fallback）
      if (q.pinyin) q.pinyin = _cleanPinyin(q.pinyin);
      if (q.py) q.py = _cleanPinyin(q.py);
      
      // 清理选项
      if (Array.isArray(q.options)) {
        q.options.forEach((o, optIndex) => {
          if (o && typeof o === "object") {
            _stripPollutedFields(o);
            if (o.pinyin) o.pinyin = _cleanPinyin(o.pinyin);
            if (o.py) o.py = _cleanPinyin(o.py);
          }
        });
      }
    });
    
    if (typeof console !== "undefined" && console.debug) {
      console.debug(`[HSK Language] Rerender filtering: ${finalQuestions.length}/${currentQuestions.length} questions valid for ${langKey}`);
    }
    
    // 应用显示规则（使用受控fallback）
    applyChoiceDisplayToQuestionList(finalQuestions, langKey);
  }
  
  rerenderPracticeFromEngine(container, lang);
}

function getCourseId() {
  return `${state.version}_hsk${state.lv}`;
}

function $(id) { return document.getElementById(id); }

/** state-driven 全量重渲染：meta / lesson list / detail 区 / tabs */
function rerenderHSKFromState() {
  const lang = getLang();
  const hskState = getHskState();
  if (typeof console !== "undefined" && console.debug) {
    console.debug("[HSK] rerender detail:", { ...hskState, lang });
  }

  updateProgressBlock();
  updateTabsLabels();

  const total = (state.lessons && state.lessons.length) || 0;
  const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total) : null) || {};
  const listEl = $("hskLessonList");
  if (listEl) renderLessonList(listEl, state.lessons, { lang, currentLessonNo: stats.lastLessonNo || 0 });

  if (state.current && state.current.lessonData) {
    const ld = state.current.lessonData;
    const lw = state.current.lessonWords || [];
    const no = state.current.lessonNo;
    const isReview = (ld && ld.type) === "review";
    const rr = (ld && ld.review && ld.review.lessonRange);

    if (typeof console !== "undefined" && console.debug) {
      console.debug("[HSK] render tab", state.tab, "lang=" + lang);
    }

    let titleStr = getLessonDisplayTitle(ld, getLang());
    if (isReview && Array.isArray(rr) && rr.length >= 2) {
      const rangeSuffix = i18n.t("hsk.review_range_suffix", { from: rr[0], to: rr[1] }) || `（${rr[0]}~${rr[1]}课）`;
      titleStr = (titleStr || "复习") + rangeSuffix;
    }
    const lessonNoLabel = i18n.t("hsk.lesson_no_format", { n: no });
    const headerTitle = titleStr ? `${lessonNoLabel} / ${titleStr}` : lessonNoLabel;
    const titleEl = $("hskStudyTitle");
    if (titleEl) titleEl.textContent = headerTitle;

    if (isReview) {
      renderReviewWords($("hskPanelWords"), lw, { lang, scope: `hsk${state.lv}`, wordsByLesson: ld.reviewWordsByLesson });
      renderReviewDialogue($("hskDialogueBody"), getDialogueCards(ld), { lang });
      renderReviewGrammar($("hskGrammarBody"), ld.grammar || [], { lang, vocab: lw || ld.vocab || ld.words || [] });
      renderReviewExtension($("hskExtensionBody"), ld.extension || [], { lang });
      $("hskReviewBody").innerHTML = buildReviewHTML(ld);
    } else {
      renderWordCards($("hskPanelWords"), lw, undefined, { lang, scope: `hsk${state.lv}` });
      $("hskDialogueBody").innerHTML = buildDialogueHTML(ld);
      $("hskGrammarBody").innerHTML = buildGrammarHTML(ld);
      $("hskExtensionBody").innerHTML = buildExtensionHTML(ld);
      $("hskReviewBody").innerHTML = buildReviewHTML(ld);
    }

    if (rerenderPractice && $("hskPracticeBody")) {
      try { rerenderPractice($("hskPracticeBody"), lang); } catch {}
    }

    if (AI_CAPABILITY && typeof AI_CAPABILITY.mountAIPanel === "function" && $("hskAIResult")) {
      try {
        AI_CAPABILITY.mountAIPanel($("hskAIResult"), {
          lesson: ld,
          lang,
          wordsWithMeaning: (w) => wordMeaning(w, lang),
        });
      } catch {}
    }

    updateTabsUI();
  }
}

/** 更新 tab 与 review 入口按钮文案（语言切换后） */
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
    if (btn) {
      const span = btn.querySelector("span") || btn;
      span.textContent = i18n.t(key);
    }
  });
  const reviewBtn = $("hskReviewBtn");
  if (reviewBtn) reviewBtn.textContent = i18n.t("review.start");
  const reviewLabels = [
    ["hskReviewEntry", "span", "hsk.review_mode"],
    ["hskReviewLesson", null, "hsk.review_this_lesson"],
    ["hskReviewLevel", null, "hsk.review_this_level"],
    ["hskReviewAll", null, "hsk.review_all_wrong"],
  ];
  reviewLabels.forEach(([id, child, key]) => {
    const el = $(id);
    if (!el) return;
    const target = child ? el.querySelector(child) : el;
    if (target) target.textContent = i18n.t(key);
  });
}

function updateProgressBlock() {
  const el = $("hskProgressBlock");
  if (!el) return;
  const courseId = getCourseId();
  const total = (state.lessons && state.lessons.length) || 0;
  const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(courseId, total) : null) || {};
  const { completedLessonCount, dueReviewCount, lastLessonNo, lastActivityAt } = stats;

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

  el.innerHTML = chips.map((text) => `<span class="hsk-meta-chip">${escapeHtml(text)}</span>`).join("");
}

function setError(msg = "") {
  const err = $("hskError");
  if (!err) return;
  if (!msg) { err.classList.add("hidden"); err.textContent = ""; return; }
  err.classList.remove("hidden");
  err.textContent = msg;
}

function setSubTitle() {
  const el = $("hskSubTitle");
  if (!el) return;
  el.textContent = `HSK ${state.lv} · ${state.version}`;
}

function showStudyMode(titleText = "") {
  var el = $("hskLessonListWrap"); if (el) el.classList.add("hidden");
  el = $("hskStudyBar"); if (el) el.classList.remove("hidden");
  el = $("hskStudyPanels"); if (el) el.classList.remove("hidden");
  if ($("hskStudyTitle")) $("hskStudyTitle").textContent = titleText || "";
}

function showListMode() {
  el = $("hskStudyBar"); if (el) el.classList.add("hidden");
  el = $("hskStudyPanels"); if (el) el.classList.add("hidden");

  el = $("hskLessonListWrap"); if (el) el.classList.remove("hidden");

  // clear panels
  el = $("hskPanelWords"); if (el) el.innerHTML = "";
  el = $("hskDialogueBody"); if (el) el.innerHTML = "";
  el = $("hskGrammarBody"); if (el) el.innerHTML = "";
  el = $("hskExtensionBody"); if (el) el.innerHTML = "";
  el = $("hskPracticeBody"); if (el) el.innerHTML = "";
  el = $("hskAIResult"); if (el) el.innerHTML = "";
  el = $("hskReviewBody"); if (el) el.innerHTML = "";
  el = $("hskSceneSection"); if (el) { el.innerHTML = ""; el.classList.add("hidden"); }

  state.current = null;
  state.tab = "words";
  updateTabsUI();
}

function updateTabsUI() {
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
    const active = state.tab === tab;

    if (btn) btn.classList.toggle("active", active);
    // simple active style without CSS dependency
    if (btn) {
      btn.style.background = active ? "rgba(34,197,94,0.10)" : "";
      btn.style.borderColor = active ? "rgba(34,197,94,0.55)" : "";
    }

    if (!panel) return;
    panel.classList.toggle("hidden", !active);
  });
}

/**
 * 统一 dialogue translation 读取：strict 规则，不 fallback 到其他语言
 * 兼容：translation.en / en / translationEn / 旧扁平字段
 */
function getDialogueTranslation(item, lang) {
  if (!item || typeof item !== "object") return "";
  const l = (lang || getLang()).toLowerCase();
  const key = l === "jp" || l === "ja" ? "jp" : l === "kr" || l === "ko" ? "kr" : l === "cn" || l === "zh" ? "cn" : "en";
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

  const trans = item.translation ?? item.trans ?? item.translations;
  if (trans && typeof trans === "object") {
    const v = trans[key] ?? trans[key === "jp" ? "ja" : key === "kr" ? "ko" : key === "cn" ? "zh" : key];
    if (v) return str(v);
  }
  if (key === "en") {
    const v = item.en ?? item.english ?? item.translationEn ?? item.translation_en;
    if (v) return str(v);
  }
  if (key === "kr") {
    const v = item.kr ?? item.ko ?? item.translationKr ?? item.translation_kr;
    if (v) return str(v);
  }
  if (key === "jp") {
    const v = item.jp ?? item.ja ?? item.translationJp ?? item.translation_jp;
    if (v) return str(v);
  }
  if (key === "cn") {
    const v = item.cn ?? item.zh ?? item.translationCn ?? item.translation_cn;
    if (v) return str(v);
  }
  return "";
}

/** 对话翻译：使用 getDialogueTranslation，避免与中文主句重复 */
function pickDialogueTranslation(line, zhMain = "") {
  const lang = getLang();
  const out = getDialogueTranslation(line, lang);
  if (out && zhMain && out === zhMain) return "";
  return out;
}

/** 会话标题：pick(title, strict) 或 i18n 会話{n} */
function pickCardTitle(obj, cardIndex = 1) {
  if (obj != null && typeof obj === "string") return obj.trim();
  const lang = getLang();
  const v = pick(obj, { strict: true, lang });
  if (v) return v;
  const sessionText = i18n.t("dialogue.session", { n: cardIndex });
  if (sessionText && sessionText !== "dialogue.session") return sessionText;
  return i18n.t("lesson.dialogue_card", "会话") + cardIndex;
}

/** 统一获取会话卡片：generatedDialogues > structuredDialogues > dialogueCards > dialogue */
function getDialogueCards(lesson) {
  const arr =
    (lesson && Array.isArray(lesson.generatedDialogues) && lesson.generatedDialogues.length)
      ? lesson.generatedDialogues
      : (lesson && Array.isArray(lesson.structuredDialogues) && lesson.structuredDialogues.length)
        ? lesson.structuredDialogues
        : (lesson && Array.isArray(lesson.dialogueCards) && lesson.dialogueCards.length)
          ? lesson.dialogueCards
          : (lesson && Array.isArray(lesson.dialogue) && lesson.dialogue.length ? lesson.dialogue : []);

  if (!arr.length) return [];

  const first = arr[0];
  const isCard = first && first.lines && Array.isArray(first.lines);
  const isLine = first && (first.speaker != null || first.cn != null || first.zh != null || first.text != null);

  if (isCard) return arr;
  if (isLine) return [{ title: null, lines: arr }];
  return [];
}

/** 渲染单条对话行，输出完整 HTML。支持新结构 text/translation 与旧结构 zh/kr */
function renderDialogueLine(line, lang, showPinyin) {
  const spk = String((line && line.spk) || (line && line.speaker) || "").trim();
  const zh = String((line && line.text) || (line && line.zh) || (line && line.cn) || (line && line.line) || "").trim();
  let py = maybeGetManualPinyin(line, "dialogue");
  if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
  const trans = pickDialogueTranslation(line, zh);
  if (typeof console !== "undefined" && console.debug) {
    console.debug("[HSK dialogue] lang=", lang, "text=", zh, "translation=", trans);
  }

  const zhAttrs = zh ? ` data-speak-text="${escapeHtml(zh).replaceAll('"', "&quot;")}" data-speak-kind="dialogue"` : "";
  return `<article class="lesson-dialogue-line">
  ${spk ? `<div class="lesson-dialogue-speaker">${escapeHtml(spk)}</div>` : ""}
  <div class="lesson-dialogue-zh"${zhAttrs}>${escapeHtml(zh)}</div>
  ${py ? `<div class="lesson-dialogue-pinyin">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="lesson-dialogue-translation">${escapeHtml(trans)}</div>` : ""}
</article>`;
}

/** 对话渲染：优先 dialogueCards，回退 dialogue；每张卡单独渲染，不合并 */
function buildDialogueHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const cards = getDialogueCards(raw);
  const lang = getLang();

  const hero = `<section class="lesson-section-hero lesson-dialogue-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.dialogue_subtitle"))}</p>
</section>`;

  if (!cards.length) return `${hero}<div class="lesson-empty-state">${i18n.t("hsk.empty_dialogue")}</div>`;

  if (SCENE_ENGINE && typeof SCENE_ENGINE.hasScene === "function" && SCENE_ENGINE.hasScene(lessonData)) {
    const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);
    const framesHtml = SceneRenderer.renderSceneFrames(scene, lessonData, lang);
    if (framesHtml) return hero + framesHtml;
  }

  const showPinyin = shouldShowPinyin({ level: (lessonData && lessonData.level), version: (lessonData && lessonData.version) });

  return `${hero}<div class="lesson-dialogue-list">
${cards.map((card, index) => {
  const lines = Array.isArray(card && card.lines) ? card.lines : [];
  if (!lines.length) return "";
  const titleText = pickCardTitle(card && card.title, index + 1);
  const lineHtml = lines.map((line) => renderDialogueLine(line, lang, showPinyin)).join("");
  return `  <section class="lesson-dialogue-card">
    <h4 class="lesson-dialogue-card-title">${escapeHtml(titleText)}</h4>
    <div class="lesson-dialogue-lines">${lineHtml}</div>
  </section>`;
}).filter(Boolean).join("\n")}
</div>`;
}

/**
 * 统一 grammar explanation 读取：strict 规则，不 fallback 到其他语言
 * 兼容：explain / explanation / explainJp / explanation_jp / explanation_zh / explanation_kr / explanation_en
 */
function getGrammarExplanation(item, lang) {
  if (!item || typeof item !== "object") return "";
  const l = (lang || getLang()).toLowerCase();
  const key = l === "jp" || l === "ja" ? "jp" : l === "kr" || l === "ko" ? "kr" : l === "cn" || l === "zh" ? "cn" : "en";
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

  const explain = item.explain ?? item.explanation;
  if (explain && typeof explain === "object") {
    const v = explain[key] ?? explain[key === "jp" ? "ja" : key === "kr" ? "ko" : key === "cn" ? "zh" : key];
    if (v) return str(v);
  }
  const flatMap = {
    jp: ["explainJp", "explanationJp", "explain_jp", "explanation_jp"],
    kr: ["explainKr", "explanationKr", "explain_kr", "explanation_kr"],
    en: ["explainEn", "explanationEn", "explain_en", "explanation_en"],
    cn: ["explainCn", "explanationCn", "explain_zh", "explanation_zh"],
  };
  for (const k of flatMap[key] || []) {
    const v = item[k];
    if (v) return str(v);
  }
  return "";
}

/** 语法例句：支持 examples[].translations，getContentText(example, "translation") 或 pick，JP strict */
function getGrammarExamples(pt) {
  const ex = (pt && pt.example) || (pt && pt.examples);
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const lang = getLang();
  const toItem = (e) => {
    if (typeof e === "string") return { zh: e, pinyin: "", trans: "" };
    const zh = str((e && e.zh) || (e && e.cn) || (e && e.line) || (e && e.text));
    const pinyin = str((e && e.pinyin) || (e && e.py));
    const trans = getContentText(e, "translation", { strict: true, lang }) || pick(e, { strict: true, lang }) || "";
    return { zh, pinyin, trans };
  };
  if (!ex) return [];
  if (Array.isArray(ex)) return ex.map(toItem).filter((x) => x.zh);
  return [toItem(ex)];
}

/** 语法渲染：教材级卡片，支持点读。使用 _raw 以保留 explain.jp 等原始字段 */
function buildGrammarHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const g = raw && raw.grammar;
  const lang = getLang();
  const speakLabel = i18n.t("hsk.extension_speak");
  const emptyMsg = `<div class="lesson-grammar-empty">${i18n.t("hsk.empty_grammar")}</div>`;

  const hero = `<section class="lesson-section-hero lesson-grammar-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.grammar_title"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.grammar_subtitle"))}</p>
</section>`;

  if (!g) return `${hero}${emptyMsg}`;

  const arr = Array.isArray(g) ? g : (Array.isArray(g && g.points) ? g.points : []);
  if (!arr.length) return `${hero}${emptyMsg}`;

  const showPinyin = shouldShowPinyin({ level: (lessonData && lessonData.level), version: (lessonData && lessonData.version) });
  const cards = arr.map((pt, i) => {
    const titleZh = typeof (pt && pt.title) === "object"
      ? ((pt.title && pt.title.zh) || (pt.title && pt.title.kr) || (pt.title && pt.title.en) || "")
      : ((pt && pt.pattern) || (pt && pt.title) || (pt && pt.name) || "#" + (i + 1));
    let titlePy = maybeGetManualPinyin(pt, "grammarTitle");
    if (showPinyin && titleZh && !titlePy) titlePy = resolvePinyin(titleZh, titlePy);

    const expl = getGrammarExplanation(pt, lang);
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[HSK grammar] lang=", lang, "pattern=", pt?.pattern, "explanation=", expl);
    }
    const examples = getGrammarExamples(pt);
    const idx = String(i + 1).padStart(2, "0");
    const titleEsc = escapeHtml(titleZh).replaceAll('"', "&quot;");
    const titleAttrs = titleZh ? ` data-speak-text="${titleEsc}" data-speak-kind="grammar"` : "";
    const btnAttrs = titleZh ? ` data-speak-text="${titleEsc}" data-speak-kind="grammar"` : "";

    let examplesHtml = "";
    if (examples.length) {
      examplesHtml = examples.map((ex) => {
        let exPy = ex.pinyin;
        if (showPinyin && ex.zh && !exPy) exPy = resolvePinyin(ex.zh, exPy);
        const exEsc = escapeHtml(ex.zh).replaceAll('"', "&quot;");
        const exAttrs = ex.zh ? ` data-speak-text="${exEsc}" data-speak-kind="grammar"` : "";
        return `<div class="lesson-grammar-example">
  <div class="lesson-grammar-example-zh"${exAttrs}>${escapeHtml(ex.zh)}</div>
  ${exPy ? `<div class="lesson-grammar-example-pinyin">${escapeHtml(exPy)}</div>` : ""}
  ${ex.trans ? `<div class="lesson-grammar-example-meaning">${escapeHtml(ex.trans)}</div>` : ""}
</div>`;
      }).join("");
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
  }).join("");

  return `${hero}<section class="lesson-grammar-list">${cards}</section>`;
}

/**
 * 统一 extension explanation 读取：strict 规则，不 fallback
 * 优先级：explain.{lang} > explanation.{lang} > explainKr/Jp/En > meaning.{lang} > translation.{lang}
 */
function getExtensionExplanation(item, lang) {
  if (!item || typeof item !== "object") return "";
  const l = (lang || getLang()).toLowerCase();
  const key = l === "jp" || l === "ja" ? "jp" : l === "kr" || l === "ko" ? "kr" : l === "cn" || l === "zh" ? "cn" : "en";
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

  const explain = item.explain ?? item.explanation;
  if (explain && typeof explain === "object") {
    const v = explain[key] ?? explain[key === "jp" ? "ja" : key === "kr" ? "ko" : key === "cn" ? "zh" : key];
    if (v) return str(v);
  }
  const flatMap = {
    jp: ["explainJp", "explanationJp", "explain_jp", "explanation_jp"],
    kr: ["explainKr", "explanationKr", "explain_kr", "explanation_kr"],
    en: ["explainEn", "explanationEn", "explain_en", "explanation_en"],
    cn: ["explainCn", "explanationCn", "explain_zh", "explanation_zh"],
  };
  for (const k of flatMap[key] || []) {
    const v = item[k];
    if (v) return str(v);
  }
  const meaning = item.meaning;
  if (meaning && typeof meaning === "object") {
    const v = meaning[key] ?? meaning[key === "jp" ? "ja" : key === "kr" ? "ko" : key === "cn" ? "zh" : key];
    if (v) return str(v);
  }
  const trans = item.translation ?? item.translations;
  if (trans && typeof trans === "object") {
    const v = trans[key] ?? trans[key === "jp" ? "ja" : key === "kr" ? "ko" : key === "cn" ? "zh" : key];
    if (v) return str(v);
  }
  const note = item.note;
  if (note && typeof note === "object") {
    const v = note[key] ?? note[key === "jp" ? "ja" : key === "kr" ? "ko" : key === "cn" ? "zh" : key];
    if (v) return str(v);
  }
  if (typeof note === "string" && note.trim()) return str(note);
  if (key === "kr" && item.kr) return str(item.kr);
  if (key === "en" && item.en) return str(item.en);
  if (key === "jp" && item.jp) return str(item.jp);
  if (key === "cn" && item.cn) return str(item.zh || item.cn);
  return "";
}

/**
 * Extension 主译文（与 explain 分离）：当前界面语言优先，缺省则仅在 kr / en / jp 间回退
 */
function getExtensionMeaning(item, lang) {
  if (!item || typeof item !== "object") return "";
  const l = (lang || getLang()).toLowerCase();
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

  const currentKey =
    l === "jp" || l === "ja" ? "jp" : l === "kr" || l === "ko" ? "kr" : l === "cn" || l === "zh" ? null : "en";

  const valueForKey = (k) => {
    if (!k) return "";
    if (k === "kr") {
      const v = item.kr ?? item.ko ?? item.translationKr ?? item.translation_kr;
      if (v) return str(v);
    } else if (k === "en") {
      const v = item.en ?? item.english ?? item.translationEn ?? item.translation_en;
      if (v) return str(v);
    } else if (k === "jp") {
      const v = item.jp ?? item.ja ?? item.translationJp ?? item.translation_jp;
      if (v) return str(v);
    }
    const trans = item.translation ?? item.trans ?? item.translations;
    if (trans && typeof trans === "object") {
      const v =
        trans[k] ??
        trans[k === "jp" ? "ja" : k === "kr" ? "ko" : k];
      if (v) return str(v);
    }
    return "";
  };

  const order = [];
  if (currentKey) order.push(currentKey);
  for (const k of ["kr", "en", "jp"]) {
    if (k !== currentKey) order.push(k);
  }
  for (const k of order) {
    const v = valueForKey(k);
    if (v) return v;
  }
  return "";
}

/** 扩展表达：支持句组训练卡片（groupTitle + sentences）与旧单句格式兼容
 * 扩展 tab 仅显示真正的扩展内容（句型、文化说明等），不显示词卡
 */
function buildExtensionHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const arr =
    Array.isArray(raw && raw.generatedExtensions) && raw.generatedExtensions.length
      ? raw.generatedExtensions
      : Array.isArray(raw && raw.extension) ? raw.extension : [];
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

  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const pickObj = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    const key = lang === "cn" || lang === "zh" ? "cn" : lang === "kr" || lang === "ko" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";
    return str(obj[key] ?? obj.zh ?? obj.cn ?? obj.kr ?? obj.jp ?? obj.en);
  };
  const pickTrans = (tObj) => {
    if (!tObj || typeof tObj !== "object") return "";
    const key = lang === "cn" || lang === "zh" ? "cn" : lang === "kr" || lang === "ko" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";
    return str(tObj[key] ?? tObj.zh ?? tObj.cn ?? tObj.kr ?? tObj.jp ?? tObj.en);
  };

  const cards = arr.map((item, i) => {
    const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];
    const isGroup = sentences.length > 0 && (item.groupTitle || item.focusGrammar);

    if (isGroup) {
      const groupTitle = pickObj(item.groupTitle) || str(item.focusGrammar) || (i18n.t("hsk.extension_group", "句型练习") + " " + (i + 1));
      const note = pickObj(item.note);
      const sentencesHtml = sentences.map((s) => {
        const cn = str((s && s.cn) || (s && s.zh) || "");
        const py = str((s && s.pinyin) || (s && s.py) || "");
        const trans = pickTrans(s && s.translations) || pickTrans(s && s.translation);
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

    const phrase = str((item && item.phrase) || (item && item.hanzi) || (item && item.zh) || (item && item.cn) || (item && item.line) || "");
    const pinyin = str((item && item.pinyin) || (item && item.py) || "");
    const example = str((item && item.example) || (item && item.exampleZh) || "");
    const examplePinyin = str((item && item.examplePinyin) || (item && item.examplePy) || "");
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
    ${explanation ? `<div class="lesson-extension-meaning">${escapeHtml(explanation)}</div>` : ""}
    ${example ? `<div class="lesson-extension-example">${escapeHtml(example)}</div>` : ""}
    ${examplePinyin ? `<div class="lesson-extension-example-pinyin">${escapeHtml(examplePinyin)}</div>` : ""}
  </div>
</article>`;
  }).filter(Boolean).join("");

  return `${hero}<section class="lesson-extension-list">${cards}</section>`;
}

/** 复习 tab：学习课显示 lessonWords/relatedOldWords/grammarReview；复习课显示综合回顾 */
function buildReviewHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const r = raw && raw.review;
  const lang = getLang();
  const pickSummary = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    const key = lang === "cn" || lang === "zh" ? "cn" : lang === "kr" || lang === "ko" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";
    const v = (obj[key] ?? obj.summary ?? obj.focus ?? "").trim();
    return v || String(obj.cn ?? obj.zh ?? "").trim();
  };

  if (!r || typeof r !== "object") {
    return `<div class="lesson-review-empty text-sm opacity-70">${escapeHtml(i18n.t("hsk.review_empty") || "暂无复习内容")}</div>`;
  }

  const parts = [];
  const isReviewLesson = (raw && raw.type) === "review";
  const lessonWords = Array.isArray(r.lessonWords) ? r.lessonWords : [];
  const relatedOldWords = Array.isArray(r.relatedOldWords) ? r.relatedOldWords : [];
  const grammarReview = Array.isArray(r.grammarReview) ? r.grammarReview : [];
  const summaryTasks = Array.isArray(r.summaryTasks) ? r.summaryTasks : [];
  const reviewRange = Array.isArray(r.lessonRange) ? r.lessonRange : Array.isArray(r.reviewRange) ? r.reviewRange : [];

  if (isReviewLesson && reviewRange.length >= 2) {
    const rangeText = i18n.t("hsk.review_range_lessons", { from: reviewRange[0], to: reviewRange[1] }) || `第 ${reviewRange[0]}～${reviewRange[1]} 课 综合复习`;
    parts.push(`<div class="lesson-review-range text-sm font-medium mb-3">${escapeHtml(rangeText)}</div>`);
  }

  if (lessonWords.length) {
    const label = isReviewLesson ? (i18n.t("hsk.review_words") || "复习词汇") : (i18n.t("hsk.lesson_words_review") || "本课词汇");
    parts.push(`<section class="lesson-review-section"><h4 class="text-sm font-semibold mb-2">${escapeHtml(label)}</h4><div class="flex flex-wrap gap-2">${lessonWords.map((w) => `<span class="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">${escapeHtml(String(w))}</span>`).join("")}</div></section>`);
  }

  if (relatedOldWords.length && !isReviewLesson) {
    parts.push(`<section class="lesson-review-section"><h4 class="text-sm font-semibold mb-2">${escapeHtml(i18n.t("hsk.related_old_words") || "关联旧词")}</h4><div class="flex flex-wrap gap-2">${relatedOldWords.map((w) => `<span class="px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">${escapeHtml(String(w))}</span>`).join("")}</div></section>`);
  }

  if (grammarReview.length) {
    parts.push(`<section class="lesson-review-section"><h4 class="text-sm font-semibold mb-2">${escapeHtml(i18n.t("hsk.grammar_review") || "语法回顾")}</h4><ul class="space-y-1">${grammarReview.map((g) => {
      const name = escapeHtml(String(g.name || "").trim() || "-");
      const sumObj = g.summary && typeof g.summary === "object" ? g.summary : (g.summary ? { cn: g.summary, kr: g.summary, en: g.summary, jp: g.summary } : g);
      const summary = escapeHtml(pickSummary(sumObj));
      return `<li><span class="font-medium">${name}</span>${summary ? ` — ${summary}` : ""}</li>`;
    }).join("")}</ul></section>`);
  }

  if (summaryTasks.length) {
    parts.push(`<section class="lesson-review-section"><h4 class="text-sm font-semibold mb-2">${escapeHtml(i18n.t("hsk.summary_tasks") || "复习任务")}</h4><ul class="space-y-1">${summaryTasks.map((t) => `<li>${escapeHtml(typeof t === "string" ? t : (t && t.cn) || (t && t.text) || "")}</li>`).join("")}</ul></section>`);
  }

  if (!parts.length) {
    return `<div class="lesson-review-empty text-sm opacity-70">${escapeHtml(i18n.t("hsk.review_empty") || "暂无复习内容")}</div>`;
  }
  return `<div class="lesson-review-content space-y-4">${parts.join("")}</div>`;
}

function buildAIContext() {
  if (!state.current || !state.current.lessonData) return "";
  const lang = getLang();
  const ld = state.current.lessonData;
  const no = state.current.lessonNo;

  const found = state.lessons && state.lessons.find(function(x) { return getLessonNumber(x) === no; });
  const title = found ? getLessonDisplayTitle(found, lang) : "";

  const words = Array.isArray(state.current.lessonWords) ? state.current.lessonWords : [];
  const wordsLine = words.slice(0, 12).map(w => {
    const han = wordKey(w);
    const py = wordPinyin(w);
    const mean = wordMeaning(w, lang);
    return `${han}${py ? `(${py})` : ""}${mean ? `: ${mean}` : ""}`;
  }).join("\n");

  const lessonLabel = i18n.t("hsk.lesson_no_format", { n: no }) || (lang === "jp" ? `第 ${no} 課` : lang === "kr" ? `제 ${no}과` : `Lesson ${no}`);
  const questionLabel = i18n.t("practice.question_label") || (lang === "jp" ? "質問" : "Question");
  const titleLabel = lang === "jp" ? "タイトル" : "Title";
  return [
    lessonLabel,
    title ? `${titleLabel}: ${title}` : "",
    wordsLine ? `Words:\n${wordsLine}` : "",
    "",
    questionLabel + ":",
  ].filter(Boolean).join("\n");
}

/** 加载 vocab-map：data/pedagogy/${levelKey}-vocab-map.json */
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
    if (map && typeof console !== "undefined" && console.debug) {
      console.debug("[VocabMap] loaded:", levelKey + "-vocab-map.json");
    }
    _vocabMapCache.set(levelKey, map);
    return map;
  } catch {
    return null;
  }
}

/** 获取 vocab-distribution.json：distribution 键顺序 + lessonThemes 主题标题
 *  返回 { order: string[], lessonThemes: Record<string, string> } 或 null */
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
    const lessonThemes = (data && data.lessonThemes && typeof data.lessonThemes === "object") ? data.lessonThemes : null;
    const out = { order, lessonThemes };
    _vocabDistCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

/** 按 vocab-distribution 的 distribution 键顺序排序课程 */
function sortLessonsByDistributionOrder(lessons, order) {
  if (!Array.isArray(lessons) || !Array.isArray(order) || order.length === 0) return lessons;
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

/** vocab-distribution 主题的多语言翻译（供课程卡片显示）JP: jp->cn->en->kr */
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

/** 用 vocab-distribution 的 lessonThemes 覆盖课程标题，并附加多语言翻译 */
function applyVocabDistributionTitles(lessons, lessonThemes) {
  if (!Array.isArray(lessons) || !lessonThemes || typeof lessonThemes !== "object") return lessons;
  return lessons.map((l) => {
    const no = getLessonNumber(l);
    const theme = no ? (lessonThemes[String(no)] || lessonThemes[no]) : null;
    if (!theme || typeof theme !== "string") return l;
    const tr = HSK1_THEME_TRANSLATIONS[theme];
    return {
      ...l,
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

/** 统一课程编号：兼容 lessonNo / no / id / lesson / index */
function getLessonNumber(lesson) {
  if (!lesson || typeof lesson !== "object") return 0;
  const n = Number(lesson.lessonNo ?? lesson.no ?? lesson.id ?? lesson.lesson ?? lesson.index ?? 0) || 0;
  return n;
}

/** 从 blueprint title（string 或 object）解析当前语言的标题，无匹配时回退 zh */
function resolveBlueprintTitle(titleObj, lang) {
  if (!titleObj) return "";
  if (typeof titleObj === "string") return String(titleObj).trim();
  if (typeof titleObj !== "object") return "";
  const l = (lang || getLang()).toLowerCase();
  const key = l === "kr" || l === "ko" ? "ko" : l === "cn" || l === "zh" ? "zh" : l === "jp" || l === "ja" ? "ja" : "en";
  const altKey = l === "kr" ? "kr" : l === "cn" ? "cn" : l === "jp" ? "jp" : "en";
  return (
    String(titleObj[altKey] ?? titleObj[key] ?? "").trim() ||
    String(titleObj.zh ?? titleObj.cn ?? "").trim() ||
    String(titleObj.ko ?? titleObj.kr ?? "").trim() ||
    String(titleObj.en ?? "").trim() ||
    String(titleObj.ja ?? titleObj.jp ?? "").trim() ||
    ""
  );
}

/** 合并 coreWords + extraWords 为本课必学词汇（单词 tab 用）
 * 去重，保持顺序（先 core 再 extra），回退 words / originalWords
 */
function mergeLessonVocabulary(lesson) {
  if (!lesson) return [];
  const core = Array.isArray(lesson.coreWords) ? lesson.coreWords : (Array.isArray(lesson.distributedWords) ? lesson.distributedWords : []);
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

/** 根据当前语言刷新 lesson.displayTitle（仅对有 blueprintTitle 的 lesson） */
function refreshBlueprintDisplayTitles(lessons, lang) {
  if (!Array.isArray(lessons)) return;
  const l = lang || getLang();
  lessons.forEach((lesson) => {
    if (lesson && lesson.blueprintTitle != null) {
      lesson.displayTitle = resolveBlueprintTitle(lesson.blueprintTitle, l);
    }
  });
}

/** Blueprint 优先：保存 blueprintTitle、originalTitle，不覆盖 lesson.title
 * displayTitle 由 refreshBlueprintDisplayTitles(lessons, currentLang) 生成
 */
function applyBlueprintTitles(lessons, blueprint) {
  if (!Array.isArray(lessons) || !blueprint || typeof blueprint !== "object") return lessons;
  return lessons.map((l) => {
    const no = getLessonNumber(l);
    const key = String(no);
    const entry = no ? blueprint[key] : null;
    const rawTitle = entry && entry.title != null ? entry.title : null;
    if (!rawTitle) return l;
    return {
      ...l,
      originalTitle: l.title,
      blueprintTitle: rawTitle,
    };
  });
}

/** 将 distribution 结果注入 lessons：coreWords、extraWords、distributedWords、words、originalWords、reviewWordsByLesson
 * distribution 格式：{ core: {...}, extra: {...}, reviewWordsByLesson?: { "21": { "1": [...] }, ... } }
 */
function applyVocabDistribution(lessons, distribution) {
  if (!Array.isArray(lessons) || !distribution || typeof distribution !== "object") return lessons;
  const hasCoreExtra = distribution.core != null && distribution.extra != null;
  const reviewByLesson = distribution.reviewWordsByLesson;
  return lessons.map((l) => {
    const no = getLessonNumber(l);
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
    const originalWords = Array.isArray(l.words) ? l.words : (Array.isArray(l.vocab) ? l.vocab : []);
    const distributedWords = coreWords;
    const reviewWordsByLesson = reviewByLesson && typeof reviewByLesson[key] === "object" ? reviewByLesson[key] : null;
    return {
      ...l,
      originalWords,
      coreWords,
      extraWords,
      distributedWords,
      words: coreWords.length > 0 ? coreWords : originalWords,
      ...(reviewWordsByLesson && { reviewWordsByLesson }),
    };
  });
}

async function loadLessons() {
  setError("");
  setSubTitle();

  const lang = getLang();
  const listEl = $("hskLessonList");
  if (listEl) listEl.innerHTML = `<div class="text-sm opacity-70">${i18n.t("common_loading")}</div>`;

  try {
    let lessons = [];
    if (LESSON_ENGINE && typeof LESSON_ENGINE.loadCourseIndex === "function") {
      try {
        const index = await LESSON_ENGINE.loadCourseIndex({
          courseType: state.version,
          level: `hsk${state.lv}`,
        });
        lessons = Array.isArray(index && index.lessons) ? index.lessons : [];
      } catch (engineErr) {
        console.warn("[HSK] Lesson Engine loadCourseIndex failed, fallback to HSK_LOADER:", engineErr && engineErr.message);
      }
    }
    if (!lessons.length && window.HSK_LOADER && typeof window.HSK_LOADER.loadLessons === "function") {
      lessons = await window.HSK_LOADER.loadLessons(state.lv, { version: state.version });
    }
    lessons = Array.isArray(lessons) ? lessons : [];

    const vocabDist = await getVocabDistribution(state.lv, state.version);
    // 目录只由 lessons.json 控制：不按 vocab-distribution 重排，不覆盖标题
    let result = sortLessonsByDistributionOrder(lessons, null);
    const blueprint = await loadBlueprint(`hsk${state.lv}`);
    if (blueprint) {
      if (state.lv === 1 && typeof console !== "undefined" && console.debug) {
        console.debug("[Blueprint] loaded: hsk1");
        console.debug("[Blueprint] lesson count:", Object.keys(blueprint).length);
        const first = result.find((l) => getLessonNumber(l) === 1);
        const bp1 = blueprint["1"];
        if (bp1?.title) {
          const display = (first && (typeof first.displayTitle === "string" ? first.displayTitle : (first.displayTitle?.zh ?? first.displayTitle?.cn ?? first.title?.zh ?? first.title?.cn))) || "";
          console.debug("[Blueprint] matched lesson 1 ->", display || (typeof bp1.title === "string" ? bp1.title : bp1.title?.zh));
        } else {
          console.debug("[Blueprint] lesson 1 not matched, blueprint[\"1\"]:", bp1 ? "no title" : "missing");
        }
      }

      let vocabList = null;
      try {
        if (window.HSK_LOADER && typeof window.HSK_LOADER.loadVocab === "function") {
          vocabList = await window.HSK_LOADER.loadVocab(state.lv, { version: state.version });
        }
      } catch (vocabErr) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[VocabDistributor] vocabList load failed:", vocabErr?.message);
        }
      }
      if (!Array.isArray(vocabList) || vocabList.length === 0) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[VocabDistributor] vocabList empty or missing, skipping distribution");
        }
      } else {
        const levelKey = `hsk${state.lv}`;
        const vocabMap = await loadVocabMap(levelKey);
        let distribution = null;
        if (vocabMap && Object.keys(vocabMap).some((k) => k !== "description" && k !== "version")) {
          distribution = distributeVocabularyByMap(levelKey, vocabMap, vocabList);
          if (typeof console !== "undefined" && console.debug) {
            auditVocabularyCoverage(vocabMap, vocabList);
          }
        }
        if (!distribution || Object.keys(distribution).length === 0) {
          distribution = distributeVocabulary(levelKey, blueprint, vocabList);
        }
        if (distribution && Object.keys(distribution).length > 0) {
          result = applyVocabDistribution(result, distribution);
        }
      }
    } else if (state.lv === 1 && typeof console !== "undefined" && console.warn) {
      console.warn("[Blueprint] hsk1 not loaded, titles will use vocab-distribution or lesson JSON");
    }

    state.lessons = result;
    const total = state.lessons.length;
    const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total) : null) || {};
    renderLessonList(listEl, state.lessons, { lang: lang, currentLessonNo: stats.lastLessonNo || 0 });
    updateProgressBlock();
  } catch (e) {
    console.error(e);
    setError("Lessons load failed: " + (e && e.message ? e.message : e));
  }
}

async function openLesson({ lessonNo, file }) {
  setError("");
  const lang = getLang();
  const no = Number(lessonNo || 1);

  try {
    let lessonData = null;
    // ✅ HSK 优先使用 HSK_LOADER，确保 review 课(21/22)合并逻辑生效
    const listItem = state.lessons.find((l) => getLessonNumber(l) === no);
    if (window.HSK_LOADER && typeof window.HSK_LOADER.loadLessonDetail === "function") {
      try {
        lessonData = await window.HSK_LOADER.loadLessonDetail(state.lv, no, {
          version: state.version,
          file: file || (listItem && listItem.file) || "",
        });
      } catch (loaderErr) {
        console.warn("[HSK] HSK_LOADER.loadLessonDetail failed:", loaderErr && loaderErr.message);
      }
    }
    if (!lessonData && LESSON_ENGINE && typeof LESSON_ENGINE.loadLessonDetail === "function") {
      try {
        const { lesson } = await LESSON_ENGINE.loadLessonDetail({
          courseType: state.version,
          level: `hsk${state.lv}`,
          lessonNo: no,
          file: file || "",
        });
        lessonData = lesson;
      } catch (engineErr) {
        console.warn("[HSK] Lesson Engine loadLessonDetail failed:", engineErr && engineErr.message);
      }
    }
    if (!lessonData) throw new Error("Failed to load lesson");

    if (listItem && listItem.title && typeof listItem.title === "object") {
      lessonData.title = { ...(listItem.title || {}), ...(lessonData.title || {}) };
    }
    const blueprint = await loadBlueprint(`hsk${state.lv}`);
    const bpEntry = blueprint && blueprint[String(no)];
    if (bpEntry && bpEntry.title != null) {
      const resolved = resolveBlueprintTitle(bpEntry.title, lang);
      if (resolved) {
        lessonData.originalTitle = lessonData.title;
        lessonData.blueprintTitle = bpEntry.title;
        lessonData.displayTitle = resolved;
      }
    }

    const fromList = listItem ? mergeLessonVocabulary(listItem) : [];
    const fromDetail = Array.isArray(lessonData?.words) ? lessonData.words : (Array.isArray(lessonData?.vocab) ? lessonData.vocab : []);
    // HSK1 单词 Tab 以 vocab-distribution 为准：lessonData 来自 HSK_LOADER.loadLessonDetail 已含 distribution 覆盖，优先用 fromDetail，不再被 listItem 旧词覆盖
    const isHsk1 = Number(state.lv) === 1;
    const lessonWordsRaw = (isHsk1 && fromDetail.length > 0) ? fromDetail : (fromList.length > 0 ? fromList : fromDetail);
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[HSK] openLesson vocab source", { lessonNo: no, isHsk1, fromListLen: fromList.length, fromDetailLen: fromDetail.length, used: (isHsk1 && fromDetail.length > 0) ? "fromDetail(distribution)" : (fromList.length > 0 ? "fromList" : "fromDetail"), hanzi: lessonWordsRaw.slice(0, 10).map((w) => (w && (w.hanzi || w.word)) || w) });
    }
    if (listItem) {
      lessonData.coreWords = listItem.coreWords ?? listItem.distributedWords ?? listItem.words;
      lessonData.extraWords = listItem.extraWords ?? [];
      if (listItem.reviewWordsByLesson) lessonData.reviewWordsByLesson = listItem.reviewWordsByLesson;
    }
    const needsVocabEnrichment = lessonWordsRaw.some((w) => typeof w === "string");
    let vocab = [];
    if (needsVocabEnrichment && window.HSK_LOADER && typeof window.HSK_LOADER.loadVocab === "function") {
      vocab = await window.HSK_LOADER.loadVocab(state.lv, { version: state.version });
    }

    const vocabArr = Array.isArray(vocab) ? vocab : [];
    const vocabByKey = new Map(vocabArr.map((v) => [wordKey(v), v]).filter(([k]) => k));

    const lessonWords = lessonWordsRaw.map((w) => {
      if (typeof w === "string") {
        const key = String(w != null ? w : "").trim();
        return vocabByKey.get(key) || { hanzi: key };
      }
      return w || {};
    }).filter((w) => wordKey(w));

    if (lessonWords.length > 0) {
      lessonData.words = lessonWords;
      lessonData.vocab = lessonWords;
    }

    state.current = { lessonNo: no, file: file || "", lessonData, lessonWords };

    const courseId = (lessonData && lessonData.courseId) || getCourseId();
    const lessonId = (lessonData && lessonData.id) || (courseId + "_lesson" + no);
    if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.markLessonStarted === "function") PROGRESS_ENGINE.markLessonStarted({ courseId: courseId, lessonId: lessonId, lessonNo: no });

    const lessonCoverUrl = (IMAGE_ENGINE && typeof IMAGE_ENGINE.getLessonImage === "function" ? IMAGE_ENGINE.getLessonImage(lessonData, {
      courseType: state.version,
      level: "hsk" + state.lv,
    }) : null);
    const coverWrap = $("hskLessonCoverWrap");
    const coverImg = $("hskLessonCover");
    if (coverWrap && coverImg) {
      if (lessonCoverUrl) {
        coverImg.src = lessonCoverUrl;
        coverImg.alt = typeof (lessonData && lessonData.title) === "object" ? ((lessonData.title && lessonData.title.zh) || (lessonData.title && lessonData.title.en) || "") : String((lessonData && lessonData.title) || "");
        coverImg.onerror = () => { coverWrap.classList.add("hidden"); };
        coverWrap.classList.remove("hidden");
    } else {
      coverWrap.classList.add("hidden");
      }
    }

    const sceneSection = $("hskSceneSection");
    if (sceneSection) {
      if (SCENE_ENGINE && typeof SCENE_ENGINE.hasScene === "function" && SCENE_ENGINE.hasScene(lessonData)) {
        const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);
        sceneSection.innerHTML = SceneRenderer.renderSceneHeader(scene, lang) +
          SceneRenderer.renderSceneGoals(scene, lang) +
          SceneRenderer.renderSceneCharacters(scene, lang);
        sceneSection.classList.remove("hidden");
      } else {
        sceneSection.innerHTML = "";
        sceneSection.classList.add("hidden");
      }
    }

    let titleStr = getLessonDisplayTitle(lessonData, lang);
    const reviewRange = (lessonData && lessonData.review && lessonData.review.lessonRange) || [];
    if ((lessonData && lessonData.type) === "review" && Array.isArray(reviewRange) && reviewRange.length >= 2) {
      const rangeSuffix = i18n.t("hsk.review_range_suffix", { from: reviewRange[0], to: reviewRange[1] }) || `（${reviewRange[0]}~${reviewRange[1]}课）`;
      titleStr = (titleStr || "复习") + rangeSuffix;
    }
    const lessonNoLabel = i18n.t("hsk.lesson_no_format", { n: no });
    const headerTitle = titleStr ? `${lessonNoLabel} / ${titleStr}` : lessonNoLabel;
    showStudyMode(headerTitle);
    el = $("hskStudyBar"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    updateProgressBlock();

    // 供 Stroke 弹窗 / fallback 使用的上下文
    window.__HSK_PAGE_CTX = {
      version: state.version,
      level: state.lv,
      lessonNo: no,
      from: typeof location !== "undefined" ? location.pathname : "/pages/hsk.html",
    };

    // Default tab: words
    state.tab = "words";
    if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.markStepCompleted === "function") PROGRESS_ENGINE.markStepCompleted({ courseId: courseId, lessonId: lessonId, step: "vocab" });
    updateTabsUI();

    // Render panels
    const isReview = (lessonData && lessonData.type) === "review";
    if (isReview) {
      renderReviewWords($("hskPanelWords"), lessonWords, { lang, scope: `hsk${state.lv}`, wordsByLesson: lessonData.reviewWordsByLesson });
      const cards = getDialogueCards(lessonData);
      renderReviewDialogue($("hskDialogueBody"), cards, { lang });
      renderReviewGrammar($("hskGrammarBody"), lessonData.grammar || [], { lang, vocab: lessonWords || lessonData.vocab || lessonData.words || [] });
      renderReviewExtension($("hskExtensionBody"), lessonData.extension || [], { lang });
      const reviewEl = $("hskReviewBody");
      if (reviewEl) reviewEl.innerHTML = buildReviewHTML(lessonData);
      if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.touchLessonVocab === "function") PROGRESS_ENGINE.touchLessonVocab({
        courseId,
        lessonId,
        vocabItems: (lessonWords || []).map((w) => wordKey(w) || w),
      });
    } else {
      renderWordCards($("hskPanelWords"), lessonWords, undefined, { lang, scope: `hsk${state.lv}` });
      if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.touchLessonVocab === "function") PROGRESS_ENGINE.touchLessonVocab({
        courseId,
        lessonId,
        vocabItems: lessonWords.map((w) => wordKey(w) || w),
      });
      $("hskDialogueBody").innerHTML = buildDialogueHTML(lessonData);
      $("hskGrammarBody").innerHTML = buildGrammarHTML(lessonData);
      $("hskExtensionBody").innerHTML = buildExtensionHTML(lessonData);
      const reviewEl = $("hskReviewBody");
      if (reviewEl) reviewEl.innerHTML = buildReviewHTML(lessonData);
    }

    // Practice panel: 平台级 Practice Engine
    if (mountPractice && $("hskPracticeBody")) {
      try {
        mountPractice($("hskPracticeBody"), {
          lesson: lessonData,
          lang,
          onComplete: ({ total, correct, score, lesson, wrongItems = [] }) => {
            if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.recordPracticeResult === "function") PROGRESS_ENGINE.recordPracticeResult({
              courseId,
              lessonId,
              total,
              correct,
              score,
              vocabItems: ((lesson && lesson.vocab) || (lesson && lesson.words) || []).map(function(w) { return typeof w === "string" ? w : (w && w.hanzi) || (w && w.word) || ""; }).filter(Boolean),
              wrongItems,
            });
            if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.markLessonCompleted === "function") PROGRESS_ENGINE.markLessonCompleted({ courseId, lessonId });
            addWrongItems(wrongItems, { lessonId, courseId });
            addRecentItem({ lessonId, courseId, total, correct, score, practicedAt: Date.now() });
            updateProgressBlock();
          },
        });
      } catch (e) {
        console.warn("[HSK] Practice mount failed:", e && e.message);
        $("hskPracticeBody").innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("practice.load_failed") || i18n.t("practice.empty"))}</div>`;
      }
    }

    // AI panel: 新 AI Tutor Panel 独占，无旧 hskAIInput / hskAIContext
    if (AI_CAPABILITY && typeof AI_CAPABILITY.mountAIPanel === "function" && $("hskAIResult")) {
      try {
        AI_CAPABILITY.mountAIPanel($("hskAIResult"), {
          lesson: lessonData,
          lang,
          wordsWithMeaning: (w) => wordMeaning(w, lang),
        });
      } catch (e) {
        console.warn("[HSK] AI panel mount failed, fallback:", e && e.message);
        $("hskAIResult").innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("hsk_ai_tip", {}))}</div>`;
      }
    } else {
      $("hskAIResult").innerHTML = "";
    }

  } catch (e) {
    console.error(e);
    setError("Lesson load failed: " + (e && e.message ? e.message : e));
  }
}

function bindEvents() {
  const controller = new AbortController();
  const { signal } = controller;

  el = $("hskLevel"); if (el) el.addEventListener("change", async function(e) {
    state.lv = Number(e.target.value || 1);
    showListMode();
    await loadLessons();
    updateProgressBlock();
  }, { signal });

  el = $("hskVersion"); if (el) el.addEventListener("change", async function(e) {
    const ver = (window.HSK_LOADER && typeof window.HSK_LOADER.normalizeVersion === "function" ? window.HSK_LOADER.normalizeVersion(e.target.value) : null) || (e.target.value === "hsk3.0" ? "hsk3.0" : "hsk2.0");
    state.version = ver;
    try { if (window.HSK_LOADER && typeof window.HSK_LOADER.setVersion === "function") window.HSK_LOADER.setVersion(ver); } catch (err) {}
    await loadLessons();
    updateProgressBlock();
    if (state.current && state.current.lessonData) {
      const { lessonNo, file } = state.current;
      await openLesson({ lessonNo, file });
    } else {
      showListMode();
    }
  }, { signal });

  el = $("hskBackToList"); if (el) el.addEventListener("click", function() {
    showListMode();
    el = $("hskLessonListWrap"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, { signal });

  // Review Mode 入口
  function enterReviewMode(mode, lessonId = "", levelKey = "") {
    const container = $("hskReviewContainer");
    if (!container || !renderReviewMode) return;
    const { session, questions } = prepareReviewSession({ mode, lessonId, levelKey });
    if (!questions.length) {
      container.innerHTML = `<div class="review-empty-state p-4"><p>${escapeHtml(i18n.t("review_no_wrong_questions"))}</p></div>`;
      container.classList.remove("hidden");
      return;
    }
    container.classList.remove("hidden");
    const doRender = () => {
      const { session: s, questions: qs } = prepareReviewSession({ mode, lessonId, levelKey });
      if (!qs.length) {
        container.innerHTML = `<div class="review-empty-state p-4"><p>${escapeHtml(i18n.t("review_no_wrong_questions"))}</p></div>`;
        return;
      }
      renderReviewMode(container, s, {
        lang: getLang(),
        onFinish: ({ action }) => {
          if (action === "back") {
            container.classList.add("hidden");
            container.innerHTML = "";
          } else if (action === "continue") {
            doRender();
          }
        },
      });
    };
    doRender();
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  el = $("hskReviewLesson"); if (el) el.addEventListener("click", function() {
    const lessonId = (state.current && state.current.lessonData && state.current.lessonData.id) || (state.current ? getCourseId() + "_lesson" + state.current.lessonNo : "");
    if (!lessonId) {
      const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), (state.lessons && state.lessons.length) || 0) : null) || {};
      const lastNo = stats.lastLessonNo || 1;
      enterReviewMode("lesson", `${getCourseId()}_lesson${lastNo}`);
    } else {
      enterReviewMode("lesson", lessonId);
    }
  }, { signal });

  el = $("hskReviewLevel"); if (el) el.addEventListener("click", function() {
    enterReviewMode("level", "", getCourseId());
  }, { signal });

  el = $("hskReviewAll"); if (el) el.addEventListener("click", function() {
    enterReviewMode("all");
  }, { signal });

  el = $("hskReviewBtn"); if (el) el.addEventListener("click", function() {
    const lessonId = (state.current && state.current.lessonData && state.current.lessonData.id) || (state.current ? getCourseId() + "_lesson" + state.current.lessonNo : "");
    enterReviewMode("lesson", lessonId);
  }, { signal });

  // Lesson click (delegate)
  el = $("hskLessonList"); if (el) el.addEventListener("click", function(e) {
    const btn = e.target.closest('button[data-open-lesson="1"]');
    if (!btn) return;
    const lessonNo = Number(btn.dataset.lessonNo || 1);
    const file = btn.dataset.file || "";
    openLesson({ lessonNo, file });
  }, { signal });

  // 点读：会话 / 扩展 / 语法 / 练习区点击中文
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-speak-text][data-speak-kind='dialogue'], [data-speak-text][data-speak-kind='extension'], [data-speak-text][data-speak-kind='grammar'], [data-speak-text][data-speak-kind='practice']");
    if (!el) return;
    const text = (el.dataset && el.dataset.speakText || "").trim();
    if (!text || !(AUDIO_ENGINE && typeof AUDIO_ENGINE.isSpeechSupported === "function" && AUDIO_ENGINE.isSpeechSupported())) return;
    e.preventDefault();
    e.stopPropagation();
    AUDIO_ENGINE.stop();
    document.querySelectorAll(".is-speaking").forEach((x) => x.classList.remove("is-speaking"));
    const lineEl = el.closest(".lesson-dialogue-line") || el.closest(".lesson-extension-card") || el.closest(".lesson-extension-group-card") || el.closest(".lesson-grammar-card") || el.closest(".review-grammar-row") || el.closest(".lesson-practice-card") || el.closest(".review-question-card") || el.closest(".lesson-practice-option");
    if (lineEl) lineEl.classList.add("is-speaking");
    AUDIO_ENGINE.playText(text, {
      lang: "zh-CN",
      onEnd: function() { if (lineEl) lineEl.classList.remove("is-speaking"); },
      onError: function() { if (lineEl) lineEl.classList.remove("is-speaking"); },
    });
  }, { signal });

  // Tabs
  el = $("hskStudyTabs"); if (el) el.addEventListener("click", function(e) {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    updateTabsUI();

    const step = state.tab === "ai" ? "aiPractice" : state.tab;
    if (state.current && state.current.lessonData) {
      const courseId = getCourseId();
      const lessonId = (state.current.lessonData && state.current.lessonData.id) || (courseId + "_lesson" + state.current.lessonNo);
      if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.markStepCompleted === "function") PROGRESS_ENGINE.markStepCompleted({ courseId: courseId, lessonId: lessonId, step: step });
      updateProgressBlock();
    }

    if (state.tab === "ai") {
      // keep it light; user can click copy
    }
  }, { signal });

  // Search filter (client-side)
  el = $("hskSearch"); if (el) el.addEventListener("input", function() {
    const q = String(($("hskSearch") && $("hskSearch").value) || "").trim().toLowerCase();
    const lang = getLang();
    const listEl = $("hskLessonList");
    if (!listEl) return;

    const filtered = !q
      ? state.lessons
      : state.lessons.filter((it) => {
          const title = JSON.stringify((it && it.title) || (it && it.name) || "").toLowerCase();
          const pinyin = String((it && it.pinyinTitle) || (it && it.pinyin) || "").toLowerCase();
          const file = String((it && it.file) || "").toLowerCase();
          return title.includes(q) || pinyin.includes(q) || file.includes(q);
        });

    const total = (state.lessons && state.lessons.length) || 0;
    const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total) : null) || {};
    renderLessonList(listEl, filtered, { lang: lang, currentLessonNo: stats.lastLessonNo || 0 });
  }, { signal });

  // AI: 新 aiTutorPanel 内部自处理 copy/send，此处不再绑定旧 #hskAICopyContext / #hskAISend / #hskAIInput

  // joy:langChanged — 统一事件名，state-driven 全量重渲染
  window.addEventListener("joy:langChanged", (e) => {
    const newLang = (e && e.detail && e.detail.lang) || getLang();
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[HSK] joy:langChanged received ->", newLang);
    }
    if (!isHSKPageActive()) return;

    refreshBlueprintDisplayTitles(state.lessons, newLang);
    if (state.current && state.current.lessonData && state.current.lessonData.blueprintTitle != null) {
      state.current.lessonData.displayTitle = resolveBlueprintTitle(state.current.lessonData.blueprintTitle, newLang);
    }

    try { i18n.apply(document); } catch {}
    setSubTitle();
    rerenderHSKFromState();
  }, { signal });

  // i18n bus
  try {
    if (i18n && typeof i18n.on === "function") i18n.on("change", function() { window.dispatchEvent(new CustomEvent("joy:langChanged", { detail: { lang: i18n?.getLang?.() } })); });
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

  // ✅ 预加载 glossary（HSK1 的 kr/en/jp），供词卡释义回退
  const scope = `hsk${state.lv}`;
  loadGlossary("kr", scope).catch(() => {});
  loadGlossary("en", scope).catch(() => {});
  loadGlossary("jp", scope).catch(() => {});

  // ✅ mini nav: Home + Lang only
  navRoot.dataset.mode = "mini";
  mountNavBar(navRoot);

  app.innerHTML = getHSKLayoutHTML();

  // init controls — sync version from localStorage（仅允许 hsk2.0 / hsk3.0）
  const savedVer = localStorage.getItem("hsk_vocab_version") || state.version;
  state.version = (window.HSK_LOADER && typeof window.HSK_LOADER.normalizeVersion === "function" ? window.HSK_LOADER.normalizeVersion(savedVer) : null) || (savedVer === "hsk3.0" ? "hsk3.0" : "hsk2.0");
  $("hskLevel") && ($("hskLevel").value = String(state.lv));
  $("hskVersion") && ($("hskVersion").value = String(state.version));

  try { i18n.apply(document); } catch {}

  bindWordCardActions();
  bindEvents();
  await loadLessons();
  showListMode();
  return true;
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
  try { return JSON.stringify(v); } catch { return String(v); }
}
