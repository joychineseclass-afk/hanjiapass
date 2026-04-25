// HSK 课程目录 / 单课加载 / 词表分布 / blueprint 标题 / review 合并
// 从 page.hsk.js 整块抽离，行为不变。见《Lumina HSK 页面巨石文件拆分 Step 3》
import { i18n } from "../../i18n.js";
import { buildLearnerResumeEntryHash, recordLearnerResume } from "../../learner/luminaLearnerResume.js";
import { getLocalizedLessonHeading } from "../../core/languageEngine.js";
import { ensureHSKDeps } from "../../modules/hsk/hskDeps.js";
import { loadBlueprint } from "../../modules/curriculum/blueprintLoader.js";
import {
  distributeVocabulary,
  distributeVocabularyByMap,
  auditVocabularyCoverage,
} from "../../modules/curriculum/vocabDistributor.js";
import { practiceLangKeyFromUiLang, escapeHtml, abbrPracticeItemForLog } from "./hskPageUtils.js";
import { LESSON_ENGINE, PROGRESS_SELECTORS, stopAllLearningAudio } from "../../platform/index.js";
import {
  renderLessonList,
  wordKey,
  selectHskWordPanelVocabulary,
  deriveRegularLessonPanelWordList,
  collectRegularLessonPanelHanziKeys,
} from "../../modules/hsk/hskRenderer.js";

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

const _vocabDistCache = new Map();
const _vocabMapCache = new Map();

export function getLessonNumber(lesson) {
  if (!lesson || typeof lesson !== "object") return 0;
  return (
    Number(
      lesson.lessonNo ?? lesson.no ?? lesson.id ?? lesson.lesson ?? lesson.index ?? 0
    ) || 0
  );
}

/** Lumina HSK 3.0 一级第 21–22 课为正式课；与 1–20 课相同，保留 lessons.json 的多语言 title / displayTitle，不走旧版复习课 blueprint·theme 覆盖。 */
export function regularLessonMaxNoForTitleOverlay(version, lv) {
  return String(version || "").toLowerCase() === "hsk3.0" && Number(lv) === 1 ? 22 : 20;
}

export function isRegularLessonSkippingPedagogyTitleOverlay(lesson, version, lv) {
  const no = getLessonNumber(lesson);
  const maxNo = regularLessonMaxNoForTitleOverlay(version, lv);
  return String(lesson?.type || "lesson") !== "review" && no >= 1 && no <= maxNo;
}

/**
 * Blueprint title resolver
 * Strict current language only
 * `getLang` 用于 (lang) 未传时回退
 */
export function resolveBlueprintTitle(titleObj, lang, getLang) {
  if (!titleObj) return "";
  if (typeof titleObj === "string") return titleObj.trim();
  if (typeof titleObj !== "object") return "";

  const l = (lang || (getLang && getLang()) || "").toLowerCase();

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

export function refreshBlueprintDisplayTitles(lessons, lang, version, lv, getLang) {
  if (!Array.isArray(lessons)) return;
  const l = (lang != null && lang !== "" ? lang : getLang && getLang()) || "";

  lessons.forEach((lesson) => {
    if (!lesson || lesson.blueprintTitle == null) return;
    const no = getLessonNumber(lesson);
    if (isRegularLessonSkippingPedagogyTitleOverlay(lesson, version, lv)) return;
    if (lesson && lesson.blueprintTitle != null) {
      const nextDisplayTitle = resolveBlueprintTitle(lesson.blueprintTitle, l, getLang);
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
        } catch { /* */ }
      }
    }
  });
}

export function applyBlueprintTitles(lessons, blueprint, version, lv) {
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

export function applyVocabDistributionTitles(lessons, lessonThemes, version, lv) {
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

/** 合并 coreWords + extraWords（与 hskRenderer 注释对齐；本页内若未再调用可保留） */
export function mergeLessonVocabulary(lesson) {
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

export async function getVocabDistribution(lv, version) {
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

export function sortLessonsByDistributionOrder(lessons, order) {
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

export function applyVocabDistribution(lessons, distribution) {
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

export async function loadVocabMap(levelKey) {
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

/**
 * Lumina HSK：LESSON_ENGINE 拉取原始课件后，统一经 HSK_LOADER.loadLessonDetail 收口（与 data 权威规则一致）。
 */
export async function mergeReviewLessonFromHskLoader(lessonData, lessonNo, file, state, getLang) {
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

/**
 * 课程列表加载 + 词表分布 + blueprint
 */
export async function loadHskLessons(ctx) {
  const {
    state,
    $,
    getLang,
    getCourseId,
    getEngineLang,
    setError,
    setSubTitle,
    updateProgressBlock,
  } = ctx;

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

    let result = lessons;

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
          } catch { /* */ }
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
    refreshBlueprintDisplayTitles(state.lessons, lang, state.version, state.lv, getLang);
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
        engineGetLang: getEngineLang && getEngineLang(),
        lessonsDataSource,
        note:
          lessonsDataSource === "LESSON_ENGINE.loadCourseIndex"
            ? "目录项经 courseLoader.normLessonItem 规范化（与原始 lessons.json 字段可能不完全一致）"
            : lessonsDataSource === "HSK_LOADER.loadLessons"
              ? "目录项来自 HSK_LOADER（含 lessons.json 原始字段 + loader 默认）"
              : "无目录数据",
        lessons: window.__HSK_TITLE_DIAG_LESSONS__,
      });
    } catch { /* */ }

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

export async function ensureHskLessonVocabTargetsByNo(state) {
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

export async function collectPriorRegularLessonHanziSet(lessonNo, _targetsByNo, state) {
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

/**
 * 打开单课：拉取、合并、词表、tab 与封面等（UI 经 ctx 回调由 page 注入）
 * @param {object} options — `{ file?: string }`
 */
export async function openHskLesson(ctx, lessonNo, options = {}) {
  const {
    state,
    $,
    getLang,
    getCourseId,
    setError,
    lessonIsReview,
    showStudyMode,
    updateLessonContextWindow,
    touchLessonVocabSafe,
    renderHSKTabsIntoDOM,
    renderLessonCover,
    renderLessonSceneSection,
    markLessonStartedSafe,
    updateTabsUI,
    updateProgressBlock,
  } = ctx;
  const f = String((options && options.file) != null ? options.file : "");

  stopAllLearningAudio();
  const no = Number(lessonNo || 1) || 1;

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

  lessonData = await mergeReviewLessonFromHskLoader(lessonData, no, f, state, getLang);

  try {
    const raw = loadRes && loadRes.raw;
    const rp = raw && raw.practice;
    console.log("[HSK-PRACTICE-RAW]", {
      lessonId: raw?.id ?? lessonData?.id,
      lessonNo: raw?.lessonNo ?? lessonData?.lessonNo ?? no,
      hasPracticeArray: Array.isArray(rp),
      rawPracticeLength: Array.isArray(rp) ? rp.length : 0,
      firstTwoRaw: Array.isArray(rp) ? rp.slice(0, 2).map(abbrPracticeItemForLog) : [],
    });
    const np = lessonData.practice;
    console.log("[HSK-PRACTICE-NORMALIZED]", {
      lessonId: lessonData.id,
      lessonNo: lessonData.lessonNo,
      normalizedPracticeLength: Array.isArray(np) ? np.length : 0,
      firstTwoNormalized: Array.isArray(np) ? np.slice(0, 2).map(abbrPracticeItemForLog) : [],
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
