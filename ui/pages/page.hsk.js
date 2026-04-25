// /ui/pages/page.hsk.js
// HSK Page - cleaned incremental version
// Strategy:
// 1) Keep page skeleton stable
// 2) Fix practice pipeline step by step
// 3) Avoid mutating validation logic
// 4) Keep extension meaning/explanation separated

import { i18n } from "../i18n.js";
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
} from "../modules/hsk/hskRenderer.js";
import {
  buildLessonReviewData,
  renderLessonReviewHTML,
} from "../modules/hsk/hskLessonReview.js";
import { loadGlossary } from "../utils/glossary.js";
import {
  IMAGE_ENGINE,
  SCENE_ENGINE,
  PROGRESS_ENGINE,
  PROGRESS_SELECTORS,
  stopAllLearningAudio,
} from "../platform/index.js";
import { addWrongItems, addRecentItem } from "../modules/review/reviewEngine.js";
import * as SceneRenderer from "../platform/scene/sceneRenderer.js";

// Step 1 split — HSK tab modules (see task: 《Lumina HSK 页面巨石文件拆分 Step 1》)
// Step 2 split — 事件整体抽离 (see task: 《Lumina HSK 页面巨石文件拆分 Step 2》)
// Step 3 split — 课程加载 (see task: 《Lumina HSK 页面巨石文件拆分 Step 3》)
import {
  loadHskLessons,
  openHskLesson,
  getLessonNumber,
  refreshBlueprintDisplayTitles as refreshBlueprintDisplayTitlesImpl,
  resolveBlueprintTitle as resolveBlueprintTitleImpl,
} from "./hsk/hskLessonLoad.js";
import { bindHskPageEvents, abortHskPageEvents } from "./hsk/hskBindEvents.js";
import { renderHskWordsTab } from "./hsk/hskWordsTab.js";
import { renderHskDialogueTab } from "./hsk/hskDialogueTab.js";
import { renderHskGrammarTab } from "./hsk/hskGrammarTab.js";
import { renderHskExtensionTab } from "./hsk/hskExtensionTab.js";
import { renderHskPracticeTab } from "./hsk/hskPracticeTab.js";
import { renderHskAiTab } from "./hsk/hskAiTab.js";
export { abortHskPageEvents as abortHskBoundEvents };

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

function buildLessonLoadCtx() {
  return {
    state,
    $,
    getLang,
    getEngineLang,
    getCourseId,
    setError,
    setSubTitle,
    updateProgressBlock,
    lessonIsReview,
    showStudyMode,
    updateLessonContextWindow,
    touchLessonVocabSafe,
    renderHSKTabsIntoDOM,
    renderLessonCover,
    renderLessonSceneSection,
    markLessonStartedSafe,
    updateTabsUI,
  };
}

async function loadLessons() {
  return loadHskLessons(buildLessonLoadCtx());
}

async function openLesson(params = {}) {
  return openHskLesson(buildLessonLoadCtx(), params.lessonNo, { file: params.file });
}

function refreshBlueprintDisplayTitles(lessons, lang, version, lv) {
  return refreshBlueprintDisplayTitlesImpl(lessons, lang, version, lv, getLang);
}

function resolveBlueprintTitle(titleObj, lang) {
  return resolveBlueprintTitleImpl(titleObj, lang, getLang);
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
 * 事件：见 `hsk/hskBindEvents.js` 的 `bindHskPageEvents(ctx)`（在 mount 内注入 ctx 调用；对外 abort 为 `export { abortHskPageEvents as abortHskBoundEvents }`）
 */


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
  bindHskPageEvents({
    $,
    state,
    getLang,
    getCourseId,
    loadLessons,
    openLesson,
    showListMode,
    updateProgressBlock,
    updateTabsUI,
    shouldUseCompactLearnVocabLayout,
    shouldUseHsk30Hsk1SpeakPilot,
    isHSKPageActive,
    refreshBlueprintDisplayTitles,
    resolveBlueprintTitle,
    setSubTitle,
    rerenderHSKFromState,
  });

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
