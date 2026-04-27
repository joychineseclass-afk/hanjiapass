// /ui/pages/hsk/hskPracticeTab.js
// HSK Practice tab mount/rerender + display bridge + speak segments
// (split from page.hsk.js Step 6).
//
// Responsibilities:
// - mountHskPractice / rerenderHskPractice  (thin wrappers around practiceRenderer)
// - applyChoiceDisplayToQuestionList + per-option display patching
// - hydratePracticeDisplayBridge (sync __displayText into renderer-visible fields)
// - buildPracticeSpeakSegmentsUnified (for HSK3.0 HSK1 TTS chain)
// - resolvePracticeQuestionsForSpeak
//
// NOTE: business rules, validation and scoring are untouched.

import * as PracticeState from "../../modules/practice/practiceState.js";
import {
  mountPractice as mountPracticeFromEngine,
  rerenderPractice as rerenderPracticeFromEngine,
} from "../../modules/practice/practiceRenderer.js";
import {
  resolveChoiceDisplayKindWithInfer,
  stemTextWithFallback,
} from "../../modules/hsk/practiceDisplayStrategy.js";
import {
  collectLessonPinyinToHanziMap,
  resolvePinyinDisplayToSpeakZh,
} from "../../utils/hsk30UiMeaningMixedTts.js";
import {
  trimStr,
  isShortMeaning,
  getControlledLangText,
  normalizePracticeLangAliases,
  practiceLangKeyFromUiLang,
  abbrPracticeItemForLog,
} from "./hskPageUtils.js";

export { abbrPracticeItemForLog as _abbrPracticeItemForLog };

/* ------------------------------- display patch ------------------------------- */

/** Clear __displayText patch on all questions' options. */
export function restoreHskChoiceOptionDisplayPatch() {
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

/** Sync __displayText → renderer-visible language field. */
function syncPracticeOptionDisplayFields(options, langKey) {
  if (!Array.isArray(options)) return;
  const lk = normalizePracticeLangAliases(langKey);

  for (const o of options) {
    if (!o || typeof o !== "object") continue;
    const text = trimStr(o.__displayText);
    if (!text) continue;

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

function syncPracticeQuestionDisplayFields(question, langKey) {
  if (!question || typeof question !== "object") return;
  const opts = Array.isArray(question.options) ? question.options : [];
  syncPracticeOptionDisplayFields(opts, langKey);
}

function syncPracticeQuestionListDisplayFields(questions, langKey) {
  if (!Array.isArray(questions)) return;
  for (const q of questions) {
    syncPracticeQuestionDisplayFields(q, langKey);
  }
}

/** Re-apply display mode + sync to renderer-visible fields. */
function refreshPracticeDisplayOnly(currentQuestions, langKey) {
  if (!Array.isArray(currentQuestions)) return;

  for (const q of currentQuestions) {
    const opts = Array.isArray(q.options) ? q.options : [];
    for (const o of opts) {
      if (!o || typeof o !== "object") continue;
      delete o.__displayText;
      delete o.__displayLang;
    }
  }

  applyChoiceDisplayToQuestionList(currentQuestions, langKey);
  syncPracticeQuestionListDisplayFields(currentQuestions, langKey);
}

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

/** Unified entry: mount / rerender uses this. */
export function hydratePracticeDisplayBridge(questions, langKey) {
  if (!Array.isArray(questions)) return;
  refreshPracticeDisplayOnly(questions, langKey);
  syncPracticeStemDisplayList(questions, langKey);
}

/* ---------------------------- stem & option text ---------------------------- */

export function practiceStemDisplayText(q, langKey) {
  const stem = stemTextWithFallback(getControlledLangText, q, langKey);
  return normalizeResponseStylePrompt(stem, q, langKey);
}

function normalizeResponseStylePrompt(stem, q, langKey) {
  const text = trimStr(stem);
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

/** Short meaning for compact option display. */
function pickShortMeaningForOption(orig, langKey) {
  if (!orig || typeof orig !== "object") return "";

  const m = orig.meaning;
  if (m && typeof m === "object") {
    const v = getControlledLangText(m, langKey, "meaning");
    if (isShortMeaning(v)) return v;
    if (trimStr(v)) return v;
  }

  const g = orig.gloss;
  if (g && typeof g === "object") {
    const v = getControlledLangText(g, langKey, "gloss");
    if (isShortMeaning(v)) return v;
    if (trimStr(v)) return v;
  }

  return "";
}

/** Sentence translation for option (sentence_translation kind). */
function pickSentenceTranslationForOption(orig, langKey) {
  if (!orig || typeof orig !== "object") return "";

  const t = orig.translation ?? orig.translations ?? orig.trans;
  if (t && typeof t === "object") {
    const v = getControlledLangText(t, langKey, "translation");
    if (trimStr(v)) return v;
  }

  return "";
}

/** Coerce string options to objects (so later patches are uniform). */
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
  o.__displayText = text || "";
  o.__displayLang = langKey;
}

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

/** Apply display-kind patch across all questions. */
export function applyChoiceDisplayToQuestionList(questions, langKey) {
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

/** Filter obviously unrenderable questions (empty stem; choice with < 2 options). */
export function isQuestionStructurallyRenderable(q, langKey) {
  const stem = practiceStemDisplayText(q, langKey);
  if (!stem) return false;
  const t = String(q.type || "choice").toLowerCase();
  if (t === "choice") {
    return Array.isArray(q.options) && q.options.length >= 2;
  }
  return true;
}

export function _structuralDropReason(q, langKey) {
  const stem = practiceStemDisplayText(q, langKey);
  if (!stem) return "empty stem after system-lang + fallback (prompt/question)";
  const t = String(q.type || "choice").toLowerCase();
  if (t === "choice" && (!Array.isArray(q.options) || q.options.length < 2)) {
    return `choice needs options.length >= 2, got ${Array.isArray(q.options) ? q.options.length : "none"}`;
  }
  return "unknown";
}

/** Clone lesson.practice + apply display + drop structurally-unrenderable items. */
export function buildLessonWithClonedPracticeForDisplay(lesson, langKey) {
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
        if (typeof o === "string") return trimStr(o).length > 0;
        if (!o || typeof o !== "object") return false;
        return trimStr(o.__displayText || o.cn || o.zh || o.kr || o.en || "").length > 0;
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

/* ---------------------------- mount / rerender ---------------------------- */

/** Practice mount: build language-safe question pool, then delegate to engine. */
export function mountHskPractice(container, opts) {
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
      firstTwoFinal: Array.isArray(fp) ? fp.slice(0, 2).map(abbrPracticeItemForLog) : [],
    });
  } catch (e) {
    console.warn("[HSK-PRACTICE-MOUNT] log failed:", e?.message || e);
  }

  mountPracticeFromEngine(container, {
    ...(opts || {}),
    lesson: lessonForPractice,
  });
}

/** Practice rerender: only re-apply display; never rebuild pool. */
export function rerenderHskPractice(container, lang) {
  if (!container) return;

  const langKey = practiceLangKeyFromUiLang(lang);

  restoreHskChoiceOptionDisplayPatch();

  const currentQuestions = PracticeState.getQuestions();
  if (Array.isArray(currentQuestions) && currentQuestions.length) {
    hydratePracticeDisplayBridge(currentQuestions, langKey);
  }

  rerenderPracticeFromEngine(container, lang);
}

/** Panel render entry used by page.hsk.js (wraps mount). */
export function renderHskPracticeTab(container, ctx) {
  if (!container) return;
  const { lessonData, lang } = ctx || {};
  mountHskPractice(container, { lesson: lessonData, lang });
}

/* ------------------------------ speak segments ------------------------------ */

/** Pinyin-option → zh speak text via hsk30UiMeaningMixedTts. */
export function resolvePracticeTextToSpeakZh(rawDisplay, optionObj, map) {
  return resolvePinyinDisplayToSpeakZh(rawDisplay, optionObj, map);
}

function buildPracticeMatchSpeakSegments(q, langKey, pinyinHanziMap) {
  const str = (v) => trimStr(v);
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

/**
 * Unified practice speak segments (stem + options/items + explanation).
 * `opts.useHsk30Hsk1Pilot` enables pinyin → hanzi mapping for TTS.
 */
export function buildPracticeSpeakSegmentsUnified(q, langKey, lessonData, opts = {}) {
  const str = (v) => trimStr(v);
  const type = String(q.type || "choice").toLowerCase();
  const usePinyinMap =
    opts.useHsk30Hsk1Pilot && lessonData && typeof lessonData === "object";
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
    const expTxt = getControlledLangText(expl, langKey, "practice explanation");
    if (expTxt) segs.push({ ui: expTxt });
  }

  return segs;
}

/** Resolve practice questions for TTS — prefer already-mounted state. */
export async function resolvePracticeQuestionsForSpeak(lesson) {
  const cached = PracticeState.getQuestions();
  if (Array.isArray(cached) && cached.length) return cached;
  const { filterSupportedQuestions } = await import("../../modules/practice/practiceSchema.js");
  const { applyStudentStrategy } = await import("../../modules/practice/practiceStrategy.js");
  const ld = lesson?._raw || lesson;
  const rawPractice = Array.isArray(ld?.practice) ? ld.practice : [];
  const filtered = filterSupportedQuestions(rawPractice);
  const raw = String(ld?.level ?? ld?.courseId ?? "");
  const m = raw.match(/(\d+)/);
  const level = m ? "hsk" + Math.min(4, Math.max(1, parseInt(m[1], 10))) : "hsk1";
  return applyStudentStrategy(filtered, level, ld?.type === "review");
}
