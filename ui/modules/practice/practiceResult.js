/**
 * Practice Engine v1 - 结果展示组件
 */

import { i18n } from "../../i18n.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pickExplanation(obj, lang) {
  if (!obj || typeof obj !== "object") return str(obj);
  if (typeof obj === "string") return str(obj);
  const l = (lang || "ko").toLowerCase();
  const key = l === "jp" || l === "ja" ? "jp" : l === "kr" || l === "ko" ? "kr" : l === "cn" || l === "zh" ? "cn" : "en";
  return str(obj[key] ?? obj[key === "kr" ? "ko" : key === "cn" ? "zh" : key === "jp" ? "ja" : key]) || "";
}

function pickPrompt(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const key = lang === "cn" || lang === "zh" ? "cn" : lang === "kr" || lang === "ko" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";
  return str(obj[key] ?? obj.cn ?? obj.zh ?? "") || "";
}

function t(key, params) {
  return (i18n?.t?.(key, params) ?? key);
}

function getPinyin(text) {
  const zh = str(text);
  if (!zh || !/[\u4e00-\u9fff]/.test(zh)) return "";
  return resolvePinyin(zh, "");
}

export function renderResult(q, result, { lang }) {
  if (!result) return "";
  const expl = pickExplanation(q.explanation, lang);
  const correctLabel = t("practice.correct");
  const wrongLabel = t("practice.incorrect");
  const answerLabel = t("practice.answer");
  const explLabel = t("practice.explanation");

  let answerDisplay = "";
  if (Array.isArray(result.answer)) {
    answerDisplay = result.answer.join(" → ");
  } else if (typeof result.answer === "object") {
    answerDisplay = pickPrompt(result.answer, lang) || JSON.stringify(result.answer);
  } else {
    answerDisplay = String(result.answer ?? "");
  }

  const icon = result.correct ? "○" : "×";
  const resultClass = result.correct ? "lesson-practice-result-correct" : "lesson-practice-result-wrong";
  const answerPy = /[\u4e00-\u9fff]/.test(answerDisplay) ? getPinyin(answerDisplay) : "";
  const aEsc = escapeHtml(answerDisplay).replaceAll('"', "&quot;");
  const aAttrs = answerDisplay ? ` data-speak-text="${aEsc}" data-speak-kind="practice"` : "";

  return `
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
