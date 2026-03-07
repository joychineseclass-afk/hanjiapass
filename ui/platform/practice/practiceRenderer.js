/**
 * Practice Engine v1 - 渲染器（整页提交批改模式）
 * 全题展示、A/B/C/D 选项、拼音、统一提交
 */

import * as PracticeEngine from "./practiceEngine.js";
import * as PracticeState from "./practiceState.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { i18n } from "../../i18n.js";

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
  if (l === "zh" || l === "cn") return str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.en);
  if (l === "ko" || l === "kr") return str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.zh ?? obj.cn);
  return str(obj.en) || str(obj.kr ?? obj.ko) || str(obj.zh ?? obj.cn);
}

function t(key, params) {
  return (i18n?.t?.(key, params) ?? key);
}

/** 中文+拼音两行显示 */
function renderZhWithPinyin(text, manualPinyin = "") {
  const zh = str(text);
  if (!zh) return "";
  const py = str(manualPinyin) || resolvePinyin(zh, manualPinyin);
  if (!/[\u4e00-\u9fff]/.test(zh)) return `<div class="practice-zh-line">${escapeHtml(zh)}</div>`;
  if (!py) return `<div class="practice-zh-line">${escapeHtml(zh)}</div>`;
  return `
    <div class="practice-zh-line">${escapeHtml(zh)}</div>
    <div class="practice-py-line text-slate-500 italic">${escapeHtml(py)}</div>`;
}

/** 渲染单题（整页模式，含 A/B/C/D、拼音、选中态） */
function renderQuestionCard(q, index, { lang, answers, resultMap, submitted }) {
  const questionText = typeof q.question === "object" ? pickLang(q.question, lang) : str(q.question);
  const options = Array.isArray(q.options) ? q.options : [];
  const selected = answers[q.id];
  const result = resultMap[q.id];

  const optsHtml = options.map((o, i) => {
    const letter = LETTERS[i] ?? String(i + 1);
    const isSelected = selected === o;
    let stateClass = "practice-option";
    if (submitted && result) {
      const isCorrect = result.answer === o;
      const isWrongSelected = !result.correct && isSelected;
      if (isCorrect) stateClass += " practice-option-correct";
      else if (isWrongSelected) stateClass += " practice-option-wrong";
    } else if (isSelected) {
      stateClass += " practice-option-selected";
    }
    const content = renderZhWithPinyin(o);
    return `
      <button type="button" class="${stateClass} w-full text-left px-4 py-3 rounded-xl border flex items-center gap-3 transition-colors" data-question-id="${escapeHtml(q.id)}" data-answer="${escapeHtml(String(o))}">
        <span class="practice-option-letter w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0">${letter}</span>
        <span class="practice-option-content flex-1">${content}</span>
      </button>`;
  }).join("");

  let resultHtml = "";
  if (submitted && result) {
    const correctLabel = t("practice_correct");
    const wrongLabel = t("practice_wrong");
    const correctAnswerLabel = t("practice_correct_answer", { answer: result.answer });
    const explLabel = t("practice_explanation");
    const expl = q.explanation && typeof q.explanation === "object" ? pickLang(q.explanation, lang) : str(q.explanation);
    const icon = result.correct ? "○" : "✕";
    const resultClass = result.correct ? "practice-result-correct" : "practice-result-wrong";
    resultHtml = `
      <div class="practice-result mt-3 p-3 rounded-xl ${resultClass}">
        <div class="font-semibold mb-1">${icon} ${result.correct ? correctLabel : wrongLabel}</div>
        ${!result.correct ? `<div class="text-sm mb-2">${correctAnswerLabel}</div>` : ""}
        ${expl ? `<div class="text-sm"><span class="font-medium">${explLabel}:</span> ${renderZhWithPinyin(expl)}</div>` : ""}
      </div>`;
  }

  const qContent = renderZhWithPinyin(questionText);
  const qNo = t("practice_question_no", { n: index + 1 });

  return `
    <div class="practice-question-card rounded-xl border border-slate-200 p-4 mb-4 bg-white" data-question-id="${escapeHtml(q.id)}">
      <div class="practice-question-header text-sm font-semibold text-slate-500 mb-2">${qNo}</div>
      <div class="practice-question-text text-lg font-medium text-slate-800 mb-4">${qContent}</div>
      <div class="practice-options space-y-2">${optsHtml}</div>
      ${resultHtml}
    </div>`;
}

/**
 * 统一入口：挂载整页练习
 */
export function mountPractice(container, { lesson, lang = "ko", onComplete } = {}) {
  if (!container) return;

  const { questions, totalScore } = PracticeEngine.loadPractice(lesson);
  if (!questions.length) {
    container.innerHTML = `<div class="lesson-empty text-sm opacity-70">${t("common_loading")}</div>`;
    return;
  }

  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "en" ? "en" : "ko";

  function render() {
    const answers = PracticeState.getAnswers();
    const submitted = PracticeState.isSubmitted();
    const resultMap = PracticeState.getResultMap();
    const score = PracticeState.getScore();

    const questionsHtml = questions.map((q, i) =>
      renderQuestionCard(q, i, { lang: langKey, answers, resultMap, submitted })
    ).join("");

    const totalLabel = t("practice_total_questions", { n: questions.length });
    const scoreLabel = submitted
      ? t("practice_total_score", { score, total: totalScore })
      : totalLabel;

    const submitBtnHtml = !submitted
      ? `<button type="button" class="practice-submit-all w-full py-4 rounded-xl border-2 border-green-500 bg-green-500 text-white font-semibold text-lg hover:bg-green-600 transition-colors">${t("practice_submit")}</button>`
      : "";

    container.innerHTML = `
      <div class="practice-fullpage">
        <div class="practice-header text-sm text-slate-600 mb-4">${scoreLabel}</div>
        <div class="practice-questions">${questionsHtml}</div>
        <div class="practice-footer mt-6">${submitBtnHtml}</div>
      </div>`;
  }

  /** 事件委托：只绑定一次 */
  container.addEventListener("click", (e) => {
      const submitBtn = e.target.closest(".practice-submit-all");
      const optionBtn = e.target.closest(".practice-option");

      if (submitBtn && !PracticeState.isSubmitted()) {
        const { score, correctCount } = PracticeEngine.submitAll();
        if (onComplete && !container.dataset.progressRecorded) {
          container.dataset.progressRecorded = "1";
          onComplete({
            total: questions.length,
            correct: correctCount,
            score,
            lesson,
          });
        }
        render();
        return;
      }

      if (optionBtn && !PracticeState.isSubmitted()) {
        const qid = optionBtn.dataset.questionId;
        const answer = optionBtn.dataset.answer;
        if (qid && answer !== undefined) {
          const card = optionBtn.closest(".practice-question-card");
          if (card) {
            card.querySelectorAll(".practice-option").forEach((b) => b.classList.remove("practice-option-selected"));
            optionBtn.classList.add("practice-option-selected");
          }
          PracticeState.setAnswer(qid, answer);
        }
      }
    });

  render();
}

export function renderPracticeStep({ lesson, lang = "ko" } = {}) {
  const { questions } = PracticeEngine.loadPractice(lesson);
  if (!questions.length) return `<div class="lesson-empty text-sm opacity-70">(暂无练习)</div>`;
  const mountId = "practice-mount-" + Date.now();
  if (typeof window !== "undefined") {
    window.__PRACTICE_PENDING = { lesson, lang };
    requestAnimationFrame?.(() => {
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
