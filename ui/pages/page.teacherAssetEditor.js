// #teacher-asset-editor?id=<tasset_xxx> — 课件型课堂资产最小编辑（localStorage）
import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import {
  findAssetById,
  updateTeacherAsset,
  getEffectiveTeacherNote,
  defaultSlideOutline,
  isTeacherAssetTrashed,
  moveTeacherAssetToTrash,
  TEACHER_ASSET_TRASH_RETENTION_DAYS,
  ASSET_STATUS,
  ASSET_TYPE,
} from "../lumina-commerce/teacherAssetsStore.js";
import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import {
  findListingByAssetId,
  ensureListingForTeacherAsset,
  submitTeacherAssetListingForReview,
  setClassroomAssetListingToPublic,
  setClassroomAssetListingToPrivate,
  syncClassroomAssetListingFromAsset,
  getAssetEditorPublishingModel,
} from "../lumina-commerce/teacherListingBridge.js";
import { LISTING_STATUS, VISIBILITY } from "../lumina-commerce/enums.js";
import { i18n } from "../i18n.js";
import { teacherBackToWorkspaceHtml, teacherWorkspaceSubnavHtml, userCanAccessTeacherReviewConsole } from "./teacherPathNav.js";

function tx(p, a) {
  return safeUiText(p, a);
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function parseIdFromHash() {
  const h = String(location.hash || "");
  const q = h.indexOf("?");
  if (q < 0) return "";
  return String(new URLSearchParams(h.slice(q + 1)).get("id") || "").trim();
}

/**
 * @param {(k: string, p?: object) => string} t
 */
function trashDraftConfirmMessage(t) {
  return [
    t("teacher.assets.trash_confirm_title"),
    "",
    t("teacher.assets.trash_confirm_not_immediate"),
    t("teacher.assets.trash_confirm_move"),
    t("teacher.assets.trash_confirm_keep_days", { days: String(TEACHER_ASSET_TRASH_RETENTION_DAYS) }),
    t("teacher.assets.trash_confirm_after_permanent"),
  ].join("\n");
}

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherSlideOutlineItemV1} item
 * @param {number} idx
 * @param {(k: string, p?: object) => string} t
 * @param {boolean} readOnly
 */
function outlineRowHtml(item, idx, t, readOnly) {
  const k = String(item.kind);
  const kindKey =
    { cover: "kind_cover", vocab: "kind_vocab", dialogue: "kind_dialogue", practice: "kind_practice", notes: "kind_notes" }[k] ||
    "kind_cover";
  const kindLabel = t(`teacher.asset_editor.${kindKey}`);
  const isNotes = k === "notes";
  const on = item.enabled !== false;
  return `<li class="teacher-asset-editor-outline-item ${isNotes ? "teacher-asset-editor-outline-item--notes" : ""} teacher-asset-editor-outline-item--${esc(k)}" data-outline-row data-idx="${idx}" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">
    <div class="teacher-asset-editor-outline-head">
      <span class="teacher-asset-editor-kind-pill" title="${esc(kindLabel)}">${esc(kindLabel)}</span>
    </div>
    <div class="teacher-asset-editor-outline-body">
      <label class="teacher-asset-editor-outline-title">
        <span class="teacher-asset-editor-sublabel">${esc(t("teacher.asset_editor.outline_item_title"))}</span>
        <input type="text" name="outline_title_${idx}" class="teacher-asset-editor-input" value="${esc(item.title)}" data-field="title"${readOnly ? " readonly" : ""} />
      </label>
      <div class="teacher-asset-editor-outline-en-wrap">
        <span class="teacher-asset-editor-sublabel" id="teacherOutlineEnL_${idx}">${esc(t("teacher.asset_editor.outline_enable_label"))}</span>
        <label class="teacher-asset-editor-en-toggle${readOnly ? " is-disabled" : ""}">
          <input type="checkbox" class="teacher-asset-editor-en-input" data-field="enabled" ${on ? "checked" : ""}${readOnly ? " disabled" : ""} aria-labelledby="teacherOutlineEnL_${idx}" />
          <span class="teacher-asset-editor-en-track" aria-hidden="true">
            <span class="teacher-asset-editor-en-thumb"></span>
          </span>
          <span class="teacher-asset-editor-en-state">${esc(
            on ? t("teacher.asset_editor.outline_state_on") : t("teacher.asset_editor.outline_state_off"),
          )}</span>
        </label>
      </div>
    </div>
  </li>`;
}

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} a
 * @param {(k: string, p?: object) => string} t
 * @param {string} userId
 * @param {string} profileId
 * @param {boolean} canEdit
 * @param {boolean} isArchived
 * @param {boolean} canMoveToTrash
 */
function editorFormHtml(a, t, userId, profileId, canEdit, isArchived, canMoveToTrash) {
  const src = a.source;
  const ro = canEdit && !isArchived ? "" : " readonly";
  const dis = canEdit && !isArchived ? "" : " disabled";
  const outline = (a.slide_outline && a.slide_outline.length ? a.slide_outline : defaultSlideOutline())
    .map((it, i) => outlineRowHtml(it, i, t, isArchived))
    .join("");
  const disHint = isArchived
    ? `<p class="teacher-asset-editor-banner teacher-asset-editor-banner--warn" role="status">${esc(t("teacher.asset_editor.readonly_archived"))}</p>`
    : "";
  const actionsBar = (suffix) => {
    const deleteBtn =
      suffix === "Bottom" && canMoveToTrash
        ? `<button type="button" class="teacher-hub-cta teacher-asset-editor-delete-deck" id="teacherAssetMoveToDraftTrash">${esc(
            t("teacher.asset_editor.delete_draft"),
          )}</button>`
        : "";
    return `
    <div class="teacher-asset-editor-actions teacher-asset-editor-actions--bar" id="teacherAssetEditorActions${suffix}">
      <button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetEditorSave${suffix}" data-save-bar="${suffix}" ${
    !canEdit || isArchived ? "disabled" : ""
  }>
        ${esc(t("teacher.asset_editor.save"))}
      </button>
      <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${esc(t("teacher.asset_editor.back_assets"))}</a>
      <a class="teacher-hub-cta teacher-hub-cta--accent" href="#classroom?assetId=${encodeURIComponent(a.id)}">${esc(
    t("teacher.asset_editor.to_classroom_teach"),
  )}</a>
      ${deleteBtn}
    </div>`;
  };
  return `
    <form id="teacherAssetEditorForm" class="teacher-asset-editor-form">
      ${disHint}
      <div class="teacher-asset-editor-toast" id="teacherAssetEditorToast" role="status" aria-live="polite" hidden></div>
      ${actionsBar("Top")}
      <div class="teacher-asset-editor-section card teacher-asset-editor-section--basics">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_basics"))}</h2>
        <p class="teacher-asset-editor-section-hint">${esc(t("teacher.asset_editor.section_basics_hint"))}</p>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.title"))}</span>
          <input class="teacher-asset-editor-input" name="title" value="${esc(a.title)}"${ro} required />
        </label>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.subtitle"))}</span>
          <input class="teacher-asset-editor-input" name="subtitle" value="${esc(a.subtitle || "")}"${ro} />
        </label>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.summary"))}</span>
          <textarea class="teacher-asset-editor-textarea" name="summary" rows="3"${ro}>${esc(a.summary || "")}</textarea>
        </label>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.cover_note"))}</span>
          <textarea class="teacher-asset-editor-textarea" name="cover_note" rows="2"${ro}>${esc(a.cover_note || "")}</textarea>
        </label>
      </div>
      <div class="teacher-asset-editor-section card teacher-asset-editor-section--teacher-note">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_teacher_note"))}</h2>
        <p class="teacher-asset-editor-section-hint">${esc(t("teacher.asset_editor.section_teacher_note_hint"))}</p>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.teacher_note"))}</span>
          <textarea class="teacher-asset-editor-textarea" name="teacher_note" rows="4"${ro}>${esc(getEffectiveTeacherNote(a))}</textarea>
        </label>
      </div>
      <div class="teacher-asset-editor-section card teacher-asset-editor-section--outline">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_outline"))}</h2>
        <p class="teacher-asset-editor-section-hint">${esc(t("teacher.asset_editor.section_outline_hint"))}</p>
        <p class="teacher-asset-editor-section-hint teacher-asset-editor-hint--cw">${esc(t("teacher.asset_editor.section_outline_classroom"))}</p>
        <p class="teacher-asset-editor-section-hint teacher-asset-editor-hint--cw">${esc(t("teacher.asset_editor.section_outline_notes_classroom"))}</p>
        <ol class="teacher-asset-editor-outline-list">${outline}</ol>
      </div>
      <div class="teacher-asset-editor-section card teacher-asset-editor-section--source">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_source"))}</h2>
        <dl class="teacher-asset-editor-dl">
          <div><dt>${esc(t("teacher.asset_editor.source_course"))}</dt><dd>${esc(formatTeacherHubCourseDisplay(String(src.course)))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.source_level"))}</dt><dd>${esc(String(src.level))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.source_lesson"))}</dt><dd>${esc(String(src.lesson))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.asset_type"))}</dt><dd>${esc(t(`teacher.assets.type.${a.asset_type}`))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.status"))}</dt><dd>${esc(t(`teacher.assets.state.${a.status}`))}</dd></div>
        </dl>
      </div>
      ${actionsBar("Bottom")}
    </form>
  `;
}

function collectOutlineFromDom(root) {
  const items = root.querySelectorAll("[data-outline-row]");
  const out = [];
  items.forEach((el, idx) => {
    const id = el.getAttribute("data-id") || `slide_${idx}`;
    const kind = el.getAttribute("data-kind") || "cover";
    const titleInp = el.querySelector('input[data-field="title"]');
    const enCb = el.querySelector('input[data-field="enabled"]');
    out.push({
      id,
      kind,
      title: titleInp && "value" in titleInp ? String(/** @type {HTMLInputElement} */ (titleInp).value) : "",
      enabled: enCb && "checked" in enCb ? /** @type {HTMLInputElement} */ (enCb).checked : true,
    });
  });
  return out;
}

/**
 * @param {import('../lumina-commerce/schema.js').Listing|null|undefined} listing
 * @param {(k: string, p?: object) => string} t
 */
function editorListingReviewPill(listing, t) {
  if (!listing) {
    return `<span class="teacher-state-pill teacher-state-pill--muted">${esc(t("teacher.asset_editor.review_pill_none"))}</span>`;
  }
  const st = listing.status;
  const mod =
    st === LISTING_STATUS.pending_review
      ? "pending"
      : st === LISTING_STATUS.approved
        ? "approved"
        : st === LISTING_STATUS.rejected
          ? "rejected"
          : "draft";
  const key =
    st === LISTING_STATUS.pending_review
      ? "status_pending"
      : st === LISTING_STATUS.approved
        ? "status_approved"
        : st === LISTING_STATUS.rejected
          ? "status_rejected"
          : "status_draft";
  return `<span class="teacher-state-pill teacher-state-pill--${mod}">${esc(t(`teacher.unified.${key}`))}</span>`;
}

/**
 * @param {import('../lumina-commerce/schema.js').Listing|null|undefined} listing
 * @param {(k: string, p?: object) => string} t
 */
function editorVisibilityPill(listing, t) {
  if (!listing) {
    return `<span class="teacher-state-pill teacher-state-pill--muted">${esc(t("teacher.asset_editor.visibility_pill_na"))}</span>`;
  }
  const isPub = listing.status === LISTING_STATUS.approved && listing.visibility === VISIBILITY.public;
  const key = isPub ? "vis_public" : "vis_private";
  return `<span class="teacher-state-pill teacher-state-pill--${isPub ? "vis_public" : "vis_private"}">${esc(
    t(`teacher.unified.${key}`),
  )}</span>`;
}

/**
 * @param {object} m
 * @param {import('../lumina-commerce/schema.js').Listing|undefined|null} listing
 * @param {(k: string, p?: object) => string} t
 */
function publishingStatusCardHtml(m, listing, t) {
  const subTitle = m.submitReason ? esc(String(m.submitReason)) : "";
  const subDisabled = m.canSubmit ? "" : " disabled";
  const previewLink = (cls) =>
    m.listingId
      ? `<a class="${cls}" href="#teacher-listing?id=${encodeURIComponent(m.listingId)}">${esc(t("teacher.asset_editor.publishing_preview_listing"))}</a>`
      : "";
  const consoleLink = `<a class="teacher-asset-editor-publish-link" href="#teacher-publishing">${esc(
    t("teacher.asset_editor.publishing_go_my_listings"),
  )}</a>`;

  let primaryBlock = "";
  let secondaryBlock = "";

  switch (m.scenario) {
    case 1:
      primaryBlock = m.canCreate
        ? `<button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetCreateListing">${esc(
            t("teacher.asset_editor.publishing_create_listing"),
          )}</button>`
        : "";
      secondaryBlock = consoleLink;
      break;
    case 2:
      primaryBlock =
        m.canSubmit && listing
          ? `<button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetSubmitListing"${subDisabled} title="${subTitle}">${esc(
              t("teacher.asset_editor.publishing_submit_review"),
            )}</button>`
          : "";
      secondaryBlock = [previewLink("teacher-asset-editor-publish-link"), consoleLink].filter(Boolean).join("");
      break;
    case 3:
      primaryBlock = m.listingId
        ? `<a class="teacher-hub-cta teacher-hub-cta--primary teacher-hub-cta--preview-listing" href="#teacher-listing?id=${encodeURIComponent(
            m.listingId,
          )}">${esc(t("teacher.asset_editor.publishing_preview_listing"))}</a>`
        : "";
      secondaryBlock = consoleLink;
      break;
    case 4:
      primaryBlock = m.canGoPublic
        ? `<button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetGoPublic">${esc(
            t("teacher.asset_editor.publishing_set_public"),
          )}</button>`
        : "";
      secondaryBlock = [previewLink("teacher-asset-editor-publish-link"), consoleLink].filter(Boolean).join("");
      break;
    case 5:
      primaryBlock = m.listingId
        ? `<a class="teacher-hub-cta teacher-hub-cta--accent" href="#teacher-listing?id=${encodeURIComponent(m.listingId)}">${esc(
            t("teacher.asset_editor.publishing_view_public"),
          )}</a>`
        : "";
      secondaryBlock = [
        m.canGoPrivate
          ? `<button type="button" class="teacher-hub-cta teacher-hub-cta--compact teacher-hub-cta--danger" id="teacherAssetMakePrivate">${esc(
              t("teacher.asset_editor.publishing_make_private"),
            )}</button>`
          : "",
        consoleLink,
      ]
        .filter(Boolean)
        .join("");
      break;
    default:
      secondaryBlock = consoleLink;
  }

  return `
    <section class="card teacher-asset-editor-section teacher-asset-editor-section--publishing" aria-labelledby="teacherAssetPubH2">
      <h2 class="teacher-asset-editor-h" id="teacherAssetPubH2">${esc(t("teacher.asset_editor.section_publishing"))}</h2>
      <p class="teacher-asset-editor-section-hint">${esc(t("teacher.asset_editor.publishing_lead"))}</p>
      <div class="teacher-asset-editor-publish-meta" role="group" aria-label="${esc(t("teacher.asset_editor.publish_meta_aria"))}">
        <div class="teacher-asset-editor-publish-meta-row">
          <span class="teacher-asset-editor-publish-k">${esc(t("teacher.asset_editor.publishing_row_review"))}</span>
          <span class="teacher-asset-editor-publish-pills">${editorListingReviewPill(listing, t)}</span>
        </div>
        <div class="teacher-asset-editor-publish-meta-row">
          <span class="teacher-asset-editor-publish-k">${esc(t("teacher.asset_editor.publish_meta_visibility"))}</span>
          <span class="teacher-asset-editor-publish-pills">${editorVisibilityPill(listing, t)}</span>
        </div>
      </div>
      <p class="teacher-asset-editor-visibility-hint" role="status">${esc(t(m.visibilityHintKey))}</p>
      <div class="teacher-asset-editor-publish-actions" role="group" aria-label="${esc(t("teacher.asset_editor.publishing_actions_aria"))}">
        ${primaryBlock}
        <div class="teacher-asset-editor-publish-secondary">${secondaryBlock}</div>
      </div>
    </section>`;
}

async function renderEditor(root) {
  const t = tx;
  const id = parseIdFromHash();
  if (!id) {
    root.innerHTML = `<div class="wrap teacher-asset-editor-page"><p class="card teacher-asset-editor-empty">${esc(
      t("teacher.asset_editor.missing_id"),
    )}</p></div>`;
    i18n.apply?.(root);
    return;
  }
  let ctx;
  try {
    ctx = await getTeacherPageContext();
  } catch {
    root.innerHTML = `<div class="wrap"><p>${esc(t("common.loading"))}</p></div>`;
    return;
  }
  if (!ctx.isLoggedIn) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.forbidden"))}</p></div>`;
    return;
  }
  if (!ctx.isTeacherRole || !ctx.isApproved || !ctx.profile) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.gated"))}</p></div>`;
    return;
  }
  const u = getCurrentUser();
  await initCommerceStore();
  const snapForNav = getCommerceStoreSync();
  const showReviewConsole =
    snapForNav && u?.id ? userCanAccessTeacherReviewConsole(snapForNav, String(u.id)) : false;
  const a = findAssetById(id);
  if (!a) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.not_found"))}</p></div>`;
    return;
  }
  const sameProfile = String(a.teacher_profile_id) === String(ctx.profile.id);
  const sameOwner = String(a.owner_user_id) === String(u.id);
  if (!sameProfile && !sameOwner) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.forbidden_edit"))}</p></div>`;
    return;
  }
  if (isTeacherAssetTrashed(a)) {
    root.innerHTML = `
    <div class="wrap teacher-asset-editor-page">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker">${esc(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("assets", t, { showReviewConsole })}
      <section class="card teacher-asset-editor-trashed-gate">
        <h2 class="teacher-asset-editor-trashed-title">${esc(t("teacher.asset_editor.trashed_gate_title"))}</h2>
        <p class="teacher-asset-editor-trashed-body">${esc(t("teacher.asset_editor.trashed_gate_body"))}</p>
        <p class="teacher-asset-editor-trashed-actions">
          <a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-assets?tab=trash">${esc(t("teacher.asset_editor.trashed_go_trash"))}</a>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${esc(t("teacher.asset_editor.back_assets"))}</a>
        </p>
      </section>
    </div>`;
    i18n.apply?.(root);
    return;
  }
  if (a.asset_type === ASSET_TYPE.uploaded_slide_draft) {
    const um = a.upload_meta;
    const fn = um?.file_name ? esc(um.file_name) : "—";
    const ft = um?.file_type ? esc(um.file_type) : "—";
    const fsz = um?.file_size_label ? esc(um.file_size_label) : "—";
    const upAt = um?.uploaded_at ? esc(um.uploaded_at) : "—";
    const impKey = a.import_status ? `teacher.asset_editor.import_status.${a.import_status}` : "teacher.asset_editor.import_status.raw_uploaded";
    let impLabel = t(impKey);
    if (impLabel === impKey) impLabel = esc(String(a.import_status || "raw_uploaded"));
    else impLabel = esc(impLabel);
    root.innerHTML = `
    <div class="wrap teacher-asset-editor-page">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker">${esc(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("assets", t, { showReviewConsole })}
      <header class="card teacher-surface-hero teacher-asset-editor-hero">
        <h1 class="teacher-asset-editor-title">${esc(t("teacher.asset_editor.import_readonly_title"))}</h1>
        <p class="teacher-asset-editor-lead">${esc(t("teacher.asset_editor.import_readonly_lead"))}</p>
        <div class="teacher-surface-action-row" role="navigation" aria-label="${esc(t("teacher.surface.nav_aria"))}">
          <a class="teacher-surface-link teacher-surface-link--secondary" href="#teacher-assets">${esc(t("teacher.asset_editor.back_assets"))}</a>
        </div>
      </header>
      <section class="card teacher-asset-editor-section teacher-asset-editor-import-card" aria-labelledby="teacherAssetImportH2">
        <h2 class="teacher-asset-editor-h" id="teacherAssetImportH2">${esc(a.title)}</h2>
        <span class="teacher-asset-type-pill teacher-asset-type-pill--uploaded">${esc(t("teacher.assets.type.uploaded_slide_draft"))}</span>
        <dl class="teacher-asset-editor-dl teacher-asset-editor-import-dl">
          <div><dt>${esc(t("teacher.assets.col_file_name"))}</dt><dd>${fn}</dd></div>
          <div><dt>${esc(t("teacher.assets.col_file_type"))}</dt><dd>${ft}</dd></div>
          <div><dt>${esc(t("teacher.assets.col_upload_time"))}</dt><dd>${upAt}</dd></div>
          <div><dt>${esc(t("teacher.assets.col_file_size"))}</dt><dd>${fsz}</dd></div>
          <div><dt>${esc(t("teacher.assets.import_status_label"))}</dt><dd>${impLabel}</dd></div>
          <div><dt>${esc(t("teacher.assets.import_provenance_dt"))}</dt><dd>${esc(t("teacher.assets.source_local_import"))}</dd></div>
        </dl>
        <p class="teacher-asset-editor-import-disclaimer" role="status">${esc(t("teacher.asset_editor.import_no_parse_yet"))}</p>
        <p class="teacher-asset-editor-import-future">${esc(t("teacher.asset_editor.import_future_note"))}</p>
      </section>
    </div>`;
    i18n.apply?.(root);
    return;
  }
  if (a.asset_type !== ASSET_TYPE.lesson_slide_draft) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.not_lesson_draft"))}</p></div>`;
    return;
  }
  const isArchived = a.status === ASSET_STATUS.archived;
  const canEdit = !isArchived;
  const canMoveToTrash = canEdit && !isArchived;

  const snap = getCommerceStoreSync();
  const listingRow = snap ? findListingByAssetId(snap, a.id) : null;
  const pubM = getAssetEditorPublishingModel(ctx.profile.id, u.id, listingRow, a, t);
  const publishBlock = publishingStatusCardHtml(pubM, listingRow, t);

  root.innerHTML = `
    <div class="wrap teacher-asset-editor-page">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker">${esc(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("assets", t, { showReviewConsole })}
      <header class="card teacher-surface-hero teacher-asset-editor-hero">
        <h1 class="teacher-asset-editor-title">${esc(t("teacher.asset_editor.page_title"))}</h1>
        <p class="teacher-asset-editor-lead">${esc(t("teacher.asset_editor.lead"))}</p>
        <div class="teacher-surface-action-row" role="navigation" aria-label="${esc(t("teacher.surface.nav_aria"))}">
          <a class="teacher-surface-link teacher-surface-link--secondary" href="#teacher-assets">${esc(t("teacher.asset_editor.back_assets"))}</a>
          <a class="teacher-surface-link" href="#classroom?assetId=${encodeURIComponent(a.id)}">${esc(t("teacher.asset_editor.to_classroom"))}</a>
          <a class="teacher-surface-link" href="#teacher-publishing">${esc(t("teacher.nav.my_publishing"))}</a>
          <a class="teacher-surface-link" href="#teacher-publishing">${esc(t("teacher.workflow.view_review_status"))}</a>
          ${
            showReviewConsole
              ? `<a class="teacher-surface-link" href="#teacher-review">${esc(t("teacher.nav.review_console"))}</a>`
              : ""
          }
          ${
            listingRow
              ? `<a class="teacher-surface-link" href="#teacher-listing?id=${encodeURIComponent(listingRow.id)}">${esc(
                  t("teacher.asset_editor.publishing_preview_listing"),
                )}</a>`
              : ""
          }
        </div>
      </header>
      ${publishBlock}
      ${editorFormHtml(a, t, u.id, ctx.profile.id, canEdit, isArchived, canMoveToTrash)}
    </div>
  `;
  i18n.apply?.(root);

  const form = root.querySelector("#teacherAssetEditorForm");
  const toastEl = root.querySelector("#teacherAssetEditorToast");
  const showSaveToast = () => {
    if (!toastEl) return;
    toastEl.textContent = `${t("teacher.asset_editor.save_success")} · ${t("teacher.asset_editor.structure_saved")}`;
    toastEl.removeAttribute("hidden");
    window.clearTimeout(/** @type {any} */ (showSaveToast)._tid);
    /** @type {any} */ (showSaveToast)._tid = window.setTimeout(() => {
      toastEl.setAttribute("hidden", "");
    }, 4200);
  };
  const syncOutlineEnabledLabels = () => {
    root.querySelectorAll('.teacher-asset-editor-en-input[data-field="enabled"]').forEach((inp) => {
      const on = /** @type {HTMLInputElement} */ (inp).checked;
      const host = inp.closest(".teacher-asset-editor-en-toggle");
      const state = host?.querySelector(".teacher-asset-editor-en-state");
      if (state) state.textContent = on ? t("teacher.asset_editor.outline_state_on") : t("teacher.asset_editor.outline_state_off");
    });
  };
  root.querySelectorAll('.teacher-asset-editor-en-input[data-field="enabled"]').forEach((inp) => {
    inp.addEventListener("change", () => syncOutlineEnabledLabels());
  });
  const runSave = () => {
    if (!form || isArchived) return;
    const fd = new FormData(/** @type {HTMLFormElement} */ (form));
    const outline = collectOutlineFromDom(root);
    const next = updateTeacherAsset({
      id: a.id,
      title: String(fd.get("title") || a.title).trim() || a.title,
      subtitle: String(fd.get("subtitle") || ""),
      summary: String(fd.get("summary") || ""),
      teacher_note: String(fd.get("teacher_note") || ""),
      cover_note: String(fd.get("cover_note") || ""),
      slide_outline: outline,
    });
    if (next) {
      showSaveToast();
      syncClassroomAssetListingFromAsset(a.id);
    }
  };
  const refresh = () => {
    if (root.isConnected) void renderEditor(root);
  };
  root.querySelector("#teacherAssetCreateListing")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const r = await ensureListingForTeacherAsset(a.id);
    if (!r.ok) {
      try {
        alert(t(`teacher.publishing.error.${r.code}`) || r.code);
      } catch {
        /* */
      }
      return;
    }
    refresh();
  });
  root.querySelector("#teacherAssetSubmitListing")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!pubM.canSubmit) return;
    const r = await submitTeacherAssetListingForReview(a.id, u.id);
    if (!r.ok) {
      try {
        alert(t(`teacher.publishing.error.${r.code}`) || r.code);
      } catch {
        /* */
      }
      return;
    }
    refresh();
  });
  root.querySelector("#teacherAssetGoPublic")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!pubM.canGoPublic) return;
    const r = await setClassroomAssetListingToPublic(a.id, ctx.profile.id);
    if (!r.ok) {
      try {
        alert(t(`teacher.publishing.error.${r.code}`) || r.code);
      } catch {
        /* */
      }
      return;
    }
    refresh();
  });
  root.querySelector("#teacherAssetMakePrivate")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!pubM.canGoPrivate) return;
    const r = await setClassroomAssetListingToPrivate(a.id, ctx.profile.id);
    if (!r.ok) {
      try {
        alert(t(`teacher.publishing.error.${r.code}`) || r.code);
      } catch {
        /* */
      }
      return;
    }
    refresh();
  });
  root.querySelectorAll("[id^=teacherAssetEditorSave]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      runSave();
    });
  });

  root.querySelector("#teacherAssetMoveToDraftTrash")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (!confirm(trashDraftConfirmMessage(t))) return;
    const r = moveTeacherAssetToTrash(a.id, u.id);
    if (!r.ok) {
      const ek = `teacher.assets.trash_error.${r.code}`;
      let msg = t(ek);
      if (msg === ek) msg = String(r.code);
      try {
        alert(msg);
      } catch {
        /* */
      }
      return;
    }
    location.hash = "#teacher-assets";
  });
}

let __h = null;
let __e = null;
let __r = null;

export default function pageTeacherAssetEditor(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;
  __r = root;
  if (__h) window.removeEventListener("hashchange", __h);
  __h = () => {
    if (__r?.isConnected) void renderEditor(__r);
  };
  window.addEventListener("hashchange", __h);
  if (__e) window.removeEventListener("joy:langChanged", __e);
  __e = () => {
    if (__r?.isConnected) void renderEditor(__r);
  };
  window.addEventListener("joy:langChanged", __e);
  void renderEditor(root);
}
export function mount(c) {
  return pageTeacherAssetEditor(c);
}
export function render(c) {
  return pageTeacherAssetEditor(c);
}
