/**
 * Practice Engine v1 - 渲染器（整页提交批改模式）
 * 教材级题卡 UI、A/B/C/D 选项、点读、多语言解析
 */

import * as PracticeEngine from "./practiceEngine.js";
import * as PracticeState from "./practiceState.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { i18n } from "../../i18n.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const LETTERS = ["A", "B", "C", "D", "E"];

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** 严格模式：仅当前语言，不 fallback 避免混语。JP strict: 绝不 fallback 到 kr/cn */
function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "ko").toLowerCase();
  const key = l === "zh" || l === "cn" ? "zh" : l === "ko" || l === "kr" ? "kr" : l === "jp" || l === "ja" ? "jp" : "en";
  return str(obj[key] ?? obj[key === "kr" ? "ko" : key === "zh" ? "cn" : key === "jp" ? "ja" : key]) || "";
}

/** 题干：优先当前语言，缺则回退中文（题目主体可保留中文） */
function pickQuestionText(obj, lang) {
  const v = pickLang(obj, lang);
  if (v) return v;
  return str(obj?.zh ?? obj?.cn ?? obj?.zh ?? "") || "";
}

/** 解析跟随系统语言：KR/CN/EN/JP。JP strict: 只返回 jp，不 fallback 到 kr/cn */
function pickExplanation(obj, lang) {
  if (!obj || typeof obj !== "object") return str(obj);
  if (typeof obj === "string") return str(obj);
  const l = (lang || "ko").toLowerCase();
  if (l === "jp" || l === "ja") return str(obj.jp || obj.ja) || "";
  if (l === "ko" || l === "kr") return str(obj.kr || obj.ko) || str(obj.zh || obj.cn) || str(obj.en) || str(obj.jp);
  if (l === "zh" || l === "cn") return str(obj.zh || obj.cn) || str(obj.kr || obj.ko) || str(obj.en) || str(obj.jp);
  return str(obj.en) || str(obj.zh || obj.cn) || str(obj.kr || obj.ko) || str(obj.jp);
}

function t(key, params) {
  return (i18n && typeof i18n.t === "function" ? i18n.t(key, params) : null) || key;
}

function getPinyin(text) {
  const zh = str(text);
  if (!zh || !/[\u4e00-\u9fff]/.test(zh)) return "";
  return resolvePinyin(zh, "");
}

/** 选项显示值（支持对象多语言） */
function getOptionDisplay(o, lang) {
  if (o == null) return "";
  if (typeof o === "string") return o;
  return pickLang(o, lang) || str(o.zh || o.kr || o.en || o.cn || o.ko) || "";
}

/** 选项提交值（用于 data-answer，对象用 key） */
function getOptionValue(o, lang) {
  if (o == null) return "";
  if (typeof o === "string") return o;
  return str(o.key) || getOptionDisplay(o, lang) || "";
}

/** 正确答案显示（支持对象，或从 options 中按 answer key 查找） */
function getAnswerDisplay(q, resultAnswer, lang) {
  if (resultAnswer == null) return "";
  if (typeof resultAnswer === "string") {
    const opts = Array.isArray(q && q.options) ? q.options : [];
    const found = opts.find((o) => o && typeof o === "object" && o.key === resultAnswer);
    if (found) return getOptionDisplay(found, lang);
    return resultAnswer;
  }
  return pickLang(resultAnswer, lang) || "";
}

/** 渲染单题：教材级题卡 */
function renderQuestionCard(q, index, { lang, answers, resultMap, submitted }) {
  const questionObj = typeof q.question === "object" ? q.question : { zh: str(q.question) };
  const questionZh = pickQuestionText(questionObj, lang) || str(q.question);
  const options = Array.isArray(q.options) ? q.options : [];
  const selected = answers[q.id];
  const result = resultMap[q.id];
  const correctAnswerDisplay = result ? getAnswerDisplay(q, result.answer, lang) : "";

  const typeLabel = t("practice.type_choice");
  const qNo = t("practice.question_no", { n: index + 1 });
  const qPy = getPinyin(questionZh);
  const qEsc = escapeHtml(questionZh).replaceAll('"', "&quot;");
  const speakLabel = t("practice.listen");

  const optsHtml = options.map((o, i) => {
    const optDisplay = getOptionDisplay(o, lang);
    const optValue = getOptionValue(o, lang);
    const letter = LETTERS[i] || String(i + 1);
    const isSelected = selected === optValue;
    const optPy = /[\u4e00-\u9fff]/.test(optDisplay) ? getPinyin(optDisplay) : "";
    const oEsc = escapeHtml(optDisplay).replaceAll('"', "&quot;");
    const oAttrs = optDisplay ? ` data-speak-text="${oEsc}" data-speak-kind="practice"` : "";

    let stateClasses = "practice-option lesson-practice-option";
    if (submitted && result) {
      const correctVal = typeof result.answer === "object" ? getOptionValue(result.answer, lang) : String(result.answer != null ? result.answer : "");
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
    const correctLabel = t("practice.correct") || t("practice_correct");
    const wrongLabel = t("practice.incorrect") || t("practice_wrong");
    const answerLabel = t("practice.answer") || t("practice_answer");
    const explLabel = t("practice.explanation") || t("practice_explanation");
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
<article class="lumina-card practice-card lesson-practice-card" data-question-id="${escapeHtml(q.id)}">
  <div class="practice-header lesson-practice-card-top">
    <span class="practice-header-no lesson-practice-index">${qNo}</span>
    <button type="button" class="lesson-practice-audio-btn"${questionSpeakAttrs}>🔊 ${escapeHtml(speakLabel)}</button>
  </div>
  <div class="practice-question lesson-practice-question">
    <div class="lesson-practice-question-zh"${questionSpeakAttrs}>${escapeHtml(questionZh)}</div>
    ${qPy ? `<div class="lesson-practice-question-pinyin">${escapeHtml(qPy)}</div>` : ""}
  </div>
  <div class="practice-options lesson-practice-options">${optsHtml}</div>
  ${resultHtml}
</article>`;
}

/**
 * 统一入口：挂载整页练习
 */
export function mountPractice(container, { lesson, lang = "ko", onComplete } = {}) {
  if (!container) return;

  const { questions, totalScore } = PracticeEngine.loadPractice(lesson);
  if (!questions.length) {
    container.innerHTML = `<div class="lesson-practice-empty">${t("practice.empty")}</div>`;
    return;
  }

  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "en" ? "en" : lang === "jp" || lang === "ja" ? "jp" : "ko";

  function render() {
    const answers = PracticeState.getAnswers();
    const submitted = PracticeState.isSubmitted();
    const resultMap = PracticeState.getResultMap();
    const score = PracticeState.getScore();

    const questionsHtml = questions.map((q, i) =>
      renderQuestionCard(q, i, { lang: langKey, answers, resultMap, submitted })
    ).join("");

    const scoreLabel = submitted
      ? t("practice.total_score", { score, total: totalScore })
      : t("practice.total_count", { n: questions.length });

    const submitBtnHtml = !submitted
      ? `<button type="button" class="lesson-practice-submit">${t("practice.submit")}</button>`
      : "";

    const hero = `
<section class="lesson-section-hero lesson-practice-hero">
  <h3 class="lesson-section-title">${escapeHtml(t("hsk.section.practice"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(t("hsk.desc.practice"))}</p>
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

  /** 事件委托 */
  container.addEventListener("click", (e) => {
    const submitBtn = e.target.closest(".lesson-practice-submit");

    if (submitBtn && !PracticeState.isSubmitted()) {
      const { score, correctCount, wrongItems } = PracticeEngine.submitAll();
      if (onComplete && !container.dataset.progressRecorded) {
        container.dataset.progressRecorded = "1";
        onComplete({
          total: questions.length,
          correct: correctCount,
          score,
          lesson,
          wrongItems: wrongItems || [],
        });
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

  render();
}

/** 语言切换时重新渲染（不重置答题状态） */
export function rerenderPractice(container, lang = "ko") {
  if (!container) return;
  const questions = PracticeState.getQuestions();
  if (!questions.length) return;

  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "en" ? "en" : lang === "jp" || lang === "ja" ? "jp" : "ko";
  const answers = PracticeState.getAnswers();
  const submitted = PracticeState.isSubmitted();
  const resultMap = PracticeState.getResultMap();
  const score = PracticeState.getScore();
  const totalScore = PracticeState.getTotalScore();

  const questionsHtml = questions.map((q, i) =>
    renderQuestionCard(q, i, { lang: langKey, answers, resultMap, submitted })
  ).join("");

  const scoreLabel = submitted
    ? t("practice.total_score", { score, total: totalScore })
    : t("practice.total_count", { n: questions.length });

  const submitBtnHtml = !submitted
    ? `<button type="button" class="lesson-practice-submit">${t("practice.submit")}</button>`
    : "";

  const hero = `
<section class="lesson-section-hero lesson-practice-hero">
  <h3 class="lesson-section-title">${escapeHtml(t("hsk.section.practice"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(t("hsk.desc.practice"))}</p>
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

export function renderPracticeStep({ lesson, lang = "ko" } = {}) {
  const { questions } = PracticeEngine.loadPractice(lesson);
  if (!questions.length) return `<div class="lesson-practice-empty">—</div>`;
  const mountId = "practice-mount-" + Date.now();
  if (typeof window !== "undefined") {
    window.__PRACTICE_PENDING = { lesson, lang };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(function() {
      const el = document.querySelector(".practice-mount-point");
      const opts = window.__PRACTICE_PENDING;
      if (el && opts) {
        mountPractice(el, opts);
        window.__PRACTICE_PENDING = null;
      }
    });
  }
  return `<div id="${mountId}" class="practice-mount-point"></div>`;
}
