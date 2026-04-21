// /ui/pages/page.teacher.js
// 老师工作台：轻量关系流 + 统一入口 CTA；文案经 safeUiText。

import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { getTeacherWorkspaceDemoSummary } from "../lumina-commerce/teacherDemoCatalog.js";
import { initCommerceStore } from "../lumina-commerce/store.js";
import { i18n } from "../i18n.js";
import { teacherPathStripHtml, teacherWorkspaceSubnavHtml } from "./teacherPathNav.js";

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

let __teacherLangHandler = /** @type {null | (() => void)} */ (null);
let __teacherRootRef = /** @type {HTMLElement | null} */ (null);

/** @param {ReturnType<typeof getTeacherWorkspaceDemoSummary>} sum */
function teacherWorkspaceOverviewHtml(sum) {
  const p = "teacher.workspace.overview";
  const chips = [
    tx(`${p}.chip_materials`, { count: String(sum.materialsCount) }),
    tx(`${p}.chip_courses`, { count: String(sum.coursesCount) }),
    tx(`${p}.chip_materials_in_use`, { count: String(sum.materialsInUseCount) }),
    tx(`${p}.chip_courses_with_listing`, { count: String(sum.coursesWithListing) }),
    tx(`${p}.chip_listings`, { count: String(sum.listingTotal) }),
    tx(`${p}.chip_pending`, { count: String(sum.pendingReview) }),
    tx(`${p}.chip_drafts`, { count: String(sum.draft) }),
    tx(`${p}.chip_approved`, { count: String(sum.approved) }),
  ];
  const chipsHtml = chips.map((c) => `<span class="teacher-workspace-chip">${escapeHtml(c)}</span>`).join("");
  return `
      <section class="card teacher-workspace-overview" aria-labelledby="teacher-workspace-overview-title">
        <h3 id="teacher-workspace-overview-title" class="teacher-workspace-overview-title">${escapeHtml(tx(`${p}.title`))}</h3>
        <p class="teacher-workspace-overview-disclosure">${escapeHtml(tx(`${p}.disclosure`))}</p>
        <div class="teacher-workspace-overview-chips">${chipsHtml}</div>
      </section>`;
}

async function renderTeacherHub(root) {
  let listings = [];
  try {
    const snap = await initCommerceStore();
    listings = Array.isArray(snap?.listings) ? snap.listings : [];
  } catch {
    listings = [];
  }
  const sum = getTeacherWorkspaceDemoSummary(listings);

  root.innerHTML = `
    <div class="teacher-page wrap">
      <section class="teacher-hero card teacher-center-page teacher-hero--compact">
        <p class="teacher-page-kicker">${escapeHtml(tx("teacher.manage.page_kicker"))}</p>
        <div class="hero">
          <h2 class="title">${escapeHtml(tx("teacher.workspace.title"))}</h2>
          <p class="desc teacher-hero-lead">${escapeHtml(tx("teacher.workspace.subtitle"))}</p>
        </div>
      </section>

      ${teacherWorkspaceSubnavHtml("workspace", tx)}

      <section class="card teacher-relation-flow" aria-label="${escapeHtml(tx("teacher.relation_flow.title"))}">
        <p class="teacher-relation-flow-title">${escapeHtml(tx("teacher.relation_flow.title"))}</p>
        ${teacherPathStripHtml(null, tx)}
        <p class="teacher-relation-flow-classroom">${escapeHtml(tx("teacher.workspace.classroom_flow_note"))}</p>
      </section>
      ${teacherWorkspaceOverviewHtml(sum)}

      <section class="teacher-grid">
        <article class="teacher-tile card teacher-tile-classroom teacher-tile--primary">
          <p class="teacher-tile-stage-kicker">${escapeHtml(tx("teacher.enter.classroom_stage_kicker"))}</p>
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.enter.classroom_section_title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.enter.classroom_section_lead"))}</p>
          <p class="teacher-tile-workflow-note">${escapeHtml(tx("teacher.enter.classroom_workflow_note"))}</p>
          <div class="teacher-classroom-form teacher-classroom-form--primary">
            <label class="teacher-field">
              <span>${escapeHtml(tx("teacher.label.course"))}</span>
              <select id="teacherCourseSelect">
                <option value="kids">${escapeHtml(formatTeacherHubCourseDisplay("kids"))}</option>
                <option value="hsk">${escapeHtml(formatTeacherHubCourseDisplay("hsk"))}</option>
              </select>
            </label>
            <label class="teacher-field">
              <span>${escapeHtml(tx("teacher.label.level"))}</span>
              <select id="teacherLevelSelect">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            <label class="teacher-field">
              <span>${escapeHtml(tx("teacher.label.lesson"))}</span>
              <input id="teacherLessonInput" type="number" min="1" value="1" />
            </label>
            <button type="button" id="teacherEnterClassroomBtn" class="teacher-hub-cta teacher-hub-cta--primary">
              ${escapeHtml(tx("teacher.enter.classroom_button"))}
            </button>
          </div>
        </article>

        <article class="teacher-tile card teacher-tile--entry">
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.hub.materials.title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.hub.materials.desc"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-materials">${escapeHtml(tx("teacher.hub.materials.cta"))}</a>
        </article>

        <article class="teacher-tile card teacher-tile--entry">
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.hub.courses.title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.hub.courses.desc"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-courses">${escapeHtml(tx("teacher.hub.courses.cta"))}</a>
        </article>

        <article class="teacher-tile card teacher-tile--entry">
          <div class="teacher-tile-head">
            <h3 class="teacher-tile-title teacher-tile-title--inline">${escapeHtml(tx("teacher.hub.listing.title"))}</h3>
            <span class="teacher-hub-badge">${escapeHtml(tx("teacher.hub.listing.badge"))}</span>
          </div>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.hub.listing.desc"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--accent" href="#lumina-teacher-stage0">${escapeHtml(tx("teacher.hub.listing.cta"))}</a>
        </article>

        <article class="teacher-tile card teacher-tile--entry teacher-tile--muted">
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.ai.assistant"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.ai.desc"))}</p>
          <p class="teacher-tile-scope">${escapeHtml(tx("teacher.ai.scope_note"))}</p>
        </article>

        <article class="teacher-tile card teacher-tile--entry teacher-tile--muted">
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.console.title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.console.desc"))}</p>
          <p class="teacher-tile-scope">${escapeHtml(tx("teacher.console.scope_note"))}</p>
        </article>
      </section>
    </div>
  `;

  root.querySelector("#teacherEnterClassroomBtn")?.addEventListener("click", () => {
    const course = String(root.querySelector("#teacherCourseSelect")?.value || "kids");
    const level = String(root.querySelector("#teacherLevelSelect")?.value || "1");
    const lessonRaw = String(root.querySelector("#teacherLessonInput")?.value || "1");
    const lesson = String(Math.max(1, parseInt(lessonRaw, 10) || 1));
    location.hash = `#classroom?course=${encodeURIComponent(course)}&level=${encodeURIComponent(level)}&lesson=${encodeURIComponent(lesson)}`;
  });

  i18n.apply?.(root);
}

export default function pageTeacher(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  __teacherRootRef = root;
  if (__teacherLangHandler) window.removeEventListener("joy:langChanged", __teacherLangHandler);
  __teacherLangHandler = () => {
    if (__teacherRootRef?.isConnected) void renderTeacherHub(__teacherRootRef);
  };
  window.addEventListener("joy:langChanged", __teacherLangHandler);

  void renderTeacherHub(root);
}

export function mount(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}
