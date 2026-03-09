/**
 * Practice Engine v1 - 配对题渲染
 */

import { i18n } from "../../i18n.js";
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

function t(key, params) {
  return i18n?.t?.(key, params) ?? key;
}

export function renderMatch(q, index, { lang, answers, resultMap, submitted }) {
  const pairs = q.pairs ?? [];
  const selected = answers[q.id];
  const result = resultMap[q.id];

  const qNo = t("practice.question_no", { n: index + 1 });
  const matchLabel = t("practice.type_match");
  const leftLabel = t("practice.match_left");
  const rightLabel = t("practice.match_right");

  const leftItems = pairs.map((p) => str(p.left ?? p[0]));
  const rightItems = pairs.map((p) => str(p.right ?? p[1]));
  const shuffledRight = [...rightItems].sort(() => Math.random() - 0.5);

  let matchHtml = "";
  if (submitted && result) {
    const correctPairs = pairs;
    matchHtml = correctPairs.map((p, i) => {
      const left = str(p.left ?? p[0]);
      const right = str(p.right ?? p[1]);
      return `<div class="practice-match-row submitted">
        <span class="practice-match-left">${escapeHtml(left)}</span>
        <span class="practice-match-arrow">→</span>
        <span class="practice-match-right">${escapeHtml(right)}</span>
      </div>`;
    }).join("");
  } else {
    matchHtml = leftItems.map((left, i) => {
      const sel = Array.isArray(selected) ? selected.find(([l]) => l === left)?.[1] : "";
      return `
      <div class="practice-match-row" data-left="${escapeHtml(left)}">
        <span class="practice-match-left">${escapeHtml(left)}</span>
        <select class="practice-match-select" data-question-id="${escapeHtml(q.id)}" data-left="${escapeHtml(left)}">
          <option value="">—</option>
          ${shuffledRight.map((r) => `<option value="${escapeHtml(r)}" ${sel === r ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
  }

  const resultHtml = submitted && result ? renderResult(q, result, { lang }) : "";

  return `
<article class="lumina-card practice-card lesson-practice-card practice-match-card" data-question-id="${escapeHtml(q.id)}">
  <div class="practice-header lesson-practice-card-top">
    <span class="practice-header-no lesson-practice-index">${qNo}</span>
    <span class="practice-type-badge">${escapeHtml(matchLabel)}</span>
  </div>
  <div class="practice-match-pairs">${matchHtml}</div>
  ${resultHtml}
</article>`;
}
