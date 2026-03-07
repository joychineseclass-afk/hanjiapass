/**
 * Review Mode Engine v1 - 渲染器
 */

import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { i18n } from "../../i18n.js";
import * as ReviewState from "./reviewState.js";
import * as ReviewEngine from "./reviewModeEngine.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const LETTERS = ["A", "B", "C", "D", "E"];

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.jp ?? obj.ja);
  if (l === "ko" || l === "kr") return str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.zh ?? obj.cn) || str(obj.jp ?? obj.ja);
  if (l === "jp" || l === "ja") return str(obj.jp ?? obj.ja) || str(obj.zh ?? obj.cn) || str(obj.en) || str(obj.kr ?? obj.ko);
  return str(obj.en) || str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.jp ?? obj.ja);
}

function pickExplanation(obj, lang) {
  if (!obj || typeof obj !== "object") return str(obj);
  if (typeof obj === "string") return str(obj);
  const l = (lang || "ko").toLowerCase();
  if (l === "ko" || l === "kr") return str(obj.kr ?? obj.ko) || str(obj.zh ?? obj.cn) || str(obj.en) || str(obj.jp ?? obj.ja);
  if (l === "zh" || l === "cn") return str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.jp ?? obj.ja);
  if (l === "jp" || l === "ja") return str(obj.jp ?? obj.ja) || str(obj.zh ?? obj.cn) || str(obj.en) || str(obj.kr ?? obj.ko);
  return str(obj.en) || str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.jp ?? obj.ja);
}

function t(key, params) {
  return (i18n?.t?.(key, params) ?? key);
}

function getPinyin(text) {
  const zh = str(text);
  if (!zh || !/[\u4e00-\u9fff]/.test(zh)) return "";
  return resolvePinyin(zh, "");
}

function getOptionDisplay(o, lang) {
  if (o == null) return "";
  if (typeof o === "string") return o;
  return pickLang(o, lang) || str(o.zh ?? o.kr ?? o.en ?? o.cn ?? o.ko) || "";
}

function getOptionValue(o, lang) {
  if (o == null) return "";
  if (typeof o === "string") return o;
  return str(o.key) || getOptionDisplay(o, lang) || "";
}

function getAnswerDisplay(q, resultAnswer, lang) {
  if (resultAnswer == null) return "";
  if (typeof resultAnswer === "string") {
    const opts = Array.isArray(q?.options) ? q.options : [];
    const found = opts.find((o) => o && typeof o === "object" && o.key === resultAnswer);
    if (found) return getOptionDisplay(found, lang);
    return resultAnswer;
  }
  return pickLang(resultAnswer, lang) || "";
}

function renderReviewQuestionCard(q, index, { lang, answers, resultMap, submitted, total = 1 }) {
  const questionObj = typeof q.question === "object" ? q.question : { zh: str(q.question) };
  const questionZh = pickLang(questionObj, lang) || str(q.question);
  const options = Array.isArray(q.options) ? q.options : [];
  const selected = answers[q.id];
  const result = resultMap[q.id];
  const correctAnswerDisplay = result ? getAnswerDisplay(q, result.answer, lang) : "";

  const qNo = t("review_question_no", { n: index + 1, total: total || 1 });
  const qPy = getPinyin(questionZh);
  const qEsc = escapeHtml(questionZh).replaceAll('"', "&quot;");
  const speakLabel = t("practice_listen");

  const optsHtml = options.map((o, i) => {
    const optDisplay = getOptionDisplay(o, lang);
    const optValue = getOptionValue(o, lang);
    const letter = LETTERS[i] ?? String(i + 1);
    const isSelected = selected === optValue;
    const optPy = /[\u4e00-\u9fff]/.test(optDisplay) ? getPinyin(optDisplay) : "";
    const oEsc = escapeHtml(optDisplay).replaceAll('"', "&quot;");
    const oAttrs = optDisplay ? ` data-speak-text="${oEsc}" data-speak-kind="practice"` : "";

    let stateClasses = "practice-option lesson-practice-option review-option";
    if (submitted && result) {
      const correctVal = typeof result.answer === "object" ? getOptionValue(result.answer, lang) : String(result.answer ?? "");
      const isCorrectOption = optValue === correctVal;
      const isWrongSelected = !result.correct && isSelected;
      if (isCorrectOption) stateClasses += " option-correct is-correct";
      else if (isWrongSelected) stateClasses += " option-wrong is-wrong";
    } else if (isSelected) {
      stateClasses += " option-selected is-selected";
    }

    return `
<button type="button" class="${stateClasses}" data-question-id="${escapeHtml(q.id)}" data-answer="${escapeHtml(optValue).replaceAll('"', "&quot;")}">
  <span class="practice-option-letter lesson-practice-option-letter">${letter}</span>
  <span class="lesson-practice-option-content">
    <span class="lesson-practice-option-zh"${oAttrs}>${escapeHtml(optDisplay)}</span>
    ${optPy ? `<span class="lesson-practice-option-pinyin">${escapeHtml(optPy)}</span>` : ""}
  </span>
</button>`;
  }).join("");

  let resultHtml = "";
  if (submitted && result) {
    const correctLabel = t("review_correct");
    const wrongLabel = t("review_wrong");
    const answerLabel = t("practice_answer");
    const explLabel = t("review_explanation");
    const expl = pickExplanation(q.explanation, lang);
    const icon = result.correct ? "○" : "×";
    const resultClass = result.correct ? "lesson-practice-result-correct" : "lesson-practice-result-wrong";
    const answerDisplay = correctAnswerDisplay;
    const answerPy = /[\u4e00-\u9fff]/.test(answerDisplay) ? getPinyin(answerDisplay) : "";
    const aEsc = escapeHtml(answerDisplay).replaceAll('"', "&quot;");
    const aAttrs = answerDisplay ? ` data-speak-text="${aEsc}" data-speak-kind="practice"` : "";

    resultHtml = `
<div class="lesson-practice-result ${resultClass}">
  <div class="lesson-practice-result-header">${icon} ${result.correct ? correctLabel : wrongLabel}</div>
  ${!result.correct ? `
  <div class="lesson-practice-answer">
    <span class="lesson-practice-answer-label">${answerLabel}:</span>
    <span class="lesson-practice-answer-zh"${aAttrs}>${escapeHtml(answerDisplay)}</span>
    ${answerPy ? `<span class="lesson-practice-answer-pinyin">${escapeHtml(answerPy)}</span>` : ""}
  </div>` : ""}
  ${expl ? `<div class="practice-explanation lesson-practice-explanation"><span class="lesson-practice-explanation-label">${explLabel}:</span> ${escapeHtml(expl)}</div>` : ""}
</div>`;
  }

  const questionSpeakAttrs = questionZh ? ` data-speak-text="${qEsc}" data-speak-kind="practice"` : "";

  return `
<article class="lumina-card review-question-card practice-card lesson-practice-card" data-question-id="${escapeHtml(q.id)}">
  <div class="review-question-header practice-header">
    <span class="review-question-header-no">${qNo}</span>
    <button type="button" class="lesson-practice-audio-btn"${questionSpeakAttrs}>🔊 ${escapeHtml(speakLabel)}</button>
  </div>
  <div class="review-question-body practice-question">
    <div class="lesson-practice-question-zh"${questionSpeakAttrs}>${escapeHtml(questionZh)}</div>
    ${qPy ? `<div class="lesson-practice-question-pinyin">${escapeHtml(qPy)}</div>` : ""}
  </div>
  <div class="review-options practice-options">${optsHtml}</div>
  ${resultHtml}
</article>`;
}

/**
 * 挂载复习模式
 */
export function renderReviewMode(container, session, { lang = "ko", onFinish, enableTTS = true } = {}) {
  if (!container) return;

  const questions = session?.questions || [];
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "en" ? "en" : lang === "jp" || lang === "ja" ? "jp" : "ko";

  if (!questions.length) {
    container.innerHTML = `
<div class="review-empty-state">
  <p class="review-empty-title">${escapeHtml(t("review_no_wrong_questions"))}</p>
</div>`;
    return;
  }

  ReviewState.setSession(session);

  const modeLabel = session.mode === "lesson"
    ? t("review_current_lesson")
    : session.mode === "level"
      ? t("review_current_level")
      : t("review_all_wrong");

  function render() {
    const answers = ReviewState.getAnswers();
    const submitted = ReviewState.isSubmitted();
    const resultMap = ReviewState.getResultMap();

    if (submitted) {
      const result = ReviewState.getReviewResult() || { correctCount: 0, total: 0, clearedCount: 0 };
      const { correctCount, total, clearedCount } = result;
      const stillNeed = Math.max(0, (session?.items?.length ?? total) - clearedCount);

      container.innerHTML = `
<div class="review-result-block">
  <h3 class="review-result-title">${escapeHtml(t("review_completed"))}</h3>
  <div class="review-result-stats">
    <p>${escapeHtml(t("review_correct"))} ${correctCount} / ${total}</p>
    ${clearedCount > 0 ? `<p>${escapeHtml(t("review_cleared"))} ${clearedCount}</p>` : ""}
    ${stillNeed > 0 ? `<p>${escapeHtml(t("review_still_need_review"))} ${stillNeed}</p>` : ""}
  </div>
  <div class="review-result-actions">
    <button type="button" class="review-btn-continue">${escapeHtml(t("review_continue"))}</button>
    <button type="button" class="review-btn-back">${escapeHtml(t("review_back_to_lesson"))}</button>
  </div>
</div>`;

      const btnContinue = container.querySelector(".review-btn-continue");
      const btnBack = container.querySelector(".review-btn-back");
      btnContinue?.addEventListener("click", () => {
        if (onFinish) onFinish({ action: "continue" });
      });
      btnBack?.addEventListener("click", () => {
        if (onFinish) onFinish({ action: "back" });
      });
      return;
    }

    const cardsHtml = questions.map((q, i) =>
      renderReviewQuestionCard(q, i, { lang: langKey, answers, resultMap, submitted, total: questions.length })
    ).join("");

    container.innerHTML = `
<div class="review-mode-block">
  <section class="review-hero">
    <h3 class="review-title">${escapeHtml(t("review_mode"))}</h3>
    <p class="review-mode-label">${escapeHtml(modeLabel)}</p>
    <p class="review-count">${escapeHtml(t("review_total", { n: questions.length, total: questions.length }))}</p>
    <button type="button" class="lesson-practice-submit review-submit">${escapeHtml(t("review_submit"))}</button>
  </section>
  <section class="review-list lesson-practice-list">${cardsHtml}</section>
  <div class="review-footer">
    <button type="button" class="lesson-practice-submit review-submit">${escapeHtml(t("review_submit"))}</button>
  </div>
</div>`;

    const submitBtns = container.querySelectorAll(".review-submit");
    submitBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (ReviewState.isSubmitted()) return;
        ReviewEngine.submitReview();
        render();
      });
    });

    container.addEventListener("click", (e) => {
      const optionBtn = e.target.closest(".review-option") || e.target.closest(".practice-option");
      if (optionBtn && !ReviewState.isSubmitted()) {
        const qid = optionBtn.dataset.questionId;
        const answer = optionBtn.dataset.answer;
        if (qid && answer !== undefined) {
          const card = optionBtn.closest(".review-question-card") || optionBtn.closest(".lesson-practice-card");
          if (card) {
            card.querySelectorAll(".review-option, .practice-option").forEach((b) => {
              b.classList.remove("is-selected", "option-selected");
            });
            optionBtn.classList.add("is-selected", "option-selected");
          }
          ReviewState.setAnswer(qid, answer);
        }
      }
    });
  }

  render();
}
