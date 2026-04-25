// HSK 页面壳：列表/学习模式、副标题/错误、tab 显隐、进度区（从 page.hsk.js 抽离，行为不变）
// 《Lumina HSK 页面巨石文件拆分 Step 4》
import { i18n } from "../../i18n.js";
import { escapeHtml } from "./hskPageUtils.js";
import { PROGRESS_SELECTORS, stopAllLearningAudio } from "../../platform/index.js";

/**
 * @typedef {Object} HskPageChromeCtx
 * @property {(id: string) => HTMLElement | null} $
 * @property {object} state
 * @property {() => string} getCourseId
 */

export function setError(ctx, msg = "") {
  const { $ } = ctx;
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

export function clearError(ctx) {
  setError(ctx, "");
}

export function setSubTitle(ctx) {
  const { $, state } = ctx;
  const sub = $("hskSubTitle");
  if (!sub) return;
  sub.textContent = `HSK ${state.lv} · ${state.version}`;
}

export function updateTabsLabels(ctx) {
  const { $ } = ctx;

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

export function updateProgressBlock(ctx) {
  const { $, state, getCourseId } = ctx;
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

export function showStudyMode(ctx, titleText = "") {
  const { $ } = ctx;
  const listWrap = $("hskLessonListWrap");
  const studyBar = $("hskStudyBar");
  const studyPanels = $("hskStudyPanels");
  const titleEl = $("hskStudyTitle");

  if (listWrap) listWrap.classList.add("hidden");
  if (studyBar) studyBar.classList.remove("hidden");
  if (studyPanels) studyPanels.classList.remove("hidden");
  if (titleEl) titleEl.textContent = titleText || "";
}

export function showListMode(ctx) {
  const { $, state } = ctx;
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
  updateTabsUI(ctx);
}

export function updateTabsUI(ctx) {
  const { $, state } = ctx;
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
