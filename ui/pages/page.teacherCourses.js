// 我的课程：与教材页统一的教师管理页模板；文案经 safeUiText。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { i18n } from "../i18n.js";
import { teacherCoursesNextGuideHtml, teacherPathStripHtml } from "./teacherPathNav.js";

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
    <div class="teacher-page wrap teacher-manage-page teacher-admin-shell">
      <p class="teacher-admin-back">
        <a href="#teacher" class="teacher-back-link">${escapeHtml(tx("teacher.courses_page.back"))}</a>
      </p>
      <p class="teacher-page-kicker teacher-page-kicker--shell">${escapeHtml(tx("teacher.manage.page_kicker"))}</p>
      ${teacherPathStripHtml("courses", tx)}
      <header class="card teacher-admin-header">
        <h1 class="teacher-admin-title">${escapeHtml(tx("teacher.courses_page.title"))}</h1>
        <p class="teacher-admin-subtitle">${escapeHtml(tx("teacher.courses_page.subtitle"))}</p>
        <p class="teacher-admin-tagline">${escapeHtml(tx("teacher.courses_page.tagline"))}</p>
      </header>
      ${teacherCoursesNextGuideHtml(tx)}

      <section class="card teacher-admin-toolbar" aria-label="${escapeHtml(tx("teacher.courses_page.new_cta"))}">
        <div class="teacher-admin-toolbar-row">
          <button type="button" class="teacher-admin-btn teacher-admin-btn--disabled" disabled>
            ${escapeHtml(tx("teacher.courses_page.new_cta"))}
          </button>
          <p class="teacher-admin-toolbar-hint">${escapeHtml(tx("teacher.courses_page.new_note"))}</p>
        </div>
      </section>

      <section class="card teacher-admin-list-card" aria-labelledby="teacher-courses-list-title">
        <h2 id="teacher-courses-list-title" class="teacher-admin-list-heading">${escapeHtml(tx("teacher.courses_page.list_title"))}</h2>
        <div class="teacher-manage-table-scroll">
          <table class="teacher-manage-table">
            <thead>
              <tr>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_name"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_type"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_status"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_updated"))}</th>
                <th scope="col" class="teacher-manage-col-actions">${escapeHtml(tx("teacher.courses_page.th_actions"))}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="teacher-manage-empty-row">
                <td colspan="5">
                  <div class="teacher-admin-empty" role="status">
                    <p class="teacher-admin-empty-title">${escapeHtml(tx("teacher.courses_page.empty_cell_title"))}</p>
                    <p class="teacher-admin-empty-sub">${escapeHtml(tx("teacher.courses_page.empty_subhint"))}</p>
                    <p class="teacher-admin-empty-intro">${escapeHtml(tx("teacher.courses_page.empty_cell_intro"))}</p>
                    <ul class="teacher-admin-empty-list">
                      <li>${escapeHtml(tx("teacher.courses_page.empty_cell_item_1"))}</li>
                      <li>${escapeHtml(tx("teacher.courses_page.empty_cell_item_2"))}</li>
                      <li>${escapeHtml(tx("teacher.courses_page.empty_cell_item_3"))}</li>
                    </ul>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="teacher-info-note">
        <p class="teacher-info-note-title">${escapeHtml(tx("teacher.courses_page.relation_title"))}</p>
        <p class="teacher-info-note-lead">${escapeHtml(tx("teacher.courses_page.relation_note_short"))}</p>
        <ul class="teacher-info-note-list">
          <li>${escapeHtml(tx("teacher.courses_page.relation_item_1"))}</li>
          <li>${escapeHtml(tx("teacher.courses_page.relation_item_2"))}</li>
          <li>${escapeHtml(tx("teacher.courses_page.relation_item_3"))}</li>
        </ul>
      </aside>
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
