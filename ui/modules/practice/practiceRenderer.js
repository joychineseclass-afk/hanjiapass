/**
 * Practice Engine v1 - 统一渲染入口
 * 根据 type 分发到 choice / fill / match / order
 */

import { i18n } from "../../i18n.js";
import * as PracticeEngine from "./practiceEngine.js";
import * as PracticeState from "./practiceState.js";
import { renderChoice } from "./practiceChoice.js";
import { renderFill } from "./practiceFill.js";
import { renderMatch } from "./practiceMatch.js";
import { renderOrder } from "./practiceOrder.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function t(key, params) {
  return i18n?.t?.(key, params) ?? key;
}

function renderQuestion(q, index, { lang, answers, resultMap, submitted }) {
  const type = String(q.type || "choice").toLowerCase();
  if (type === "choice") return renderChoice(q, index, { lang, answers, resultMap, submitted });
  if (type === "fill") return renderFill(q, index, { lang, answers, resultMap, submitted });
  if (type === "match") return renderMatch(q, index, { lang, answers, resultMap, submitted });
  if (type === "order") return renderOrder(q, index, { lang, answers, resultMap, submitted });
  return renderChoice(q, index, { lang, answers, resultMap, submitted });
}

/** 按 section 分组渲染（review lesson 显示 Vocabulary / Grammar / Sentences 标题） */
function buildQuestionsHtmlWithSections(questions, { lang, answers, resultMap, submitted }) {
  const hasSections = questions.some((q) => q.section);
  if (!hasSections) {
    return questions.map((q, i) => renderQuestion(q, i, { lang, answers, resultMap, submitted })).join("");
  }

  const SECTION_ORDER = ["vocabulary", "grammar", "sentences"];
  const sectionLabels = {
    vocabulary: t("practice.section.vocabulary") || "Vocabulary",
    grammar: t("practice.section.grammar") || "Grammar",
    sentences: t("practice.section.sentences") || "Sentences",
  };

  let html = "";
  let globalIndex = 0;
  for (const sectionKey of SECTION_ORDER) {
    const sectionQuestions = questions.filter((q) => q.section === sectionKey);
    if (!sectionQuestions.length) continue;

    const label = sectionLabels[sectionKey] || sectionKey;
    html += `<div class="lesson-practice-section" data-section="${escapeHtml(sectionKey)}">
      <h4 class="lesson-practice-section-title">${escapeHtml(label)}</h4>
      <div class="lesson-practice-section-questions">`;

    for (const q of sectionQuestions) {
      html += renderQuestion(q, globalIndex, { lang, answers, resultMap, submitted });
      globalIndex += 1;
    }

    html += `</div></div>`;
  }

  return html;
}

export function mountPractice(container, { lesson, lang = "ko", onComplete } = {}) {
  if (!container) return;

  const { questions, totalScore } = PracticeEngine.loadPractice(lesson);
  if (!questions.length) {
    container.innerHTML = `<div class="lesson-practice-empty">${t("practice.empty")}</div>`;
    return;
  }

  const langKey = lang === "zh" || lang === "cn" ? "cn" : lang === "en" ? "en" : lang === "jp" || lang === "ja" ? "jp" : "kr";

  function render() {
    const answers = PracticeState.getAnswers();
    const submitted = PracticeState.isSubmitted();
    const resultMap = PracticeState.getResultMap();
    const score = PracticeState.getScore();

    const questionsHtml = buildQuestionsHtmlWithSections(questions, {
      lang: langKey,
      answers,
      resultMap,
      submitted,
    });

    const scoreLabel = submitted
      ? t("practice.total_score", { score, total: totalScore })
      : t("practice.total_count", { n: questions.length });

    const submitBtnHtml = !submitted
      ? `<button type="button" class="lesson-practice-submit">${t("practice.submit")}</button>`
      : "";

    const hero = `
<section class="lesson-section-hero lesson-practice-hero">
  <h3 class="lesson-section-title">${escapeHtml(t("hsk.section.practice") || t("practice.title"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(t("hsk.desc.practice") || t("practice.subtitle"))}</p>
  <div class="lesson-practice-summary">${escapeHtml(scoreLabel)}</div>
  ${submitBtnHtml ? `<div class="lesson-practice-submit-wrap">${submitBtnHtml}</div>` : ""}
</section>`;

    container.innerHTML = `
<div class="lesson-practice-fullpage">
  ${hero}
  <section class="lesson-practice-list">${questionsHtml}</section>
  ${submitBtnHtml ? `<div class="lesson-practice-footer">${submitBtnHtml}</div>` : ""}
</div>`;
  }

  function collectPendingAnswers() {
    container.querySelectorAll(".practice-fill-input, .practice-order-input").forEach((input) => {
      const qid = input.dataset.questionId;
      if (!qid) return;
      const val = input.value.trim();
      if (input.classList.contains("practice-order-input")) {
        const arr = val ? val.split(/[\s,，、]+/).filter(Boolean) : [];
        PracticeState.setAnswer(qid, arr.length ? arr : val);
      } else {
        PracticeState.setAnswer(qid, val);
      }
    });
    container.querySelectorAll(".practice-match-card").forEach((card) => {
      const qid = card.dataset.questionId;
      if (!qid) return;
      const allSelects = card.querySelectorAll(".practice-match-select");
      const pairs = [];
      allSelects.forEach((s) => {
        const l = s.dataset.left;
        const r = s.value;
        if (l && r) pairs.push([l, r]);
      });
      if (pairs.length) PracticeState.setAnswer(qid, pairs);
    });
  }

  container.addEventListener("click", (e) => {
    const submitBtn = e.target.closest(".lesson-practice-submit");
    if (submitBtn && !PracticeState.isSubmitted()) {
      collectPendingAnswers();
      const { score, correctCount, wrongItems } = PracticeEngine.submitAll();
      if (onComplete && !container.dataset.progressRecorded) {
        container.dataset.progressRecorded = "1";
        onComplete({ total: questions.length, correct: correctCount, score, lesson, wrongItems: wrongItems || [] });
      }
      render();
      return;
    }

    const optionBtn = e.target.closest(".practice-option") || e.target.closest(".lesson-practice-option");
    if (optionBtn && !PracticeState.isSubmitted()) {
      const qid = optionBtn.dataset.questionId;
      const answer = optionBtn.dataset.answer;
      if (qid && answer !== undefined) {
        const card = optionBtn.closest(".lesson-practice-card");
        if (card) {
          card.querySelectorAll(".practice-option, .lesson-practice-option").forEach((b) => {
            b.classList.remove("is-selected", "option-selected");
          });
          optionBtn.classList.add("is-selected", "option-selected");
        }
        PracticeState.setAnswer(qid, answer);
      }
    }
  });

  container.addEventListener("input", (e) => {
    if (PracticeState.isSubmitted()) return;
    const input = e.target.closest(".practice-fill-input, .practice-order-input");
    if (!input) return;
    const qid = input.dataset.questionId;
    if (!qid) return;
    const val = input.value.trim();
    if (input.classList.contains("practice-order-input")) {
      const arr = val ? val.split(/[\s,，、]+/).filter(Boolean) : [];
      PracticeState.setAnswer(qid, arr.length ? arr : val);
    } else {
      PracticeState.setAnswer(qid, val);
    }
  });

  container.addEventListener("change", (e) => {
    if (PracticeState.isSubmitted()) return;
    const select = e.target.closest(".practice-match-select");
    if (!select) return;
    const qid = select.dataset.questionId;
    const card = select.closest(".practice-match-card");
    if (!qid || !card) return;
    const allSelects = card.querySelectorAll(".practice-match-select");
    const pairs = [];
    allSelects.forEach((s) => {
      const l = s.dataset.left;
      const r = s.value;
      if (l && r) pairs.push([l, r]);
    });
    PracticeState.setAnswer(qid, pairs);
  });

  render();
}

export function rerenderPractice(container, lang = "ko") {
  if (!container) return;
  const questions = PracticeState.getQuestions();
  if (!questions.length) return;

  const langKey = lang === "zh" || lang === "cn" ? "cn" : lang === "en" ? "en" : lang === "jp" || lang === "ja" ? "jp" : "kr";
  const answers = PracticeState.getAnswers();
  const submitted = PracticeState.isSubmitted();
  const resultMap = PracticeState.getResultMap();
  const totalScore = PracticeState.getTotalScore();
  const score = PracticeState.getScore();

  const questionsHtml = buildQuestionsHtmlWithSections(questions, {
    lang: langKey,
    answers,
    resultMap,
    submitted,
  });

  const scoreLabel = submitted
    ? t("practice.total_score", { score, total: totalScore })
    : t("practice.total_count", { n: questions.length });

  const submitBtnHtml = !submitted
    ? `<button type="button" class="lesson-practice-submit">${t("practice.submit")}</button>`
    : "";

  const hero = `
<section class="lesson-section-hero lesson-practice-hero">
  <h3 class="lesson-section-title">${escapeHtml(t("hsk.section.practice") || t("practice.title"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(t("hsk.desc.practice") || t("practice.subtitle"))}</p>
  <div class="lesson-practice-summary">${escapeHtml(scoreLabel)}</div>
  ${submitBtnHtml ? `<div class="lesson-practice-submit-wrap">${submitBtnHtml}</div>` : ""}
</section>`;

  container.innerHTML = `
<div class="lesson-practice-fullpage">
  ${hero}
  <section class="lesson-practice-list">${questionsHtml}</section>
  ${submitBtnHtml ? `<div class="lesson-practice-footer">${submitBtnHtml}</div>` : ""}
</div>`;
}
