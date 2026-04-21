// 我的课程占位页：课程管理层；文案经 safeUiText。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { i18n } from "../i18n.js";

function tx(path, params) {
  return safeUiText(path, params);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let __crsLangHandler = /** @type {null | (() => void)} */ (null);
let __crsRootRef = /** @type {HTMLElement | null} */ (null);

function renderCoursesDom(root) {
  root.innerHTML = `
    <div class="teacher-page wrap">
      <p style="margin:0 0 12px;">
        <a href="#teacher" class="teacher-back-link">${escapeHtml(tx("teacher.courses_page.back"))}</a>
      </p>
      <section class="card teacher-center-page">
        <h2 class="title">${escapeHtml(tx("teacher.courses_page.title"))}</h2>
        <p class="desc">${escapeHtml(tx("teacher.courses_page.subtitle"))}</p>
      </section>
      <section class="card" style="margin-top:14px;">
        <h3 class="title" style="font-size:1.1rem;">${escapeHtml(tx("teacher.courses_page.empty"))}</h3>
        <p class="desc" style="font-size:13px;color:#94a3b8;margin-top:8px;">${escapeHtml(tx("teacher.courses_page.new_note"))}</p>
        <button type="button" class="teacher-enter-btn" disabled style="margin-top:12px;opacity:0.65;cursor:not-allowed;">
          ${escapeHtml(tx("teacher.courses_page.new_cta"))}
        </button>
      </section>
      <section class="card" style="margin-top:14px;">
        <p class="desc" style="font-size:13px;line-height:1.6;margin:0;">${escapeHtml(tx("teacher.courses_page.relation_note"))}</p>
      </section>
    </div>
  `;
  i18n.apply?.(root);
}

export default function pageTeacherCourses(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  __crsRootRef = root;
  if (__crsLangHandler) window.removeEventListener("joy:langChanged", __crsLangHandler);
  __crsLangHandler = () => {
    if (__crsRootRef?.isConnected) renderCoursesDom(__crsRootRef);
  };
  window.addEventListener("joy:langChanged", __crsLangHandler);

  renderCoursesDom(root);
}

export function mount(ctxOrRoot) {
  return pageTeacherCourses(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherCourses(ctxOrRoot);
}
