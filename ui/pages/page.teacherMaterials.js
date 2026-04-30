// 我的教材：按当前老师 profile 过滤；未通过审核时受限说明。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import {
  formatDemoMaterialCoursesLine,
  formatDemoMaterialListingPrep,
  formatDemoMaterialPhasePill,
  formatDemoMaterialUsageChipLabel,
  formatDemoMaterialCategory,
  formatDemoShortUpdated,
  getDemoMaterialPhaseKey,
} from "../lumina-commerce/teacherDemoCatalog.js";
import { createTeacherMaterialSignedUrl, shouldUseSupabaseMaterials } from "../lumina-commerce/teacherMaterialsSupabase.js";
import {
  isLocalMockMaterialId,
  listMaterialsForTeacherProfile,
  mockDeleteTeacherMaterial,
  mockRenameTeacherMaterial,
  mockSetTeacherMaterialCategory,
  submitLocalMaterialUpload,
  validateLocalMaterialFile,
} from "../lumina-commerce/teacherMaterialsService.js";
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

function localUploadTypeLabelKey(fileName) {
  const n = String(fileName || "").toLowerCase();
  if (/\.pdf$/i.test(n)) return "teacher.materials_page.local_upload_row.type_pdf";
  if (/\.(ppt|pptx)$/i.test(n)) return "teacher.materials_page.local_upload_row.type_ppt";
  if (/\.(doc|docx)$/i.test(n)) return "teacher.materials_page.local_upload_row.type_doc";
  if (/\.(png|jpg|jpeg|webp)$/i.test(n)) return "teacher.materials_page.local_upload_row.type_image";
  return "teacher.materials_page.local_upload_row.type_file";
}

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
 * 本地上传：页内卡片（标题区下方、列表上方），非全屏弹层。
 * @param {(a: string, b?: object) => string} t
 * @param {string} uploadStageHint 来自 `upload_next_stage` 的说明句
 * @param {string} uploadSubmitLabel 提交按钮文案（云端 / 演示分支）
 */
function localUploadSectionHtml(t, uploadStageHint, uploadSubmitLabel) {
  return `
<section class="card teacher-local-upload" id="teacher-materials-local-upload" data-mat-upload-root aria-labelledby="mat-local-upload-h2">
  <h2 id="mat-local-upload-h2" class="teacher-local-upload__h2">${escapeHtml(t("teacher.materials_page.upload_modal_title"))}</h2>
  <p class="teacher-local-upload__stage">${escapeHtml(uploadStageHint)}</p>
  <p class="teacher-local-upload__types">${escapeHtml(t("teacher.materials_page.upload_modal_types"))}</p>
  <p class="teacher-local-upload__session-hint">${escapeHtml(t("teacher.materials_page.local_upload_list_hint"))}</p>
  <div class="teacher-local-upload__drop" data-mat-upload-drop tabindex="0" role="button" aria-label="${escapeHtml(t("teacher.materials_page.upload_modal_browse"))}">
    <input type="file" class="teacher-local-upload__input" data-mat-upload-input accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.webp" />
    <p class="teacher-local-upload__drop-line">
      <span>${escapeHtml(t("teacher.materials_page.upload_modal_drop"))}</span>
      <button type="button" class="teacher-local-upload__browse" data-mat-upload-browse>${escapeHtml(t("teacher.materials_page.upload_modal_browse"))}</button>
    </p>
    <p class="teacher-local-upload__picked" data-mat-upload-filename hidden></p>
  </div>
  <label class="teacher-local-upload__field">
    <span class="teacher-local-upload__label">${escapeHtml(t("teacher.materials_page.upload_modal_name_label"))}</span>
    <input type="text" class="teacher-local-upload__textinp" data-mat-upload-title-inp autocomplete="off" />
  </label>
  <p class="teacher-local-upload__err" data-mat-upload-err role="alert" hidden></p>
  <div class="teacher-local-upload__progress" data-mat-upload-progress hidden>
    <div class="teacher-local-upload__progress-track">
      <div class="teacher-local-upload__progress-bar" data-mat-upload-progress-bar></div>
    </div>
  </div>
  <div class="teacher-local-upload__actions">
    <button type="button" class="teacher-local-upload__btn teacher-local-upload__btn--primary" data-mat-upload-submit>${escapeHtml(uploadSubmitLabel)}</button>
  </div>
</section>`;
}

/**
 * @param {import('../lumina-commerce/teacherMaterialsService.js').TeacherMaterialListRow[]} materials
 * @param {(a: string, b?: object) => string} t
 */
function materialsTableBody(materials, t) {
  return materials.map((m) => {
    const isCloudRow = Boolean(m.cloudSource);
    const isLocalRow = isLocalMockMaterialId(m.id);
    const usedIds = Array.isArray(m.usedByCourseIds) ? m.usedByCourseIds : [];
    const titleDisplayRaw =
      m.titleOverride != null && String(m.titleOverride).trim() !== ""
        ? String(m.titleOverride).trim()
        : isLocalRow && m.localSourceFileName
          ? String(m.localSourceFileName).replace(/\.[^.]+$/, "") || String(m.localSourceFileName)
          : isCloudRow && m.localSourceFileName
            ? String(m.localSourceFileName).replace(/\.[^.]+$/, "") || String(m.localSourceFileName)
            : t(`teacher.demo.material.${m.id}.title`);
    const title = escapeHtml(titleDisplayRaw);
    const type = escapeHtml(
      (isCloudRow || isLocalRow) && m.localSourceFileName
        ? t(localUploadTypeLabelKey(m.localSourceFileName))
        : t(`teacher.demo.material.${m.id}.type`),
    );
    const status = escapeHtml(
      isCloudRow
        ? t("teacher.materials_page.cloud_row.status")
        : isLocalRow
          ? t("teacher.materials_page.local_upload_row.status")
          : t(`teacher.demo.material.${m.id}.status`),
    );
    const badgeHtml = isCloudRow
      ? `<span class="teacher-cloud-storage-badge">${escapeHtml(t("teacher.materials_page.cloud_storage_badge"))}</span>`
      : isLocalRow
        ? `<span class="teacher-local-session-badge">${escapeHtml(t("teacher.materials_page.local_upload_badge"))}</span>`
        : `<span class="teacher-demo-badge">${escapeHtml(t("common.demo_badge"))}</span>`;
    const rowSafe = {
      ...m,
      usedByCourseIds: usedIds,
      listingPrepKey: m.listingPrepKey || "not_yet_ready",
    };
    const phaseKey = getDemoMaterialPhaseKey(rowSafe);
    const phaseLabel = escapeHtml(formatDemoMaterialPhasePill(phaseKey, t));
    const phaseClass = escapeHtml(String(phaseKey).replace(/[^a-z0-9_-]/gi, ""));
    const categoryLabel = escapeHtml(formatDemoMaterialCategory(rowSafe, t));
    const usageChip = escapeHtml(formatDemoMaterialUsageChipLabel(rowSafe, t));
    const usageChipMod = usedIds.length ? "" : " teacher-mini-chip--muted";
    const coursesDetail =
      usedIds.length > 0
        ? `<div class="teacher-meta-subline">${escapeHtml(formatDemoMaterialCoursesLine(rowSafe, t))}</div>`
        : "";
    const listingPrep = escapeHtml(formatDemoMaterialListingPrep(rowSafe, t));
    const updated = escapeHtml(formatDemoShortUpdated(m.updated_at));
    const deleteBlocked = usedIds.length > 0;
    const deleteHint = escapeHtml(t("teacher.materials_page.delete_blocked_hint"));
    const deleteBtnAttrs = deleteBlocked
      ? ` class="teacher-material-row-actions__btn teacher-material-row-actions__btn--danger" disabled aria-disabled="true" title="${deleteHint}" aria-label="${deleteHint}"`
      : ` class="teacher-material-row-actions__btn teacher-material-row-actions__btn--danger"`;
    const stPath = String(m.storagePath || "").trim();
    const stBucket = String(m.storageBucket || "teacher-materials");
    const cloudFileActions =
      isCloudRow && stPath
        ? `<button type="button" class="teacher-material-row-actions__btn" data-mat-row-act="open" data-mat-storage-path="${escapeHtml(stPath)}" data-mat-storage-bucket="${escapeHtml(stBucket)}">${escapeHtml(t("teacher.materials_page.action_open"))}</button><button type="button" class="teacher-material-row-actions__btn" data-mat-row-act="download" data-mat-storage-path="${escapeHtml(stPath)}" data-mat-storage-bucket="${escapeHtml(stBucket)}" data-mat-filename="${escapeHtml(m.localSourceFileName || "file")}">${escapeHtml(t("teacher.materials_page.action_download"))}</button>`
        : "";
    return `<tr>
      <td class="teacher-manage-cell-title">
        ${badgeHtml}
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
      <td class="teacher-manage-col-actions">
        <div class="teacher-material-row-actions" role="toolbar" aria-label="${escapeHtml(t("teacher.materials_page.actions_toolbar_aria"))}">
          ${cloudFileActions}
          <button type="button" class="teacher-material-row-actions__btn" data-mat-row-act="rename" data-mat-id="${escapeHtml(m.id)}" data-mat-cur-title="${escapeHtml(titleDisplayRaw)}">${escapeHtml(t("teacher.materials_page.action_rename"))}</button>
          <button type="button" class="teacher-material-row-actions__btn" data-mat-row-act="category" data-mat-id="${escapeHtml(m.id)}" data-mat-cur-cat="${escapeHtml(m.materialCategoryKey)}">${escapeHtml(t("teacher.materials_page.action_category"))}</button>
          <button type="button"${deleteBtnAttrs} data-mat-row-act="delete" data-mat-id="${escapeHtml(m.id)}">${escapeHtml(t("teacher.materials_page.action_delete"))}</button>
        </div>
      </td>
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
  try {
    let ctx;
    try {
      ctx = await getTeacherPageContext();
    } catch {
      root.innerHTML = `<div class="teacher-page wrap teacher-manage-page"><p>${escapeHtml(t("common.loading"))}</p></div>`;
      return;
    }

    let materials = [];
    try {
      const canLoad = Boolean(ctx.isTeacherRole && ctx.isApproved && ctx.profile);
      if (canLoad) {
        materials = await listMaterialsForTeacherProfile(ctx.profile.id);
      }
    } catch (e) {
      console.error("[teacher-materials] listMaterialsForTeacherProfile:", e);
      materials = [];
    }

    const canShowLibrary = ctx.isTeacherRole && ctx.isApproved;

    let uploadHint = t("teacher.materials_page.upload_next_stage");
    let uploadSubmitLabel = t("teacher.materials_page.upload_modal_submit");
    if (canShowLibrary) {
      const uploadUsesCloud = await shouldUseSupabaseMaterials();
      if (uploadUsesCloud) {
        uploadHint = t("teacher.materials_page.upload_next_stage_cloud");
        uploadSubmitLabel = t("teacher.materials_page.upload_modal_submit_cloud");
      }
    }

  const headTitle = canShowLibrary
    ? t("teacher.materials_page.mine_page_title", { name: ctx.profile?.display_name || "" })
    : t("teacher.materials_page.title");
  const headSubtitle = canShowLibrary
    ? t("teacher.materials_page.mine_page_subtitle")
    : t("teacher.materials_page.subtitle");

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

      ${canShowLibrary ? localUploadSectionHtml(t, uploadHint, uploadSubmitLabel) : ""}

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
  const profileIdForUpload = canShowLibrary ? ctx.profile?.id ?? null : null;
  bindMaterialsInteractions(root, t, profileIdForUpload);
  } catch (e) {
    console.error("[teacher-materials] renderMaterialsDom:", e);
    root.innerHTML = `<div class="teacher-page wrap teacher-manage-page card" style="padding:20px;">
      <p style="font-weight:800;margin:0 0 8px;">${escapeHtml(t("router.error_title"))}</p>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">${escapeHtml(t("teacher.materials_page.render_err_hint"))}</p>
    </div>`;
  }
}

/**
 * 我的教材页交互：页内本地上传区、新建下拉；「本地上传」入口滚动到上传卡片。
 * @param {HTMLElement} root
 * @param {(a: string, b?: object) => string} t
 * @param {string|null} teacherProfileId
 */
function bindMaterialsInteractions(root, t, teacherProfileId) {
  /** @type {File|null} */
  let pickedFile = null;

  const panel = /** @type {HTMLElement|null} */ (root.querySelector("[data-mat-upload-root]"));
  const errEl = /** @type {HTMLElement|null} */ (panel?.querySelector("[data-mat-upload-err]"));
  const nameEl = /** @type {HTMLElement|null} */ (panel?.querySelector("[data-mat-upload-filename]"));
  const titleInp = /** @type {HTMLInputElement|null} */ (panel?.querySelector("[data-mat-upload-title-inp]"));
  const fileInp = /** @type {HTMLInputElement|null} */ (panel?.querySelector("[data-mat-upload-input]"));
  const progressWrap = /** @type {HTMLElement|null} */ (panel?.querySelector("[data-mat-upload-progress]"));
  const progressBar = /** @type {HTMLElement|null} */ (panel?.querySelector("[data-mat-upload-progress-bar]"));
  const submitBtn = /** @type {HTMLButtonElement|null} */ (panel?.querySelector("[data-mat-upload-submit]"));
  const dropZone = /** @type {HTMLElement|null} */ (panel?.querySelector("[data-mat-upload-drop]"));

  function setErr(msg) {
    if (!errEl) return;
    if (!msg) {
      errEl.hidden = true;
      errEl.textContent = "";
      return;
    }
    errEl.hidden = false;
    errEl.textContent = msg;
  }

  function resetUploadForm() {
    pickedFile = null;
    if (fileInp) fileInp.value = "";
    if (titleInp) titleInp.value = "";
    if (nameEl) {
      nameEl.hidden = true;
      nameEl.textContent = "";
    }
    setErr("");
    if (progressWrap) progressWrap.hidden = true;
    if (progressBar) progressBar.style.width = "0%";
    if (submitBtn) submitBtn.disabled = false;
  }

  function scrollToLocalUpload() {
    const el = document.getElementById("teacher-materials-local-upload");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => dropZone?.focus(), 280);
  }

  function focusUploadFromNav() {
    if (!teacherProfileId) {
      try {
        alert(`${t("teacher.access.library_locked_title")}\n\n${t("teacher.access.library_locked_body")}`);
      } catch {
        /* noop */
      }
      return;
    }
    const dd = /** @type {HTMLDetailsElement|null} */ (root.querySelector('[data-mat-new-dropdown="1"]'));
    if (dd) dd.open = false;
    scrollToLocalUpload();
  }

  function applyPickedFile(file) {
    pickedFile = file;
    const v = validateLocalMaterialFile(file);
    if (!v.ok) {
      setErr(
        v.reason === "type"
          ? t("teacher.materials_page.upload_err_type")
          : v.reason === "size"
            ? t("teacher.materials_page.upload_err_size")
            : t("teacher.materials_page.upload_err_no_file"),
      );
      if (nameEl) nameEl.hidden = true;
      return;
    }
    setErr("");
    if (nameEl) {
      nameEl.hidden = false;
      nameEl.textContent = file.name;
    }
    if (titleInp && !titleInp.value.trim()) {
      titleInp.value = file.name.replace(/\.[^.]+$/, "") || file.name;
    }
  }

  root.querySelectorAll('[data-mat-local-upload="1"]').forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      focusUploadFromNav();
    });
  });

  dropZone?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInp?.click();
    }
  });

  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) applyPickedFile(f);
  });

  panel?.querySelector("[data-mat-upload-browse]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInp?.click();
  });
  fileInp?.addEventListener("change", () => {
    const f = fileInp.files?.[0];
    if (f) applyPickedFile(f);
  });

  submitBtn?.addEventListener("click", async () => {
    if (!teacherProfileId || !panel) return;
    const v = validateLocalMaterialFile(pickedFile || undefined);
    if (!v.ok) {
      setErr(
        v.reason === "type"
          ? t("teacher.materials_page.upload_err_type")
          : v.reason === "size"
            ? t("teacher.materials_page.upload_err_size")
            : t("teacher.materials_page.upload_err_no_file"),
      );
      return;
    }
    const title = (titleInp?.value || "").trim() || pickedFile?.name || "";
    setErr("");
    submitBtn.disabled = true;
    if (progressWrap) progressWrap.hidden = false;
    if (progressBar) {
      progressBar.style.width = "0%";
      requestAnimationFrame(() => {
        progressBar.style.width = "100%";
      });
    }
    try {
      const r = await submitLocalMaterialUpload({
        teacherProfileId: String(teacherProfileId),
        file: /** @type {File} */ (pickedFile),
        title,
      });
      if (!r.ok) {
        setErr(
          r.reason === "type"
            ? t("teacher.materials_page.upload_err_type")
            : r.reason === "size"
              ? t("teacher.materials_page.upload_err_size")
              : r.reason === "auth" || r.reason === "storage" || r.reason === "db"
                ? t("teacher.materials_page.upload_err_cloud")
                : t("teacher.materials_page.upload_err_no_file"),
        );
        return;
      }
      resetUploadForm();
      void renderMaterialsDom(root);
      window.setTimeout(() => {
        document.getElementById("teacher-materials-list-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } catch {
      setErr(t("teacher.materials_page.upload_err_no_file"));
    } finally {
      submitBtn.disabled = false;
      if (progressWrap) progressWrap.hidden = true;
      if (progressBar) progressBar.style.width = "0%";
    }
  });

  const dropdown = /** @type {HTMLDetailsElement|null} */ (root.querySelector('[data-mat-new-dropdown="1"]'));
  if (dropdown) {
    const onDocClick = (ev) => {
      if (!dropdown.open) return;
      const target = /** @type {Node|null} */ (ev.target);
      if (target && !dropdown.contains(target)) dropdown.open = false;
    };
    document.addEventListener("click", onDocClick, { passive: true });
  }

  if (readShouldOpenNew() && teacherProfileId) {
    window.setTimeout(() => scrollToLocalUpload(), 120);
  }

  const mainEl = /** @type {HTMLElement|null} */ (root.querySelector("[data-teacher-main]"));
  mainEl?.addEventListener("click", (e) => {
    const btn = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target.closest("[data-mat-row-act]") : null);
    if (!btn || !mainEl.contains(btn)) return;
    const act = btn.getAttribute("data-mat-row-act");
    if (!act) return;

    if (act === "open" || act === "download") {
      const stPath = btn.getAttribute("data-mat-storage-path") || "";
      const stBucketRaw = btn.getAttribute("data-mat-storage-bucket");
      if (!stPath.trim()) return;
      e.preventDefault();
      const stBucket = stBucketRaw && stBucketRaw.trim() ? stBucketRaw.trim() : undefined;
      void (async () => {
        const r = await createTeacherMaterialSignedUrl(stPath, stBucket);
        if (!r.ok) {
          window.alert(t("teacher.materials_page.open_signed_url_err"));
          return;
        }
        if (act === "open") {
          window.open(r.url, "_blank", "noopener,noreferrer");
        } else {
          const fn = btn.getAttribute("data-mat-filename") || "download";
          const a = document.createElement("a");
          a.href = r.url;
          a.download = fn;
          a.rel = "noopener noreferrer";
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      })();
      return;
    }

    if (!teacherProfileId) return;
    const mid = btn.getAttribute("data-mat-id");
    if (!mid) return;
    e.preventDefault();
    const pid = String(teacherProfileId);
    void (async () => {
      if (act === "rename") {
        const def = btn.getAttribute("data-mat-cur-title") || "";
        const next = window.prompt(t("teacher.materials_page.rename_prompt"), def);
        if (next === null) return;
        const r = await mockRenameTeacherMaterial(pid, mid, next);
        if (!r.ok) {
          window.alert(r.reason === "empty" ? t("teacher.materials_page.err_rename_empty") : t("common.error.unknown"));
          return;
        }
        void renderMaterialsDom(root);
        return;
      }
      if (act === "category") {
        const def = btn.getAttribute("data-mat-cur-cat") || "";
        const next = window.prompt(t("teacher.materials_page.category_prompt"), def);
        if (next === null) return;
        const r = await mockSetTeacherMaterialCategory(pid, mid, next);
        if (!r.ok) {
          window.alert(t("teacher.materials_page.err_category_invalid"));
          return;
        }
        void renderMaterialsDom(root);
        return;
      }
      if (act === "delete") {
        if (!window.confirm(t("teacher.materials_page.delete_confirm"))) return;
        const r = await mockDeleteTeacherMaterial(pid, mid);
        if (!r.ok) {
          window.alert(
            r.reason === "in_use"
              ? t("teacher.materials_page.delete_blocked_hint")
              : r.reason === "storage" || r.reason === "db"
                ? t("teacher.materials_page.upload_err_cloud")
                : t("common.error.unknown"),
          );
          return;
        }
        void renderMaterialsDom(root);
      }
    })();
  });
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

  return renderMaterialsDom(root);
}

export function mount(ctxOrRoot) {
  return pageTeacherMaterials(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherMaterials(ctxOrRoot);
}
