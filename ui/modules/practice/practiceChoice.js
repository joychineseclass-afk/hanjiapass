/**
 * Practice Engine v1 - 单选题渲染
 */

import { i18n } from "../../i18n.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { renderResult } from "./practiceResult.js";

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

function pickPrompt(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const key = lang === "cn" || lang === "zh" ? "cn" : lang === "kr" || lang === "ko" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";
  return str(obj[key] ?? obj.cn ?? obj.zh ?? "") || "";
}

function getOptionDisplay(o, lang) {
  if (o == null) return "";
  if (typeof o === "string") return o;
  return pickPrompt(o, lang) || str(o.zh ?? o.cn ?? o.kr ?? o.en) || "";
}

function getOptionValue(o, lang) {
  if (o == null) return "";
  if (typeof o === "string") return o;
  return str(o.key) || getOptionDisplay(o, lang) || "";
}

function t(key, params) {
  return i18n?.t?.(key, params) ?? key;
}

function getPinyin(text) {
  const zh = str(text);
  if (!zh || !/[\u4e00-\u9fff]/.test(zh)) return "";
  return resolvePinyin(zh, "");
}

export function renderChoice(q, index, { lang, answers, resultMap, submitted }) {
  const prompt = q.prompt ?? q.question ?? {};
  const questionZh = pickPrompt(prompt, lang) || str(q.question);
  const options = Array.isArray(q.options) ? q.options : [];
  const selected = answers[q.id];
  const result = resultMap[q.id];

  const qNo = t("practice.question_no", { n: index + 1 });
  const qPy = getPinyin(questionZh);
  const speakLabel = t("practice.listen");
  const qEsc = escapeHtml(questionZh).replaceAll('"', "&quot;");
  const questionSpeakAttrs = questionZh ? ` data-speak-text="${qEsc}" data-speak-kind="practice"` : "";

  const optsHtml = options.map((o, i) => {
    const optDisplay = getOptionDisplay(o, lang);
    const optValue = getOptionValue(o, lang);
    const letter = LETTERS[i] ?? String(i + 1);
    const isSelected = selected === optValue;
    const optPy = /[\u4e00-\u9fff]/.test(optDisplay) ? getPinyin(optDisplay) : "";
    const oEsc = escapeHtml(optDisplay).replaceAll('"', "&quot;");
    const oAttrs = optDisplay ? ` data-speak-text="${oEsc}" data-speak-kind="practice"` : "";

    let stateClasses = "practice-option lesson-practice-option";
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
  <span class="practice-option-letter">${letter}</span>
  <span class="lesson-practice-option-content">
    <span class="lesson-practice-option-zh"${oAttrs}>${escapeHtml(optDisplay)}</span>
    ${optPy ? `<span class="lesson-practice-option-pinyin">${escapeHtml(optPy)}</span>` : ""}
  </span>
</button>`;
  }).join("");

  const resultHtml = submitted && result ? renderResult(q, result, { lang }) : "";

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
