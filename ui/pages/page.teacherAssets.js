// 我的课堂资产：本老师全部资产列表、进入课堂、编辑占位、归档

import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { updateTeacherAsset } from "../lumina-commerce/teacherAssetsStore.js";
import { listAssetsByProfileId, ASSET_STATUS } from "../lumina-commerce/teacherAssetsSelectors.js";
import { i18n } from "../i18n.js";
import {
  teacherBackToWorkspaceHtml,
  teacherPathStripClassroomHintHtml,
  teacherPathStripHtml,
  teacherWorkspaceSubnavHtml,
} from "./teacherPathNav.js";
import { formatDemoShortUpdated } from "../lumina-commerce/teacherDemoCatalog.js";

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

function assetStatusLabel(t, st) {
  return t(`teacher.assets.state.${st}`);
}

let __lang = /** @type {null | (() => void)} */ (null);
let __root = /** @type {HTMLElement | null} */ (null);

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} a
 * @param {(k: string, p?: object) => string} t
 */
function assetRow(a, t) {
  const src = a.source;
  const srcLine = t("teacher.assets.source_line", {
    course: formatTeacherHubCourseDisplay(src.course),
    level: String(src.level),
    lesson: String(src.lesson),
  });
  const stClass = `teacher-asset-status-chip--${String(a.status).replace(/[^a-z0-9_]/g, "_")}`;
  const archDisabled = a.status === ASSET_STATUS.archived;
  return `<tr>
    <td class="teacher-manage-cell-title">${escapeHtml(a.title)}</td>
    <td class="teacher-manage-cell-meta"><span class="teacher-asset-type-pill">${escapeHtml(t(`teacher.assets.type.${a.asset_type}`))}</span></td>
    <td>${escapeHtml(srcLine)}</td>
    <td><span class="teacher-asset-status-chip ${escapeHtml(stClass)}">${escapeHtml(assetStatusLabel(t, a.status))}</span></td>
    <td>${escapeHtml(formatDemoShortUpdated(a.updated_at))}</td>
    <td class="teacher-manage-col-actions">
      <a class="teacher-asset-link" href="#classroom?assetId=${encodeURIComponent(a.id)}">${escapeHtml(t("teacher.assets.enter_classroom"))}</a>
      <span class="teacher-asset-sep" aria-hidden="true">|</span>
      <button type="button" class="teacher-asset-ghost" disabled title="${escapeHtml(t("teacher.assets.edit_placeholder"))}">${escapeHtml(t("teacher.assets.edit"))}</button>
      <span class="teacher-asset-sep" aria-hidden="true">|</span>
      <button type="button" class="teacher-asset-ghost" data-teacher-asset-archive="${escapeHtml(a.id)}" ${
    archDisabled ? "disabled" : ""
  }>${escapeHtml(t("teacher.assets.archive"))}</button>
    </td>
  </tr>`;
}

async function renderPage(root) {
  const t = tx;
  let ctx;
  try {
    ctx = await getTeacherPageContext();
  } catch {
    root.innerHTML = `<div class="teacher-page wrap"><p>${escapeHtml(t("common.loading"))}</p></div>`;
    return;
  }

  if (!ctx.isTeacherRole) {
    root.innerHTML = `<div class="teacher-page wrap card teacher-identity-gate"><p class="teacher-identity-gate-body">${escapeHtml(
      t("teacher.access.not_teacher_body"),
    )}</p></div>`;
    i18n.apply?.(root);
    return;
  }
  if (!ctx.isApproved || !ctx.profile) {
    const w = String(ctx.workbenchStatus);
    root.innerHTML = `<div class="teacher-page wrap">
      <section class="card teacher-access-gate">
        <p class="teacher-access-gate-title">${escapeHtml(t(`teacher.gate.title_${w}`))}</p>
        <p class="teacher-access-gate-body">${escapeHtml(t("teacher.assets.gated"))}</p>
      </section>
    </div>`;
    i18n.apply?.(root);
    return;
  }

  const assets = listAssetsByProfileId(ctx.profile.id);
  const hasRows = assets.length > 0;
  const rows = hasRows ? assets.map((a) => assetRow(a, t)).join("") : "";
  const emptyBlock = hasRows
    ? ""
    : `<div class="teacher-assets-empty card">
         <h3 class="teacher-assets-empty-title">${escapeHtml(t("teacher.assets.empty_title"))}</h3>
         <p class="teacher-assets-empty-body">${escapeHtml(t("teacher.assets.empty_body"))}</p>
       </div>`;
  const tableBlock = hasRows
    ? `<div class="teacher-manage-table-scroll">
        <table class="teacher-manage-table">
          <thead>
            <tr>
              <th scope="col">${escapeHtml(t("teacher.assets.col_title"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_type"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_source"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_status"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_updated"))}</th>
              <th scope="col" class="teacher-manage-col-actions">${escapeHtml(t("teacher.assets.col_actions"))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    : "";

  root.innerHTML = `
    <div class="teacher-page wrap teacher-assets-page teacher-manage-page">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker teacher-page-kicker--shell">${escapeHtml(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("assets", t)}
      <header class="card teacher-admin-header">
        <h1 class="teacher-admin-title">${escapeHtml(t("teacher.assets.page_title"))}</h1>
        <p class="teacher-admin-subtitle">${escapeHtml(t("teacher.assets.page_subtitle", { name: ctx.profile.display_name }))}</p>
      </header>
      ${teacherPathStripHtml("assets", t)}
      ${teacherPathStripClassroomHintHtml(t)}

      ${emptyBlock}
      <section class="card teacher-assets-list-card" aria-label="${escapeHtml(t("teacher.assets.list_aria"))}">${tableBlock}</section>
    </div>
  `;

  root.querySelectorAll("[data-teacher-asset-archive]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const el = /** @type {HTMLButtonElement} */ (btn);
      const id = el.getAttribute("data-teacher-asset-archive");
      if (!id || el.disabled) return;
      ev.preventDefault();
      updateTeacherAsset({ id, status: ASSET_STATUS.archived });
      void renderPage(root);
    });
  });

  i18n.apply?.(root);
}

export default function pageTeacherAssets(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  __root = root;
  if (__lang) window.removeEventListener("joy:langChanged", __lang);
  __lang = () => {
    if (__root?.isConnected) void renderPage(__root);
  };
  window.addEventListener("joy:langChanged", __lang);

  void renderPage(root);
}

export function mount(ctxOrRoot) {
  return pageTeacherAssets(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherAssets(ctxOrRoot);
}
