// 我的教材：按当前老师 profile 过滤；未通过审核时受限说明。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import {
  getDemoMaterialsForProfile,
  formatDemoMaterialCoursesLine,
  formatDemoMaterialListingPrep,
  formatDemoMaterialPhasePill,
  formatDemoMaterialUsageChipLabel,
  formatDemoMaterialCategory,
  formatDemoShortUpdated,
  getDemoMaterialPhaseKey,
} from "../lumina-commerce/teacherDemoCatalog.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { i18n } from "../i18n.js";
import {
  currentUserCanAccessTeacherReviewConsoleSync,
  renderTeacherAdminShell,
  teacherMaterialsNextGuideHtml,
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

/** @type {readonly { kind: string, labelKey: string, hrefHash: string }[]} */
const NEW_MATERIAL_KINDS = [
  { kind: "pdf", labelKey: "teacher.create_material.type_pdf", hrefHash: "#teacher-create-material?kind=pdf" },
  { kind: "doc", labelKey: "teacher.create_material.type_doc", hrefHash: "#teacher-create-material?kind=doc" },
  { kind: "picture_book", labelKey: "teacher.create_material.type_picture_book", hrefHash: "#teacher-create-material?kind=picture_book" },
  { kind: "handout", labelKey: "teacher.create_material.type_handout", hrefHash: "#teacher-create-material?kind=handout" },
  { kind: "deck", labelKey: "teacher.create_material.type_deck", hrefHash: "#teacher-create-material?kind=deck" },
];

/** 从 `#teacher-materials?new=1` 中读出是否应展开「新建教材」下拉。 */
function readShouldOpenNew() {
  try {
    const h = String(location.hash || "");
    const qi = h.indexOf("?");
    if (qi < 0) return false;
    const sp = new URLSearchParams(h.slice(qi));
    return sp.get("new") === "1";
  } catch {
    return false;
  }
}

/**
 * 「我的教材」页主入口下拉：本地上传 + 5 种类型创建。
 * @param {(a: string, b?: object) => string} t
 * @param {boolean} openByDefault
 */
function newMaterialDropdownHtml(t, openByDefault) {
  const kindItems = NEW_MATERIAL_KINDS.map(
    ({ labelKey, hrefHash }) =>
      `<a class="teacher-new-material-item" role="menuitem" href="${escapeHtml(hrefHash)}">${escapeHtml(t(labelKey))}</a>`,
  ).join("");
  return `
    <details class="teacher-new-material" data-mat-new-dropdown="1"${openByDefault ? " open" : ""}>
      <summary class="teacher-new-material-trigger" aria-haspopup="menu">
        <span class="teacher-new-material-trigger-plus" aria-hidden="true">+</span>
        ${escapeHtml(t("teacher.materials_page.new_button"))}
        <span class="teacher-new-material-trigger-caret" aria-hidden="true">&#9662;</span>
      </summary>
      <div class="teacher-new-material-menu" role="menu" aria-label="${escapeHtml(t("teacher.materials_page.new_button"))}">
        <button type="button" class="teacher-new-material-item teacher-new-material-item--primary" role="menuitem" data-mat-local-upload="1">
          ${escapeHtml(t("teacher.materials_page.new_local_upload"))}
        </button>
        <p class="teacher-new-material-item-sub">${escapeHtml(t("teacher.materials_page.new_local_upload_sub"))}</p>
        <div class="teacher-new-material-divider" role="separator"></div>
        <p class="teacher-new-material-section-title">${escapeHtml(t("teacher.materials_page.new_section_create"))}</p>
        ${kindItems}
      </div>
    </details>
  `;
}

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
    const categoryLabel = escapeHtml(formatDemoMaterialCategory(m, t));
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
      <td><span class="teacher-material-category-pill">${categoryLabel}</span></td>
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
  const lockedBody = `<tbody><tr class="teacher-manage-empty-row"><td colspan="9">
        <div class="teacher-manage-empty">
          <p class="teacher-manage-empty-title">${escapeHtml(t("teacher.access.library_locked_title"))}</p>
          <p class="teacher-manage-empty-intro">${escapeHtml(t("teacher.access.library_locked_body"))}</p>
        </div>
      </td></tr></tbody>`;
  const emptyMineBody = `<tbody><tr class="teacher-manage-empty-row"><td colspan="9">
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

  const showReview = currentUserCanAccessTeacherReviewConsoleSync();
  const wantNewOpen = readShouldOpenNew();
  const main = `
      ${restrictedBannerHtml(ctx, t)}
      <header class="card teacher-admin-header teacher-admin-header--with-actions">
        <div class="teacher-admin-header-text">
          <h1 class="teacher-admin-title">${escapeHtml(headTitle)}</h1>
          <p class="teacher-admin-subtitle">${escapeHtml(headSubtitle)}</p>
        </div>
        ${canShowLibrary ? newMaterialDropdownHtml(t, wantNewOpen) : ""}
      </header>

      <section class="card teacher-admin-list-card" aria-labelledby="teacher-materials-list-title">
        <h2 id="teacher-materials-list-title" class="teacher-admin-list-heading">${escapeHtml(t("teacher.materials_page.list_title_mine"))}</h2>
        <p class="teacher-demo-disclosure">${escapeHtml(t("teacher.demo.disclosure_mine"))}</p>
        <p class="teacher-list-demo-note">${escapeHtml(t("teacher.materials_page.list_mine_note"))}</p>
        <div class="teacher-manage-table-scroll">
          <table class="teacher-manage-table">
            <thead>
              <tr>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_name"))}</th>
                <th scope="col">${escapeHtml(t("teacher.materials_page.th_category"))}</th>
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

      <section class="card teacher-admin-toolbar" aria-label="${escapeHtml(t("teacher.materials_page.upload_cta"))}">
        <div class="teacher-admin-toolbar-row">
          <button type="button" class="teacher-admin-btn teacher-admin-btn--disabled" disabled data-mat-local-upload="1">
            ${escapeHtml(t("teacher.materials_page.upload_cta"))}
          </button>
          <p class="teacher-admin-toolbar-hint teacher-admin-toolbar-hint--stage">${escapeHtml(uploadHint)}</p>
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
      ${ctx.isApproved ? teacherMaterialsNextGuideHtml(t) : ""}
  `;
  root.innerHTML = renderTeacherAdminShell({
    active: "materials",
    tx: t,
    showReviewConsole: showReview,
    mainHtml: main,
    shellClass: "teacher-page teacher-manage-page teacher-admin-shell",
  });
  i18n.apply?.(root);
  bindMaterialsInteractions(root, t);
}

/**
 * 我的教材页交互：
 *  - 「+ 新建教材」下拉中的本地上传按钮（占位）
 *  - 顶部按钮与底部「本地上传教材」共享同一占位提示
 *  - 点击下拉外部时关闭 `<details>`
 * @param {HTMLElement} root
 * @param {(a: string, b?: object) => string} t
 */
function bindMaterialsInteractions(root, t) {
  const onLocalUploadClick = (ev) => {
    ev.preventDefault();
    try {
      alert(t("teacher.materials_page.local_upload_coming_alert"));
    } catch {
      /* noop */
    }
  };
  root.querySelectorAll('[data-mat-local-upload="1"]').forEach((el) => {
    el.removeAttribute("disabled");
    el.addEventListener("click", onLocalUploadClick);
  });

  const dropdown = /** @type {HTMLDetailsElement|null} */ (root.querySelector('[data-mat-new-dropdown="1"]'));
  if (dropdown) {
    const onDocClick = (ev) => {
      if (!dropdown.open) return;
      const target = /** @type {Node|null} */ (ev.target);
      if (target && !dropdown.contains(target)) {
        dropdown.open = false;
      }
    };
    document.addEventListener("click", onDocClick, { passive: true });
  }
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
