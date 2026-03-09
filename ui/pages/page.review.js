// /ui/pages/page.review.js
// Review 页面 MVP：最近练习 + 错题复习

import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { getWrongItems, getRecentItems, clearReview } from "../modules/review/reviewEngine.js";

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

function getLang() {
  const v = (i18n?.getLang?.() || "kr").toLowerCase();
  if (v === "zh" || v === "cn") return "cn";
  if (v === "en") return "en";
  if (v === "jp" || v === "ja") return "jp";
  return "kr";
}

function pickPrompt(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const key = lang === "cn" || lang === "zh" ? "cn" : lang === "kr" || lang === "ko" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";
  const v = obj[key] ?? obj.cn ?? obj.zh ?? obj.kr ?? obj.en ?? obj.jp;
  return String(v ?? "").trim();
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderWrongSection(wrongItems, lang) {
  if (!wrongItems.length) {
    return `
      <div class="review-empty-state">
        <p>${escapeHtml(t("review.empty_wrong"))}</p>
      </div>`;
  }

  const cards = wrongItems.slice(0, 30).map((item) => {
    const snap = item.questionSnapshot ?? {};
    const prompt = snap.prompt ?? snap.question ?? {};
    const questionText = pickPrompt(prompt, lang) || JSON.stringify(prompt).slice(0, 80);
    const selected = item.selected ?? "";
    const correct = item.correct ?? "";
    const lessonLabel = item.lessonId ? item.lessonId.replace(/_/g, " ") : "";

    return `
      <article class="review-card review-wrong-card">
        <div class="review-card-question">${escapeHtml(questionText)}</div>
        <div class="review-card-meta">
          <span class="review-card-lesson">${escapeHtml(lessonLabel)}</span>
          <span class="review-card-date">${escapeHtml(formatDate(item.practicedAt))}</span>
        </div>
        <div class="review-card-answers">
          <span class="review-card-your">${escapeHtml(t("review.your_answer"))}: ${escapeHtml(selected)}</span>
          <span class="review-card-correct">${escapeHtml(t("review.correct_answer"))}: ${escapeHtml(correct)}</span>
        </div>
      </article>`;
  }).join("");

  return `<div class="review-list">${cards}</div>`;
}

function renderRecentSection(recentItems, lang) {
  if (!recentItems.length) {
    return `
      <div class="review-empty-state">
        <p>${escapeHtml(t("review.empty_recent"))}</p>
      </div>`;
  }

  const cards = recentItems.slice(0, 20).map((item) => {
    const lessonLabel = item.lessonId ? item.lessonId.replace(/_/g, " ") : item.courseId || "";
    const score = item.score ?? 0;
    const total = item.total ?? 0;
    const correct = item.correct ?? 0;

    return `
      <article class="review-card review-recent-card">
        <div class="review-card-lesson">${escapeHtml(lessonLabel)}</div>
        <div class="review-card-meta">
          <span>${escapeHtml(t("review.score_format", { score, total }))}</span>
          <span>${escapeHtml(t("review.correct_format", { correct, total }))}</span>
          <span class="review-card-date">${escapeHtml(formatDate(item.practicedAt))}</span>
        </div>
      </article>`;
  }).join("");

  return `<div class="review-list">${cards}</div>`;
}

export function mount() {
  const app = document.getElementById("app");
  const navRoot = document.getElementById("siteNav");
  if (!app) return;

  if (navRoot) {
    navRoot.dataset.mode = "mini";
    mountNavBar(navRoot);
  }

  const wrongItems = getWrongItems();
  const recentItems = getRecentItems();
  const lang = getLang();

  app.innerHTML = `
    <div class="card review-page">
      <section class="hero">
        <h2 class="title" data-i18n="review_title">${escapeHtml(t("review.title"))}</h2>
        <p class="desc" data-i18n="review_desc">${escapeHtml(t("review.desc"))}</p>
      </section>

      <section class="review-section">
        <h3 class="review-section-title">${escapeHtml(t("review.recent_practice"))}</h3>
        <div id="reviewRecentBody">${renderRecentSection(recentItems, lang)}</div>
        ${recentItems.length ? `<button type="button" id="reviewClearRecent" class="btn-secondary text-sm">${escapeHtml(t("review.clear_recent"))}</button>` : ""}
      </section>

      <section class="review-section">
        <h3 class="review-section-title">${escapeHtml(t("review.wrong_review"))}</h3>
        <div id="reviewWrongBody">${renderWrongSection(wrongItems, lang)}</div>
        ${wrongItems.length ? `<button type="button" id="reviewClearWrong" class="btn-secondary text-sm">${escapeHtml(t("review.clear_wrong"))}</button>` : ""}
      </section>
    </div>
  `;

  const clearRecentBtn = document.getElementById("reviewClearRecent");
  const clearWrongBtn = document.getElementById("reviewClearWrong");

  clearRecentBtn?.addEventListener("click", () => {
    clearReview("recent");
    mount();
  });

  clearWrongBtn?.addEventListener("click", () => {
    clearReview("wrong");
    mount();
  });

  i18n.apply?.(app);
}
