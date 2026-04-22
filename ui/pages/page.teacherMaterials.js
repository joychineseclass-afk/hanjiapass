// 我的教材：按当前老师 profile 过滤；未通过审核时受限说明。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import {
  getDemoMaterialsForProfile,
  formatDemoMaterialCoursesLine,
  formatDemoMaterialListingPrep,
  formatDemoMaterialPhasePill,
  formatDemoMaterialUsageChipLabel,
  formatDemoShortUpdated,
  getDemoMaterialPhaseKey,
} from "../lumina-commerce/teacherDemoCatalog.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { i18n } from "../i18n.js";
import {
  teacherBackToWorkspaceHtml,
  teacherMaterialsNextGuideHtml,
  teacherPathStripHtml,
  teacherPathStripClassroomHintHtml,
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

/**
 * @param {Array<{ id: string, updated_at: string, usedByCourseIds: string[], listingPrepKey: string }>} materials
 * @param {(a: string, b?: object) => string} t
 */
function materialsTableBody(materials, t) {
  return materials.map((m) => {
    const title = escapeHtml(t(`teacher.demo.material.${m.id}.title`));
    const type = escapeHtml(t(`teacher.demo.material.${m.id}.type`));
    const status = escapeHtml(t(`teacher.demo.material.${m.id}.status`));
    const phaseKey = getDemoMaterialPhaseKey(m);
    const phaseLabel = escapeHtml(formatDemoMaterialPhasePill(phaseKey, t));
    const phaseClass = escapeHtml(String(phaseKey).replace(/[^a-z0-9_-]/gi, ""));
    const usageChip = escapeHtml(formatDemoMaterialUsageChipLabel(m, t));
    const usageChipMod = m.usedByCourseIds.length ? "" : " teacher-mini-chip--muted";
    const coursesDetail =
      m.usedByCourseIds.length > 0
        ? `<div class="teacher-meta-subline">${escapeHtml(formatDemoMaterialCoursesLine(m, t))}</div>`
        : "";
    const listingPrep = escapeHtml(formatDemoMaterialListingPrep(m, t));
    const updated = escapeHtml(formatDemoShortUpdated(m.updated_at));
    const badge = escapeHtml(t("common.demo_badge"));
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
      <td class="teacher-manage-col-actions">${escapeHtml(t("teacher.materials_page.demo_action_placeholder"))}</td>
    </tr>`;
  }).join("");
}

/**
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 * @param {(a: string, b?: object) => string} t
 */
function restrictedBannerHtml(ctx, t) {
  if (ctx.workbenchStatus === "not_teacher") {
    return `<div class="card teacher-access-gate" role="status">
      <p class="teacher-access-gate-title">${escapeHtml(t("teacher.access.not_teacher_title"))}</p>
      <p class="teacher-access-gate-body">${escapeHtml(t("teacher.access.not_teacher_body"))}</p>
    </div>`;
  }
  if (!ctx.isApproved) {
    const w = String(ctx.workbenchStatus);
    return `<div class="card teacher-access-gate" role="status">
      <p class="teacher-access-gate-title">${escapeHtml(t(`teacher.gate.title_${w}`))}</p>
      <p class="teacher-access-gate-body">${escapeHtml(t("teacher.access.need_approved_body"))}</p>
    </div>`;
  }
  return "";
}

async function renderMaterialsDom(root) {
  const t = tx;
  let ctx;
  try {
    ctx = await getTeacherPageContext();
  } catch {
    root.innerHTML = `<div class="teacher-page wrap teacher-manage-page"><p>${escapeHtml(t("common.loading"))}</p></div>`;
    return;
  }

  const canShowLibrary = ctx.isTeacherRole && ctx.isApproved;
  const materials = canShowLibrary && ctx.profile ? getDemoMaterialsForProfile(ctx.profile.id) : [];
  const headTitle = canShowLibrary
    ? t("teacher.materials_page.mine_page_title", { name: ctx.profile?.display_name || "" })
    : t("teacher.materials_page.title");
  const headSubtitle = canShowLibrary
    ? t("teacher.materials_page.mine_page_subtitle")
    : t("teacher.materials_page.subtitle");
  const uploadHint = t("teacher.materials_page.upload_next_stage");

  const tableRows = materialsTableBody(materials, t);
  const lockedBody = `<tbody><tr class="teacher-manage-empty-row"><td colspan="8">
        <div class="teacher-manage-empty">
          <p class="teacher-manage-empty-title">${escapeHtml(t("teacher.access.library_locked_title"))}</p>
          <p class="teacher-manage-empty-intro">${escapeHtml(t("teacher.access.library_locked_body"))}</p>
        </div>
      </td></tr></tbody>`;
  const emptyMineBody = `<tbody><tr class="teacher-manage-empty-row"><td colspan="8">
        <div class="teacher-manage-empty">
          <p class="teacher-manage-empty-title">${escapeHtml(t("teacher.materials_page.empty_mine_title"))}</p>
          <p class="teacher-manage-empty-intro">${escapeHtml(t("teacher.materials_page.empty_mine_body"))}</p>
        </div>
      </td></tr></tbody>`;
  let tbodyOnly = `<tbody>${tableRows}</tbody>`;
  if (!canShowLibrary) {
    tbodyOnly = lockedBody;
  } else if (materials.length === 0) {
    tbodyOnly = emptyMineBody;
  }

  root.innerHTML = `
    <div class="teacher-page wrap teacher-manage-page teacher-admin-shell">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker teacher-page-kicker--shell">${escapeHtml(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("materials", t)}
      ${restrictedBannerHtml(ctx, t)}
      ${teacherPathStripHtml("materials", t)}
      ${teacherPathStripClassroomHintHtml(t)}
      <header class="card teacher-admin-header">
        <h1 class="teacher-admin-title">${escapeHtml(headTitle)}</h1>
        <p class="teacher-admin-subtitle">${escapeHtml(headSubtitle)}</p>
        <p class="teacher-admin-tagline">${escapeHtml(t("teacher.materials_page.tagline"))}</p>
        <p class="teacher-admin-workflow-note">${escapeHtml(t("teacher.materials_page.classroom_note_mine"))}</p>
      </header>
      ${ctx.isApproved ? teacherMaterialsNextGuideHtml(t) : ""}

      <section class="card teacher-admin-toolbar" aria-label="${escapeHtml(t("teacher.materials_page.upload_cta"))}">
        <div class="teacher-admin-toolbar-row">
          <button type="button" class="teacher-admin-btn teacher-admin-btn--disabled" disabled>
            ${escapeHtml(t("teacher.materials_page.upload_cta"))}
          </button>
          <p class="teacher-admin-toolbar-hint teacher-admin-toolbar-hint--stage">${escapeHtml(uploadHint)}</p>
        </div>
      </section>

      <section class="card teacher-admin-list-card" aria-labelledby="teacher-materials-list-title">
        <h2 id="teacher-materials-list-title" class="teacher-admin-list-heading">${escapeHtml(t("teacher.materials_page.list_title_mine"))}</h2>
        <p class="teacher-demo-disclosure">${escapeHtml(t("teacher.demo.disclosure_mine"))}</p>
        <p class="teacher-list-demo-note">${escapeHtml(t("teacher.materials_page.list_mine_note"))}</p>
        <div class="teacher-manage-table-scroll">
          <table class="teacher-manage-table">
            <thead>
              <tr>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_name"))}</th>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_type"))}</th>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_status"))}</th>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_prepare_phase"))}</th>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_used_courses"))}</th>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_listing_prep"))}</th>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_updated"))}</th>
                <th scope="col" class="teacher-manage-col-actions">${escapeHtml(t("teacher.materials_page.th_actions"))}</th>
              </tr>
            </thead>
            ${tbodyOnly}
          </table>
        </div>
      </section>

      <aside class="teacher-info-note">
        <p class="teacher-info-note-title">${escapeHtml(t("teacher.materials_page.relation_title"))}</p>
        <p class="teacher-info-note-lead">${escapeHtml(t("teacher.materials_page.relation_note_mine"))}</p>
        <ul class="teacher-info-note-list">
          <li>${escapeHtml(t("teacher.materials_page.relation_item_1"))}</li>
          <li>${escapeHtml(t("teacher.materials_page.relation_item_2"))}</li>
          <li>${escapeHtml(t("teacher.materials_page.relation_item_3"))}</li>
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
    if (__matRootRef?.isConnected) void renderMaterialsDom(__matRootRef);
  };
  window.addEventListener("joy:langChanged", __matLangHandler);

  void renderMaterialsDom(root);
}

export function mount(ctxOrRoot) {
  return pageTeacherMaterials(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherMaterials(ctxOrRoot);
}
