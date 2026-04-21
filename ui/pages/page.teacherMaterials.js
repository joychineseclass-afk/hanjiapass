// 我的教材：与课程页统一的教师管理页模板；文案经 safeUiText。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import {
  TEACHER_DEMO_MATERIALS,
  formatDemoMaterialCoursesLine,
  formatDemoMaterialListingPrep,
  formatDemoMaterialPhasePill,
  formatDemoMaterialUsageChipLabel,
  formatDemoShortUpdated,
  getDemoMaterialPhaseKey,
} from "../lumina-commerce/teacherDemoCatalog.js";
import { i18n } from "../i18n.js";
import {
  teacherBackToWorkspaceHtml,
  teacherMaterialsNextGuideHtml,
  teacherPathStripHtml,
  teacherWorkspaceSubnavHtml,
} from "./teacherPathNav.js";

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

let __matLangHandler = /** @type {null | (() => void)} */ (null);
let __matRootRef = /** @type {HTMLElement | null} */ (null);

function materialsTableBody() {
  return TEACHER_DEMO_MATERIALS.map((m) => {
    const title = escapeHtml(tx(`teacher.demo.material.${m.id}.title`));
    const type = escapeHtml(tx(`teacher.demo.material.${m.id}.type`));
    const status = escapeHtml(tx(`teacher.demo.material.${m.id}.status`));
    const phaseKey = getDemoMaterialPhaseKey(m);
    const phaseLabel = escapeHtml(formatDemoMaterialPhasePill(phaseKey, tx));
    const phaseClass = escapeHtml(String(phaseKey).replace(/[^a-z0-9_-]/gi, ""));
    const usageChip = escapeHtml(formatDemoMaterialUsageChipLabel(m, tx));
    const usageChipMod = m.usedByCourseIds.length ? "" : " teacher-mini-chip--muted";
    const coursesDetail =
      m.usedByCourseIds.length > 0
        ? `<div class="teacher-meta-subline">${escapeHtml(formatDemoMaterialCoursesLine(m, tx))}</div>`
        : "";
    const listingPrep = escapeHtml(formatDemoMaterialListingPrep(m, tx));
    const updated = escapeHtml(formatDemoShortUpdated(m.updated_at));
    const badge = escapeHtml(tx("common.demo_badge"));
    return `<tr>
      <td class="teacher-manage-cell-title">
        <span class="teacher-demo-badge">${badge}</span>
        ${title}
      </td>
      <td>${type}</td>
      <td>${status}</td>
      <td class="teacher-manage-cell-phase"><span class="teacher-phase-pill teacher-phase-pill--mat-${phaseClass}">${phaseLabel}</span></td>
      <td class="teacher-manage-cell-meta">
        <span class="teacher-mini-chip${usageChipMod}">${usageChip}</span>
        ${coursesDetail}
      </td>
      <td class="teacher-manage-cell-meta"><span class="teacher-phase-pill teacher-phase-pill--sub">${listingPrep}</span></td>
      <td>${updated}</td>
      <td class="teacher-manage-col-actions">${escapeHtml(tx("teacher.materials_page.demo_action_placeholder"))}</td>
    </tr>`;
  }).join("");
}

function renderMaterialsDom(root) {
  root.innerHTML = `
    <div class="teacher-page wrap teacher-manage-page teacher-admin-shell">
      ${teacherBackToWorkspaceHtml(tx)}
      <p class="teacher-page-kicker teacher-page-kicker--shell">${escapeHtml(tx("teacher.manage.page_kicker"))}</p>
      ${teacherWorkspaceSubnavHtml("materials", tx)}
      ${teacherPathStripHtml("materials", tx)}
      <header class="card teacher-admin-header">
        <h1 class="teacher-admin-title">${escapeHtml(tx("teacher.materials_page.title"))}</h1>
        <p class="teacher-admin-subtitle">${escapeHtml(tx("teacher.materials_page.subtitle"))}</p>
        <p class="teacher-admin-tagline">${escapeHtml(tx("teacher.materials_page.tagline"))}</p>
        <p class="teacher-admin-workflow-note">${escapeHtml(tx("teacher.materials_page.classroom_note"))}</p>
      </header>
      ${teacherMaterialsNextGuideHtml(tx)}

      <section class="card teacher-admin-toolbar" aria-label="${escapeHtml(tx("teacher.materials_page.upload_cta"))}">
        <div class="teacher-admin-toolbar-row">
          <button type="button" class="teacher-admin-btn teacher-admin-btn--disabled" disabled>
            ${escapeHtml(tx("teacher.materials_page.upload_cta"))}
          </button>
          <p class="teacher-admin-toolbar-hint">${escapeHtml(tx("teacher.materials_page.upload_note"))}</p>
        </div>
      </section>

      <section class="card teacher-admin-list-card" aria-labelledby="teacher-materials-list-title">
        <h2 id="teacher-materials-list-title" class="teacher-admin-list-heading">${escapeHtml(tx("teacher.materials_page.list_title"))}</h2>
        <p class="teacher-demo-disclosure">${escapeHtml(tx("teacher.demo.disclosure"))}</p>
        <p class="teacher-list-demo-note">${escapeHtml(tx("teacher.materials_page.list_demo_note"))}</p>
        <div class="teacher-manage-table-scroll">
          <table class="teacher-manage-table">
            <thead>
              <tr>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_name"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_type"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_status"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_prepare_phase"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_used_courses"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_listing_prep"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_updated"))}</th>
                <th scope="col" class="teacher-manage-col-actions">${escapeHtml(tx("teacher.materials_page.th_actions"))}</th>
              </tr>
            </thead>
            <tbody>
              ${materialsTableBody()}
            </tbody>
          </table>
        </div>
      </section>

      <aside class="teacher-info-note">
        <p class="teacher-info-note-title">${escapeHtml(tx("teacher.materials_page.relation_title"))}</p>
        <p class="teacher-info-note-lead">${escapeHtml(tx("teacher.materials_page.relation_note_short"))}</p>
        <ul class="teacher-info-note-list">
          <li>${escapeHtml(tx("teacher.materials_page.relation_item_1"))}</li>
          <li>${escapeHtml(tx("teacher.materials_page.relation_item_2"))}</li>
          <li>${escapeHtml(tx("teacher.materials_page.relation_item_3"))}</li>
        </ul>
      </aside>
    </div>
  `;
  i18n.apply?.(root);
}

export default function pageTeacherMaterials(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  __matRootRef = root;
  if (__matLangHandler) window.removeEventListener("joy:langChanged", __matLangHandler);
  __matLangHandler = () => {
    if (__matRootRef?.isConnected) renderMaterialsDom(__matRootRef);
  };
  window.addEventListener("joy:langChanged", __matLangHandler);

  renderMaterialsDom(root);
}

export function mount(ctxOrRoot) {
  return pageTeacherMaterials(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherMaterials(ctxOrRoot);
}
