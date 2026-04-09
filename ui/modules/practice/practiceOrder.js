/**
 * Practice Engine v1 - 排序题渲染
 */

import { i18n } from "../../i18n.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { renderResult } from "./practiceResult.js";
import { isHsk30Hsk1PilotContext } from "../hsk/hsk30PilotScope.js";

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

export function renderOrder(q, index, { lang, answers, resultMap, submitted }) {
  const prompt = q.prompt ?? q.question ?? {};
  const questionZh = pickPrompt(prompt, lang) || str(q.question);
  const items = q.items ?? q.options ?? [];
  const answerOrder = Array.isArray(q.answer) ? q.answer : (typeof q.answer === "string" ? [q.answer] : []);
  const selected = answers[q.id];
  const result = resultMap[q.id];

  const qNo = t("practice.question_no", { n: index + 1 });
  const qPy = getPinyin(questionZh);
  const orderLabel = t("practice.type_order");
  const speakLabel = t("practice.listen");
  const qEsc = escapeHtml(questionZh).replaceAll('"', "&quot;");
  const pilot = isHsk30Hsk1PilotContext();
  const questionSpeakAttrs = !pilot && questionZh ? ` data-speak-text="${qEsc}" data-speak-kind="practice"` : "";
  const qidEsc = escapeHtml(String(q.id || "")).replaceAll('"', "&quot;");
  const pilotCardAttr = pilot && q.id ? ` data-hsk30-practice-id="${qidEsc}"` : "";
  const listenBtn = pilot
    ? `<button type="button" class="lesson-practice-audio-btn hsk30-practice-listen" data-hsk30-practice-id="${qidEsc}">🔊 ${escapeHtml(speakLabel)}</button>`
    : `<button type="button" class="lesson-practice-audio-btn"${questionSpeakAttrs}>🔊 ${escapeHtml(speakLabel)}</button>`;

  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const inputVal = Array.isArray(selected) ? selected.join(" ") : (typeof selected === "string" ? selected : "");
  const inputDisabled = submitted ? "disabled" : "";

  let orderHtml = shuffled.map((item, i) => {
    const py = getPinyin(item);
    return `<span class="practice-order-chip" data-item="${escapeHtml(item)}">${escapeHtml(item)}${py ? ` <small>${escapeHtml(py)}</small>` : ""}</span>`;
  }).join(" ");

  orderHtml = `<div class="practice-order-chips">${orderHtml}</div>
  <div class="practice-order-input-wrap">
    <label class="practice-order-label">${escapeHtml(t("practice.order_input_label"))}</label>
    <input type="text" class="practice-order-input" data-question-id="${escapeHtml(q.id)}" value="${escapeHtml(inputVal)}" placeholder="${escapeHtml(shuffled.join(" "))}" ${inputDisabled} />
  </div>`;

  const resultHtml = submitted && result ? renderResult(q, result, { lang }) : "";

  return `
<article class="lumina-card practice-card lesson-practice-card practice-order-card" data-question-id="${escapeHtml(q.id)}"${pilotCardAttr}>
  <div class="practice-header lesson-practice-card-top">
    <span class="practice-header-no lesson-practice-index">${qNo}</span>
    <span class="practice-type-badge">${escapeHtml(orderLabel)}</span>
    ${listenBtn}
  </div>
  <div class="practice-question lesson-practice-question">
    <div class="lesson-practice-question-zh"${questionSpeakAttrs}>${escapeHtml(questionZh)}</div>
    ${qPy ? `<div class="lesson-practice-question-pinyin">${escapeHtml(qPy)}</div>` : ""}
  </div>
  <p class="practice-order-hint">${escapeHtml(t("practice.order_hint"))}</p>
  <div class="practice-order-list">${orderHtml}</div>
  ${resultHtml}
</article>`;
}
