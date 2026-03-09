/**
 * Practice Engine v1 - 填空题渲染
 */

import { i18n } from "../../i18n.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { renderResult } from "./practiceResult.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

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

function t(key, params) {
  return i18n?.t?.(key, params) ?? key;
}

function getPinyin(text) {
  const zh = str(text);
  if (!zh || !/[\u4e00-\u9fff]/.test(zh)) return "";
  return resolvePinyin(zh, "");
}

export function renderFill(q, index, { lang, answers, resultMap, submitted }) {
  const prompt = q.prompt ?? q.question ?? {};
  const questionZh = pickPrompt(prompt, lang) || str(q.question);
  const selected = answers[q.id];
  const result = resultMap[q.id];

  const qNo = t("practice.question_no", { n: index + 1 });
  const qPy = getPinyin(questionZh);
  const speakLabel = t("practice.listen");
  const fillLabel = t("practice.type_fill");
  const qEsc = escapeHtml(questionZh).replaceAll('"', "&quot;");
  const questionSpeakAttrs = questionZh ? ` data-speak-text="${qEsc}" data-speak-kind="practice"` : "";

  const inputVal = typeof selected === "string" ? selected : "";
  const inputDisabled = submitted ? "disabled" : "";
  const inputClass = submitted && result
    ? (result.correct ? "practice-fill-input correct" : "practice-fill-input wrong")
    : "practice-fill-input";

  const resultHtml = submitted && result ? renderResult(q, result, { lang }) : "";

  return `
<article class="lumina-card practice-card lesson-practice-card practice-fill-card" data-question-id="${escapeHtml(q.id)}">
  <div class="practice-header lesson-practice-card-top">
    <span class="practice-header-no lesson-practice-index">${qNo}</span>
    <span class="practice-type-badge">${escapeHtml(fillLabel)}</span>
    <button type="button" class="lesson-practice-audio-btn"${questionSpeakAttrs}>🔊 ${escapeHtml(speakLabel)}</button>
  </div>
  <div class="practice-question lesson-practice-question">
    <div class="lesson-practice-question-zh"${questionSpeakAttrs}>${escapeHtml(questionZh)}</div>
    ${qPy ? `<div class="lesson-practice-question-pinyin">${escapeHtml(qPy)}</div>` : ""}
  </div>
  <div class="practice-fill-wrap">
    <input type="text" class="${inputClass}" data-question-id="${escapeHtml(q.id)}" value="${escapeHtml(inputVal)}" placeholder="${escapeHtml(t("practice.fill_placeholder"))}" ${inputDisabled} />
  </div>
  ${resultHtml}
</article>`;
}
