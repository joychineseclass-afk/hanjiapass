// 我的课程：与教材页统一的教师管理页模板；文案经 safeUiText。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import {
  TEACHER_DEMO_COURSES,
  formatDemoCourseListingHint,
  formatDemoCourseMaterialsLine,
  formatDemoShortUpdated,
} from "../lumina-commerce/teacherDemoCatalog.js";
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

function coursesTableBody() {
  return TEACHER_DEMO_COURSES.map((c) => {
    const title = escapeHtml(tx(`teacher.demo.course.${c.id}.title`));
    const type = escapeHtml(tx(`teacher.demo.course.${c.id}.type`));
    const status = escapeHtml(tx(`teacher.demo.course.${c.id}.status`));
    const materialsLine = escapeHtml(formatDemoCourseMaterialsLine(c, tx));
    const listingHint = escapeHtml(formatDemoCourseListingHint(c, tx));
    const updated = escapeHtml(formatDemoShortUpdated(c.updated_at));
    const badge = escapeHtml(tx("common.demo_badge"));
    return `<tr>
      <td class="teacher-manage-cell-title">
        <span class="teacher-demo-badge">${badge}</span>
        ${title}
      </td>
      <td>${type}</td>
      <td>${status}</td>
      <td class="teacher-manage-cell-meta">${materialsLine}</td>
      <td class="teacher-manage-cell-meta">${listingHint}</td>
      <td>${updated}</td>
      <td class="teacher-manage-col-actions">${escapeHtml(tx("teacher.courses_page.demo_action_placeholder"))}</td>
    </tr>`;
  }).join("");
}

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
        <p class="teacher-demo-disclosure">${escapeHtml(tx("teacher.demo.disclosure"))}</p>
        <p class="teacher-list-demo-note">${escapeHtml(tx("teacher.courses_page.list_demo_note"))}</p>
        <div class="teacher-manage-table-scroll">
          <table class="teacher-manage-table">
            <thead>
              <tr>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_name"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_type"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_status"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_uses_materials"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_listing_track"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.courses_page.th_updated"))}</th>
                <th scope="col" class="teacher-manage-col-actions">${escapeHtml(tx("teacher.courses_page.th_actions"))}</th>
              </tr>
            </thead>
            <tbody>
              ${coursesTableBody()}
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
