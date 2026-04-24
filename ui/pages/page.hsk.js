// /ui/pages/page.hsk.js
// HSK Page - cleaned incremental version
// Strategy:
// 1) Keep page skeleton stable
// 2) Fix practice pipeline step by step
// 3) Avoid mutating validation logic
// 4) Keep extension meaning/explanation separated

import { i18n } from "../i18n.js";
import { buildLearnerResumeEntryHash, recordLearnerResume } from "../learner/luminaLearnerResume.js";
import {
  getLang as getEngineLang,
  getLocalizedLessonHeading,
} from "../core/languageEngine.js";
import { mountNavBar } from "../components/navBar.js";
import { ensureHSKDeps } from "../modules/hsk/hskDeps.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";
import {
  renderLessonList,
  bindWordCardActions,
  wordKey,
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
import { loadGlossary } from "../utils/glossary.js";
import {
  LESSON_ENGINE,
  IMAGE_ENGINE,
  SCENE_ENGINE,
  PROGRESS_ENGINE,
  PROGRESS_SELECTORS,
  AUDIO_ENGINE,
  renderReviewMode,
  prepareReviewSession,
  stopAllLearningAudio,
  playSingleText,
  TTS_SCOPE,
} from "../platform/index.js";
import * as PracticeState from "../modules/practice/practiceState.js";
import { addWrongItems, addRecentItem } from "../modules/review/reviewEngine.js";
import * as SceneRenderer from "../platform/scene/sceneRenderer.js";

// Step 1 split — HSK tab modules (see task: 《Lumina HSK 页面巨石文件拆分 Step 1》)
import { practiceLangKeyFromUiLang } from "./hsk/hskPageUtils.js";
import { renderHskWordsTab } from "./hsk/hskWordsTab.js";
import {
  renderHskDialogueTab,
  getDialogueCards as _getDialogueCards,
  pickDialogueTranslation as _pickDialogueTranslation,
  dialogueSessionIntroTts as _dialogueSessionIntroTts,
} from "./hsk/hskDialogueTab.js";
import {
  renderHskGrammarTab,
  getGrammarPointsArray as _getGrammarPointsArray,
  buildGrammarSpeakSegments as _buildGrammarSpeakSegments,
} from "./hsk/hskGrammarTab.js";
import {
  renderHskExtensionTab,
  getExtensionItemsArray as _getExtensionItemsArray,
  buildExtensionFlatSpeakSegments as _buildExtensionFlatSpeakSegments,
  buildExtensionGroupSpeakSegments as _buildExtensionGroupSpeakSegments,
} from "./hsk/hskExtensionTab.js";
import {
  renderHskPracticeTab,
  mountHskPractice,
  rerenderHskPractice,
  buildPracticeSpeakSegmentsUnified as _buildPracticeSpeakSegmentsUnified,
  resolvePracticeQuestionsForSpeak as _resolvePracticeQuestionsForSpeak,
  _abbrPracticeItemForLog,
} from "./hsk/hskPracticeTab.js";
import { renderHskAiTab } from "./hsk/hskAiTab.js";

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
/** HSK 页内事件：嵌入 / 重复 mount 前先 abort，避免重复监听 */
let hskEventsController = null;

export function abortHskBoundEvents() {
  try {
    hskEventsController?.abort();
  } catch {
    /* */
  }
  hskEventsController = null;
}

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

/** HSK 3.0 · HSK1：会话区「一会话一画布」展示（全课次，与 HSK2.0 无关） */
function shouldUseHsk30Hsk1SceneCanvasDialogue(lessonData) {
  if (String(state.version || "").toLowerCase() !== "hsk3.0") return false;
  if (Number(state.lv) !== 1) return false;
  const raw = (lessonData && lessonData._raw) || lessonData || {};
  const no = Number(raw.lessonNo ?? state.current?.lessonNo ?? 0);
  return no >= 1;
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

function getLang() {
  return normalizeLang(getEngineLang());
}

/**
 * 从 #exam-learning?tab=hsk&... 或 #hsk?... 解析深链，用于首屏直达指定课
 */
function parseHskDeepLinkFromLocation() {
  const raw = String((typeof location !== "undefined" && location.hash) || "");
  const base = raw.split("?")[0].split("&")[0].toLowerCase();
  const q = raw.indexOf("?");
  const sp = q >= 0 ? new URLSearchParams(raw.slice(q + 1)) : new URLSearchParams();

  if (base === "#exam-learning") {
    const tab = String(sp.get("tab") || "hsk").toLowerCase();
    if (tab && tab !== "hsk") {
      return { active: false, ver: null, lv: null, lessonNo: null, file: "" };
    }
  } else if (base !== "#hsk") {
    return { active: false, ver: null, lv: null, lessonNo: null, file: "" };
  }

  const ver = sp.get("ver") || sp.get("version");
  const lvRaw = sp.get("lv") || sp.get("level");
  const lessonRaw = sp.get("lesson") || sp.get("lessonNo") || sp.get("n");
  const file = String(sp.get("file") || "");
  const lv = lvRaw != null && lvRaw !== "" ? Number(lvRaw) : null;
  const lessonNo = lessonRaw != null && lessonRaw !== "" ? Number(lessonRaw) : null;

  const has = Boolean(ver || (lv != null && !Number.isNaN(lv)) || (lessonNo != null && !Number.isNaN(lessonNo)) || file);
  if (!has) return { active: false, ver: null, lv: null, lessonNo: null, file: "" };

  return {
    active: true,
    ver: ver || null,
    lv: lv != null && !Number.isNaN(lv) ? lv : null,
    lessonNo: lessonNo != null && !Number.isNaN(lessonNo) ? lessonNo : null,
    file,
  };
}

function isHSKPageActive() {
  const raw = String((typeof location !== "undefined" && location.hash) || "").toLowerCase();
  const path = String((typeof location !== "undefined" && location.pathname) || "").toLowerCase();
  const base = raw.split("?")[0].split("&")[0];
  if (base === "#hsk") return true;
  if (base === "#exam-learning") {
    const q = raw.indexOf("?");
    let tab = "hsk";
    if (q >= 0) {
      try {
        tab = String(new URLSearchParams(raw.slice(q + 1)).get("tab") || "hsk").toLowerCase();
      } catch {
        tab = "hsk";
      }
    }
    return tab === "hsk";
  }
  if (raw.includes("hsk") && base !== "#exam-learning") return true;
  return path.includes("hsk");
}

function getCourseId() {
  return `${state.version}_hsk${state.lv}`;
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

/** Lumina HSK 3.0 一级第 21–22 课为正式课；与 1–20 课相同，保留 lessons.json 的多语言 title / displayTitle，不走旧版复习课 blueprint·theme 覆盖。 */
function regularLessonMaxNoForTitleOverlay(version, lv) {
  return String(version || "").toLowerCase() === "hsk3.0" && Number(lv) === 1 ? 22 : 20;
}

function isRegularLessonSkippingPedagogyTitleOverlay(lesson, version, lv) {
  const no = getLessonNumber(lesson);
  const maxNo = regularLessonMaxNoForTitleOverlay(version, lv);
  return String(lesson?.type || "lesson") !== "review" && no >= 1 && no <= maxNo;
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

function refreshBlueprintDisplayTitles(lessons, lang, version, lv) {
  if (!Array.isArray(lessons)) return;
  const l = lang || getLang();

  lessons.forEach((lesson) => {
    if (!lesson || lesson.blueprintTitle == null) return;
    const no = getLessonNumber(lesson);
    if (isRegularLessonSkippingPedagogyTitleOverlay(lesson, version, lv)) return;
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

function applyBlueprintTitles(lessons, blueprint, version, lv) {
  if (!Array.isArray(lessons) || !blueprint || typeof blueprint !== "object") {
    return lessons;
  }

  return lessons.map((lesson) => {
    const no = getLessonNumber(lesson);
    if (isRegularLessonSkippingPedagogyTitleOverlay(lesson, version, lv)) return lesson;
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

function applyVocabDistributionTitles(lessons, lessonThemes, version, lv) {
  if (!Array.isArray(lessons) || !lessonThemes || typeof lessonThemes !== "object") {
    return lessons;
  }

  return lessons.map((lesson) => {
    const no = getLessonNumber(lesson);
    if (isRegularLessonSkippingPedagogyTitleOverlay(lesson, version, lv)) return lesson;
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
      result = applyVocabDistributionTitles(
        result,
        vocabDist.lessonThemes,
        state.version,
        state.lv
      );
    }

    const blueprint = await loadBlueprint(`hsk${state.lv}`);
    if (blueprint) {
      result = applyBlueprintTitles(result, blueprint, state.version, state.lv);

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
    refreshBlueprintDisplayTitles(state.lessons, lang, state.version, state.lv);
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

  const titleText = getLocalizedLessonHeading(
    listEntry || lessonData,
    lang,
    listEntry ? lessonData : null
  );

  try {
    const entryHash = buildLearnerResumeEntryHash({
      version: state.version,
      lv: state.lv,
      lessonNo: no,
      file: f,
    });
    recordLearnerResume({
      courseType: "hsk",
      level: String(state.lv),
      lessonId: String(lessonData?.id || `lesson${no}`),
      lessonTitle: titleText,
      lastVisitedAt: new Date().toISOString(),
      entryHash,
    });
  } catch (e) {
    console.warn("[HSK] learner resume record failed", e);
  }

  showStudyMode(titleText);
  updateLessonContextWindow(no);

  const courseId = getCourseId();
  const lessonId = lessonData.id || `${courseId}_lesson${no}`;
  touchLessonVocabSafe(courseId, lessonId, panelWords);

  renderHSKTabsIntoDOM({
    lessonData,
    lessonWords: panelWords,
    lang,
    isReviewLesson,
    lessonNo: no,
  });

  renderLessonCover(lessonData);
  renderLessonSceneSection(lessonData, lang);
  markLessonStartedSafe(lessonData, no);
  updateTabsUI();
  updateProgressBlock();
}

/**
 * 统一把 words / dialogue / grammar / extension / review / practice / ai 各 tab 内容
 * 渲染到现有 DOM 容器。数据全部由 page.hsk.js 预先准备（ctx 模式）。
 */
function renderHSKTabsIntoDOM(params) {
  const { lessonData, lessonWords, lang, isReviewLesson, lessonNo } = params || {};
  const scope = `hsk${state.lv}`;

  const wordsPanel = $("hskPanelWords");
  if (wordsPanel) {
    renderHskWordsTab(wordsPanel, {
      lessonData,
      lessonWords,
      lang,
      scope,
      isReviewLesson,
      isCompactLearnVocabLayout: shouldUseCompactLearnVocabLayout(),
    });
  }

  const dialogueEl = $("hskDialogueBody");
  if (dialogueEl) {
    renderHskDialogueTab(dialogueEl, {
      lessonData,
      lang,
      isReviewLesson,
      isHsk30Hsk1SceneCanvas: shouldUseHsk30Hsk1SceneCanvasDialogue(lessonData),
      isHsk30Hsk1SpeakPilot: shouldUseHsk30Hsk1SpeakPilot(),
    });
  }

  const grammarEl = $("hskGrammarBody");
  if (grammarEl) {
    renderHskGrammarTab(grammarEl, {
      lessonData,
      lessonWords,
      lang,
      isReviewLesson,
      isHsk30Hsk1SpeakPilot: shouldUseHsk30Hsk1SpeakPilot(),
    });
  }

  const extensionEl = $("hskExtensionBody");
  if (extensionEl) {
    renderHskExtensionTab(extensionEl, {
      lessonData,
      lang,
      isReviewLesson,
      isHsk30Hsk1SpeakPilot: shouldUseHsk30Hsk1SpeakPilot(),
    });
  }

  const reviewEl = $("hskReviewBody");
  if (reviewEl) {
    const reviewData = buildLessonReviewData(lessonData, {
      lang,
      lessonWords,
      lessonLevel: lessonData.level,
      lessonVersion: lessonData.version,
      glossaryScope: scope,
    });
    reviewEl.innerHTML = renderLessonReviewHTML(reviewData);
  }

  const practiceEl = $("hskPracticeBody");
  if (practiceEl) {
    renderHskPracticeTab(practiceEl, { lessonData, lang });
  }

  const aiRoot = $("hskAIResult");
  if (aiRoot) {
    renderHskAiTab(aiRoot, {
      lessonData,
      lessonWords,
      lessonNo,
      lessons: state.lessons,
      lang,
    });
  }
}

/**
 * 语言切换等场景：按 state.current 重绘 HSK 学习区（不重新 fetch）。
 * 挂到 window 供 joy:langChanged 事件调用；缺失时会抛 ReferenceError 并中断后续 UI 更新。
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
  const titleText = getLocalizedLessonHeading(
    listEntry || lessonData,
    lang,
    listEntry ? lessonData : null
  );

  showStudyMode(titleText);
  updateLessonContextWindow(no);

  renderHSKTabsIntoDOM({
    lessonData,
    lessonWords,
    lang,
    isReviewLesson,
    lessonNo: no,
  });

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
  abortHskBoundEvents();
  hskEventsController = new AbortController();
  const { signal } = hskEventsController;

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
        const uiLangForDialogue = getLang();
        const tl = buildDialogueBulkTimeline(ld, {
          getDialogueCards: _getDialogueCards,
          pickDialogueTranslation: (line, zh) => _pickDialogueTranslation(line, zh, uiLangForDialogue),
          dialogueSessionIntroTts: (n) => _dialogueSessionIntroTts(n, uiLangForDialogue),
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
        const uiLangForDialogueLoop = getLang();
        const tl = buildDialogueBulkTimeline(ld, {
          getDialogueCards: _getDialogueCards,
          pickDialogueTranslation: (line, zh) => _pickDialogueTranslation(line, zh, uiLangForDialogueLoop),
          dialogueSessionIntroTts: (n) => _dialogueSessionIntroTts(n, uiLangForDialogueLoop),
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
        const pts = _getGrammarPointsArray(raw);
        const pt = pts[gi];
        if (!pt) return;
        const cardEl = gListen.closest(".lesson-grammar-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../modules/hsk/hskRenderer.js");
        const segs = _buildGrammarSpeakSegments(pt, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, {
          lessonForPinyinMap: lessonCtx,
          playbackScope: TTS_SCOPE.GRAMMAR,
        });
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
        const arr = _getExtensionItemsArray(raw);
        const item = arr[fi];
        if (!item) return;
        const cardEl = extFlat.closest(".lesson-extension-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../modules/hsk/hskRenderer.js");
        const segs = _buildExtensionFlatSpeakSegments(item, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, {
          lessonForPinyinMap: lessonCtx,
          playbackScope: TTS_SCOPE.EXTENSION,
        });
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
        const arr = _getExtensionItemsArray(raw);
        const item = arr[gi];
        if (!item) return;
        const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];
        const isGroup = sentences.length > 0 && (item.groupTitle || item.focusGrammar);
        if (!isGroup) return;
        const cardEl = extGroup.closest(".lesson-extension-group-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../modules/hsk/hskRenderer.js");
        const segs = _buildExtensionGroupSpeakSegments(item, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, {
          lessonForPinyinMap: lessonCtx,
          playbackScope: TTS_SCOPE.EXTENSION,
        });
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
        const questions = await _resolvePracticeQuestionsForSpeak(ld);
        const q = questions.find((x) => String(x?.id || "") === qid);
        if (!q) return;
        const langKey = practiceLangKeyFromUiLang(getLang());
        const cardEl = prListen.closest(".lesson-practice-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../modules/hsk/hskRenderer.js");
        const segs = _buildPracticeSpeakSegmentsUnified(q, langKey, ld);
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, {
          lessonForPinyinMap: ld,
          playbackScope: TTS_SCOPE.PRACTICE,
        });
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

      const sk = String(target.dataset.speakKind || "other").toLowerCase();
      const scopeByKind = {
        dialogue: TTS_SCOPE.DIALOGUE,
        extension: TTS_SCOPE.EXTENSION,
        grammar: TTS_SCOPE.GRAMMAR,
        practice: TTS_SCOPE.PRACTICE,
      };
      const scope = scopeByKind[sk] || TTS_SCOPE.OTHER;

      playSingleText(text, {
        scope,
        lang: "zh-CN",
        rate: 0.95,
        beforePlay: () => {
          if (lineEl) lineEl.classList.add("is-speaking");
        },
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
              rerenderHskPractice(practiceEl, getLang());
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

      refreshBlueprintDisplayTitles(state.lessons, newLang, state.version, state.lv);

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
          rerenderHskPractice(practiceEl, newLang);
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

export async function mount(ctx) {
  const opts = ctx && typeof ctx === "object" && !(ctx instanceof HTMLElement) ? ctx : {};
  const embed = opts.embed === true;
  const app = opts.root instanceof HTMLElement ? opts.root : $("app");

  if (!app) {
    console.error("HSK Page Error: missing mount root");
    return false;
  }

  if (!embed) {
    const navRoot = $("siteNav");
    if (!navRoot) {
      console.error("HSK Page Error: missing #siteNav");
      return false;
    }
    navRoot.dataset.mode = "mini";
    mountNavBar(navRoot);
  }

  await ensureHSKDeps();

  const scope = `hsk${state.lv}`;
  loadGlossary("kr", scope).catch(() => {});
  loadGlossary("en", scope).catch(() => {});
  loadGlossary("jp", scope).catch(() => {});

  app.innerHTML = getHSKLayoutHTML();

  const savedVer = localStorage.getItem("hsk_vocab_version") || state.version;
  state.version =
    (window.HSK_LOADER &&
      typeof window.HSK_LOADER.normalizeVersion === "function"
      ? window.HSK_LOADER.normalizeVersion(savedVer)
      : null) ||
    (savedVer === "hsk3.0" ? "hsk3.0" : "hsk2.0");

  const dlv = parseHskDeepLinkFromLocation();
  if (dlv.active) {
    if (dlv.ver) {
      const nv =
        window.HSK_LOADER && typeof window.HSK_LOADER.normalizeVersion === "function"
          ? window.HSK_LOADER.normalizeVersion(dlv.ver)
          : dlv.ver;
      if (nv) {
        state.version = nv;
        try {
          localStorage.setItem("hsk_vocab_version", state.version);
        } catch {
          /* */
        }
      }
    }
    if (dlv.lv != null && !Number.isNaN(dlv.lv)) {
      state.lv = dlv.lv;
    }
  }

  if ($("hskLevel")) $("hskLevel").value = String(state.lv);
  if ($("hskVersion")) $("hskVersion").value = String(state.version);

  try {
    i18n.apply(document);
  } catch {}

  bindWordCardActions();
  bindEvents();

  await loadLessons();
  showListMode();

  if (dlv.active && dlv.lessonNo != null && !Number.isNaN(dlv.lessonNo)) {
    try {
      await openLesson({ lessonNo: dlv.lessonNo, file: dlv.file || "" });
    } catch (e) {
      console.warn("[HSK] deep link open lesson failed", e);
    }
  }

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

