// 课堂资产面板：嵌入「我的课程」#teacher-courses?tab=assets；含上传、列表、回收站与上架逻辑。

import { safeUiText, formatTeacherHubCourseDisplay } from "../../lumina-commerce/commerceDisplayLabels.js";
import { updateTeacherAsset, ensureE2EClassroomFixtureAsset } from "../../lumina-commerce/teacherAssetsStore.js";
import {
  listAssetsByProfileId,
  listTrashedAssetsByProfileId,
  moveTeacherAssetToTrash,
  restoreTeacherAssetFromTrash,
  permanentlyDeleteAllTrashedForTeacherProfile,
  teacherAssetTrashDaysRemaining,
  TEACHER_ASSET_TRASH_RETENTION_DAYS,
  ASSET_STATUS,
  ASSET_TYPE,
  createClassroomAssetForLesson,
  getEffectiveTeacherNote,
} from "../../lumina-commerce/teacherAssetsSelectors.js";
import { initCommerceStore, getCommerceStoreSync } from "../../lumina-commerce/store.js";
import {
  findListingByAssetId,
  submitTeacherAssetListingForReview,
  setClassroomAssetListingToPublic,
  setClassroomAssetListingToPrivate,
  getTeacherAssetPublishUiState,
} from "../../lumina-commerce/teacherListingBridge.js";
import { LISTING_STATUS, PRICING_TYPE, VISIBILITY } from "../../lumina-commerce/enums.js";
import {
  countGrantsForListing,
  getListingPayableAmount,
  getListingPricingType,
  updateListingPricingForTeacher,
} from "../../lumina-commerce/teacherCommerceBridge.js";
import { i18n } from "../../i18n.js";
import { formatDemoShortUpdated } from "../../lumina-commerce/teacherDemoCatalog.js";
import {
  TEACHER_ASSET_IMPORT_ACCEPT,
  createImportedSlideDraftFromFile,
  validateTeacherImportFile,
} from "../../lumina-commerce/teacherAssetImportService.js";

/** 我的课程页「课程」Tab 规范 URL */
export const TEACHER_COURSES_TAB_COURSES_HREF = "#teacher-courses?tab=courses";

/**
 * @param {'active' | 'trash'} listView
 */
export function teacherCoursesAssetsHref(listView) {
  const p = new URLSearchParams();
  p.set("tab", "assets");
  if (listView === "trash") p.set("assetsView", "trash");
  return `#teacher-courses?${p.toString()}`;
}

/** 读取 #teacher-courses?tab=assets 下 active / 回收站子状态 */
export function assetsListViewFromHash() {
  const h = String(location.hash || "");
  const q = h.indexOf("?");
  const params = q >= 0 ? new URLSearchParams(h.slice(q + 1)) : new URLSearchParams();
  if (String(params.get("tab") || "").toLowerCase() === "assets") {
    return String(params.get("assetsView") || "").toLowerCase() === "trash" ? "trash" : "active";
  }
  return "active";
}

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

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} a
 * @param {(k: string, p?: object) => string} t
 */
function assetSourceDisplayLine(a, t) {
  const sk = a.source && /** @type {{ kind?: string }} */ (a.source).kind;
  if (sk === "local_upload") return t("teacher.assets.source_local_import");
  const src = a.source;
  return t("teacher.assets.source_line", {
    course: formatTeacherHubCourseDisplay(src.course),
    level: String(src.level),
    lesson: String(src.lesson),
  });
}

/**
 * @param {import('../lumina-commerce/schema.js').Listing|null|undefined} listing
 * @param {(k: string, p?: object) => string} t
 */
function assetsRowReviewPill(listing, t) {
  if (!listing) {
    return `<span class="teacher-state-pill teacher-state-pill--muted">${escapeHtml(t("teacher.assets.pub_badge_no_listing"))}</span>`;
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
  return `<span class="teacher-state-pill teacher-state-pill--${mod}">${escapeHtml(t(`teacher.unified.${key}`))}</span>`;
}

/**
 * @param {import('../lumina-commerce/schema.js').Listing|null|undefined} listing
 * @param {(k: string, p?: object) => string} t
 */
function assetsRowVisibilityPill(listing, t) {
  if (!listing) {
    return `<span class="teacher-state-pill teacher-state-pill--muted">${escapeHtml(t("teacher.assets.pub_visibility_na"))}</span>`;
  }
  const isPub = listing.status === LISTING_STATUS.approved && listing.visibility === VISIBILITY.public;
  const key = isPub ? "vis_public" : "vis_private";
  return `<span class="teacher-state-pill teacher-state-pill--${isPub ? "vis_public" : "vis_private"}">${escapeHtml(
    t(`teacher.unified.${key}`),
  )}</span>`;
}

/**
 * @param {(k: string, p?: object) => string} t
 */
function trashConfirmMessage(t) {
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
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} a
 * @param {(k: string, p?: object) => string} t
 * @param {string} profileId
 * @param {string} userId
 * @param {import('../lumina-commerce/store.js').CommerceStoreSnapshot|null} snap
 */
function assetRow(a, t, profileId, userId, listing, snap) {
  const isUploaded = a.asset_type === ASSET_TYPE.uploaded_slide_draft;
  const um = a.upload_meta;
  const srcLine = assetSourceDisplayLine(a, t);
  const fileSub =
    isUploaded && um && um.file_name
      ? `<div class="teacher-asset-subline teacher-asset-subline--import-file">${escapeHtml(t("teacher.assets.col_file_name"))}: ${escapeHtml(
          um.file_name,
        )}</div>`
      : "";
  const stClass = `teacher-asset-status-chip--${String(a.status).replace(/[^a-z0-9_]/g, "_")}`;
  const pub = getTeacherAssetPublishUiState(profileId, userId, listing || null, a, t);
  const hasPubListing = Boolean(listing && listing.id);
  const listingId = listing?.id || "";
  const canSubmit = pub.canSubmit;
  const submitTitle = pub.submitReason ? escapeHtml(pub.submitReason) : "";
  const rejectHint =
    listing && listing.status === LISTING_STATUS.rejected && (listing.review_reason_text || listing.review_reason_code)
      ? `<p class="teacher-asset-reject-hint" role="status">${escapeHtml(
          t("teacher.publishing.rejection_prefix"),
        )} ${escapeHtml((listing.review_reason_text || listing.review_reason_code || "").trim() || t("common.no_data"))}</p>`
      : "";
  const canSetPublic =
    Boolean(listing) &&
    listing.status === LISTING_STATUS.approved &&
    listing.visibility !== VISIBILITY.public;
  const isVisPublic =
    Boolean(listing) && listing.status === LISTING_STATUS.approved && listing.visibility === VISIBILITY.public;
  const canSetPrivate = isVisPublic;
  const previewListingUrl = hasPubListing && listingId ? `#teacher-listing?id=${encodeURIComponent(listingId)}` : "";
  const isDraftOrRejected =
    Boolean(listing) &&
    (listing.status === LISTING_STATUS.draft || listing.status === LISTING_STATUS.rejected);
  const isPending = Boolean(listing) && listing.status === LISTING_STATUS.pending_review;
  const pubQuick = (() => {
    if (!hasPubListing) {
      return `<a class="teacher-asset-link" href="#teacher-asset-editor?id=${encodeURIComponent(a.id)}">${escapeHtml(
        t("teacher.assets.pub_quick_editor_listing"),
      )}</a>`;
    }
    if (isPending) {
      return `<span class="teacher-asset-muted">${escapeHtml(t("teacher.assets.pub_quick_pending_only"))}</span>`;
    }
    if (isDraftOrRejected && canSubmit) {
      return `<a class="teacher-asset-link" href="#teacher-asset-editor?id=${encodeURIComponent(a.id)}">${escapeHtml(
        t("teacher.assets.pub_quick_submit_review"),
      )}</a>`;
    }
    if (isDraftOrRejected && !canSubmit) {
      return `<a class="teacher-asset-link" href="#teacher-asset-editor?id=${encodeURIComponent(a.id)}">${escapeHtml(
        t("teacher.assets.pub_quick_open_editor"),
      )}</a>`;
    }
    if (canSetPublic) {
      return `<button type="button" class="teacher-asset-ghost teacher-asset-pub-vis-btn" data-teacher-asset-gopublic="${escapeHtml(
        a.id,
      )}">${escapeHtml(t("teacher.assets.pub_action_set_public"))}</button>`;
    }
    if (canSetPrivate) {
      return `<button type="button" class="teacher-asset-ghost teacher-asset-pub-vis-btn teacher-asset-pub-vis-btn--private" data-teacher-asset-goprivate="${escapeHtml(
        a.id,
      )}">${escapeHtml(t("teacher.assets.pub_action_make_private"))}</button>
      ${
        previewListingUrl
          ? `<a class="teacher-asset-link" href="${escapeHtml(previewListingUrl)}">${escapeHtml(
              t("teacher.assets.preview_listing_page"),
            )}</a>`
          : ""
      }`;
    }
    return "";
  })();
  const archDisabled = a.status === ASSET_STATUS.archived;
  const canMoveToTrash =
    !archDisabled && (a.asset_type === ASSET_TYPE.lesson_slide_draft || a.asset_type === ASSET_TYPE.uploaded_slide_draft);
  const hasNote = Boolean(getEffectiveTeacherNote(a));
  const noteShort = hasNote ? t("teacher.assets.has_teacher_note_badge") : t("teacher.assets.has_teacher_note_no");
  const noteCellInner =
    isUploaded && um
      ? `${escapeHtml(t("teacher.assets.col_file_type"))}: ${escapeHtml(um.file_type)} · ${escapeHtml(um.file_size_label)}`
      : escapeHtml(noteShort);
  const noteCellClass = isUploaded && um ? "teacher-asset-note-chip has-note teacher-asset-note-chip--import" : `teacher-asset-note-chip ${hasNote ? "has-note" : ""}`;
  const editDeck = isUploaded
    ? `<a class="teacher-asset-btn teacher-asset-btn--primary" href="#teacher-asset-editor?id=${encodeURIComponent(a.id)}">${escapeHtml(
        t("teacher.assets.open_import_draft"),
      )}</a>`
    : a.asset_type === ASSET_TYPE.lesson_slide_draft
      ? `<a class="teacher-asset-btn teacher-asset-btn--primary" href="#teacher-asset-editor?id=${encodeURIComponent(a.id)}">${escapeHtml(
          t("teacher.assets.edit_deck"),
        )}</a>`
      : `<span class="teacher-asset-muted" title="${escapeHtml(t("teacher.assets.edit_placeholder"))}">${escapeHtml(
          t("teacher.assets.edit"),
        )}</span>`;
  const enterRoom = isUploaded
    ? `<span class="teacher-asset-muted teacher-asset-enter-blocked" title="${escapeHtml(t("teacher.assets.enter_classroom_blocked_upload_title"))}">${escapeHtml(
        t("teacher.assets.enter_classroom_blocked_upload"),
      )}</span>`
    : `<a class="teacher-asset-btn teacher-asset-btn--accent" href="#classroom?assetId=${encodeURIComponent(
        a.id,
      )}">${escapeHtml(t("teacher.assets.enter_classroom_teach"))}</a>`;
  const updatedCell = isUploaded && um && um.uploaded_at ? formatDemoShortUpdated(um.uploaded_at) : formatDemoShortUpdated(a.updated_at);
  const commerceCell = (() => {
    if (!listing || !snap) {
      return `<td class="teacher-manage-cell-commerce"><span class="teacher-commerce-na">${escapeHtml(
        t("teacher.assets.commerce_no_listing_short"),
      )}</span> <a class="teacher-asset-link" href="#teacher-publishing">${escapeHtml(
        t("teacher.assets.commerce_go_listing"),
      )}</a></td>`;
    }
    const pt = getListingPricingType(listing);
    const payAmt = getListingPayableAmount(listing);
    const priceShort =
      pt === PRICING_TYPE.free
        ? t("learner.commerce.pricing_free")
        : payAmt > 0
          ? `${String(listing.price_currency || "KRW")} ${payAmt.toLocaleString()}`
          : t("teacher.assets.commerce_price_unset");
    const isPub = listing.status === LISTING_STATUS.approved && listing.visibility === VISIBILITY.public;
    const visLabel = isPub ? t("teacher.unified.vis_public") : t("teacher.unified.vis_private");
    const nGrants = countGrantsForListing(snap, listing.id);
    const priceVal = payAmt > 0 ? String(payAmt) : String(listing.price_amount || listing.sale_price_amount || 0);
    return `<td class="teacher-manage-cell-commerce" data-commerce-listing="${escapeHtml(listing.id)}">
      <div class="teacher-asset-commerce-summary">
        <span class="teacher-commerce-chip teacher-commerce-chip--price">${escapeHtml(priceShort)}</span>
        <span class="teacher-commerce-chip ${isPub ? "is-pub" : ""}">${escapeHtml(visLabel)}</span>
        <span class="teacher-commerce-chip">${escapeHtml(
          t("teacher.assets.commerce_grants", { n: String(nGrants) }),
        )}</span>
      </div>
      <div class="teacher-commerce-mini" data-commerce-edit="${escapeHtml(listing.id)}">
        <label class="teacher-commerce-label"><span class="visually-hidden">${escapeHtml(
          t("teacher.assets.commerce_pricing_type"),
        )}</span>
          <select class="teacher-commerce-pt" data-commerce-pt="${escapeHtml(listing.id)}" aria-label="${escapeHtml(
            t("teacher.assets.commerce_pricing_type"),
          )}">
            <option value="free" ${pt === PRICING_TYPE.free ? "selected" : ""}>${escapeHtml(
              t("learner.commerce.pricing_free"),
            )}</option>
            <option value="paid" ${pt === PRICING_TYPE.paid ? "selected" : ""}>${escapeHtml(
              t("learner.commerce.pricing_paid"),
            )}</option>
          </select>
        </label>
        <input type="number" class="teacher-commerce-amt" data-commerce-amt="${escapeHtml(
          listing.id,
        )}" min="0" step="1" value="${escapeHtml(priceVal)}" ${
      pt === PRICING_TYPE.paid ? "" : 'style="display:none" aria-hidden="true"'
    }" aria-label="${escapeHtml(t("learner.commerce.price"))}" title="${escapeHtml(
      t("teacher.assets.commerce_paid_amount_hint"),
    )}" />
        <button type="button" class="teacher-commerce-save" data-commerce-save="${escapeHtml(
          listing.id,
        )}">${escapeHtml(t("teacher.assets.commerce_save_pricing"))}</button>
      </div>
    </td>`;
  })();
  const stitle = !isUploaded && a.subtitle && String(a.subtitle).trim() ? String(a.subtitle).trim() : "";
  const typePillMod = isUploaded ? " teacher-asset-type-pill--uploaded" : "";
  const impKey =
    isUploaded && a.import_status ? `teacher.asset_editor.import_status.${a.import_status}` : "";
  let impShort = "";
  if (impKey) {
    impShort = t(impKey);
    if (impShort === impKey) impShort = String(a.import_status || "");
  }
  const statusCellHtml =
    isUploaded && impShort
      ? `<span class="teacher-asset-status-chip ${escapeHtml(stClass)}">${escapeHtml(assetStatusLabel(t, a.status))}</span>
        <div class="teacher-asset-import-status-sub">${escapeHtml(t("teacher.assets.import_status_label"))}: ${escapeHtml(impShort)}</div>`
      : `<span class="teacher-asset-status-chip ${escapeHtml(stClass)}">${escapeHtml(assetStatusLabel(t, a.status))}</span>`;
  return `<tr data-teacher-asset-id="${escapeHtml(a.id)}">
    <td class="teacher-manage-cell-title">
      <div class="teacher-asset-title-line">${escapeHtml(a.title)}</div>
      ${stitle ? `<div class="teacher-asset-subline">${escapeHtml(stitle)}</div>` : ""}
      ${fileSub}
    </td>
    <td class="teacher-manage-cell-meta"><span class="teacher-asset-type-pill${typePillMod}">${escapeHtml(
      t(`teacher.assets.type.${a.asset_type}`),
    )}</span></td>
    <td>${escapeHtml(srcLine)}</td>
    <td class="teacher-manage-cell-status">${statusCellHtml}</td>
    <td class="teacher-manage-cell-note"><span class="${noteCellClass}">${noteCellInner}</span></td>
    <td class="teacher-manage-cell-publish">
      <div class="teacher-asset-pub-pills" role="group" aria-label="${escapeHtml(t("teacher.assets.pub_pills_aria"))}">
        ${assetsRowReviewPill(listing || null, t)}
        ${assetsRowVisibilityPill(listing || null, t)}
      </div>
      <p class="teacher-asset-pub-aux">
        <a class="teacher-asset-link" href="#teacher-publishing" title="${escapeHtml(t("teacher.assets.view_publish_state"))}">${escapeHtml(
          t("teacher.assets.view_publish_state"),
        )}</a>
        ${
          hasPubListing && listingId && !isVisPublic
            ? ` <a class="teacher-asset-link teacher-asset-link--preview" href="#teacher-listing?id=${encodeURIComponent(
                listingId,
              )}">${escapeHtml(t("teacher.assets.preview_listing_page"))}</a>`
            : ""
        }
      </p>
      ${pubQuick ? `<div class="teacher-asset-pub-quick">${pubQuick}</div>` : ""}
      ${rejectHint}
    </td>
    <td>${escapeHtml(updatedCell)}</td>
    ${commerceCell}
    <td class="teacher-manage-col-actions teacher-asset-actions">
      <div class="teacher-asset-row-primary" role="group" aria-label="${escapeHtml(t("teacher.assets.row_primary_actions_aria"))}">
        ${editDeck}
        ${enterRoom}
      </div>
      <div class="teacher-asset-row-secondary" role="group" aria-label="${escapeHtml(t("teacher.assets.row_secondary_actions_aria"))}">
      <button type="button" class="teacher-asset-ghost" data-teacher-asset-submit="${escapeHtml(
        a.id,
      )}" ${canSubmit ? "" : "disabled"} title="${submitTitle}">${escapeHtml(t("teacher.publishing.submit_review"))}</button>
      <span class="teacher-asset-sep" aria-hidden="true">|</span>
      <a class="teacher-asset-link" href="#teacher-publishing" title="${escapeHtml(
        t("teacher.publishing.view_review_console"),
      )}">${escapeHtml(t("teacher.publishing.view_status"))}</a>
      <span class="teacher-asset-sep" aria-hidden="true">|</span>
      <button type="button" class="teacher-asset-ghost" data-teacher-asset-archive="${escapeHtml(a.id)}" ${
    archDisabled ? "disabled" : ""
  }>${escapeHtml(t("teacher.assets.archive"))}</button>
      ${
        canMoveToTrash
          ? `<span class="teacher-asset-sep" aria-hidden="true">|</span><button type="button" class="teacher-asset-ghost teacher-asset-move-trash" data-teacher-asset-trash="${escapeHtml(
              a.id,
            )}" title="${escapeHtml(t("teacher.assets.delete_to_trash_title"))}">${escapeHtml(t("teacher.assets.delete_to_trash"))}</button>`
          : ""
      }
      </div>
    </td>
  </tr>`;
}

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} a
 * @param {(k: string, p?: object) => string} t
 */
function trashAssetRow(a, t) {
  const srcLine = assetSourceDisplayLine(a, t);
  const delAt = formatDemoShortUpdated(a.deleted_at || "");
  const daysLeft = teacherAssetTrashDaysRemaining(a) ?? 0;
  const pillClass =
    daysLeft <= 3 ? "teacher-trash-days-pill teacher-trash-days-pill--urgent" : "teacher-trash-days-pill";
  return `<tr data-teacher-asset-trash-id="${escapeHtml(a.id)}">
    <td class="teacher-manage-cell-title">
      <div class="teacher-asset-title-line">${escapeHtml(a.title)}</div>
      <p class="teacher-trash-meta-line"><span class="teacher-trash-badge">${escapeHtml(t("teacher.assets.trash_state_deleted"))}</span> ${escapeHtml(
        t("teacher.assets.trash_purge_in_days", { days: String(TEACHER_ASSET_TRASH_RETENTION_DAYS) }),
      )}</p>
    </td>
    <td class="teacher-manage-cell-meta"><span class="teacher-asset-type-pill">${escapeHtml(t(`teacher.assets.type.${a.asset_type}`))}</span></td>
    <td>${escapeHtml(srcLine)}</td>
    <td>${escapeHtml(delAt)}</td>
    <td><span class="${escapeHtml(pillClass)}">${escapeHtml(t("teacher.assets.trash_days_remaining", { n: String(daysLeft) }))}</span></td>
    <td class="teacher-manage-col-actions">
      <button type="button" class="teacher-hub-cta teacher-hub-cta--secondary teacher-trash-restore" data-teacher-asset-restore="${escapeHtml(
        a.id,
      )}">${escapeHtml(t("teacher.assets.restore"))}</button>
    </td>
  </tr>`;
}

/**
 * 已处于已审核老师上下文时，将课堂资产 UI 挂到 container（不含 teacher-shell）。
 * @param {HTMLElement} container
 * @param {{ profileId: string, userId: string, displayName: string, onRefresh: () => void }} opts
 */
export async function mountTeacherAssetsPanel(container, opts) {
  const t = tx;
  const { profileId, userId, displayName, onRefresh } = opts;

  await initCommerceStore();
  ensureE2EClassroomFixtureAsset();
  const snap = getCommerceStoreSync();
  const listView = assetsListViewFromHash();
  const trashCount = listTrashedAssetsByProfileId(profileId).length;

  const assets = listView === "active" ? listAssetsByProfileId(profileId) : [];
  const trashed = listView === "trash" ? listTrashedAssetsByProfileId(profileId) : [];
  const hasRows = listView === "active" ? assets.length > 0 : trashed.length > 0;
  const rows =
    listView === "active" && hasRows
      ? assets
          .map((a) => {
            const listing = snap ? findListingByAssetId(snap, a.id) : null;
            return assetRow(a, t, profileId, userId, listing, snap);
          })
          .join("")
      : listView === "trash" && hasRows
        ? trashed.map((a) => trashAssetRow(a, t)).join("")
        : "";
  const emptyBlock =
    listView === "active" && !hasRows
      ? `<div class="teacher-assets-empty card">
         <h3 class="teacher-assets-empty-title">${escapeHtml(t("teacher.assets.empty_title_v2"))}</h3>
         <p class="teacher-assets-empty-body">${escapeHtml(t("teacher.assets.empty_body_v3"))}</p>
         <p class="teacher-assets-empty-cta">
           <button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetsEmptyQuickCreate">
             ${escapeHtml(t("teacher.assets.empty_cta_new_deck"))}
           </button>
           <a class="teacher-hub-cta teacher-hub-cta--secondary" href="${TEACHER_COURSES_TAB_COURSES_HREF}">${escapeHtml(
             t("teacher.assets.empty_cta_from_course"),
           )}</a>
           <button type="button" class="teacher-hub-cta teacher-hub-cta--secondary js-teacher-assets-import-trigger">${escapeHtml(
             t("teacher.assets.upload_own_draft"),
           )}</button>
           <button type="button" class="teacher-hub-cta teacher-hub-cta--secondary js-teacher-assets-import-trigger">${escapeHtml(
             t("teacher.assets.import_local_courseware"),
           )}</button>
         </p>
         <p class="teacher-assets-empty-import-hint">${escapeHtml(t("teacher.assets.upload_own_draft_sub"))}</p>
       </div>`
      : listView === "trash" && !hasRows
        ? `<div class="teacher-assets-empty card teacher-trash-empty">
         <h3 class="teacher-assets-empty-title">${escapeHtml(t("teacher.assets.trash_empty_title"))}</h3>
         <p class="teacher-assets-empty-body">${escapeHtml(t("teacher.assets.trash_empty_body"))}</p>
       </div>`
        : "";
  const listToolbarHtml =
    listView === "active"
      ? `<div class="teacher-assets-list-toolbar">
          <div class="teacher-assets-list-toolbar-text">
            <h2 class="teacher-assets-list-toolbar-title">${escapeHtml(t("teacher.assets.list_toolbar_heading"))}</h2>
          </div>
          <div class="teacher-assets-list-toolbar-actions teacher-assets-list-toolbar-actions--with-import">
            <div class="teacher-assets-import-slot" id="teacher-assets-import">
              <button type="button" class="teacher-hub-cta teacher-hub-cta--compact teacher-hub-cta--secondary js-teacher-assets-import-trigger">${escapeHtml(
                t("teacher.assets.upload_own_draft"),
              )}</button>
              <button type="button" class="teacher-hub-cta teacher-hub-cta--compact teacher-hub-cta--secondary js-teacher-assets-import-trigger">${escapeHtml(
                t("teacher.assets.import_local_courseware"),
              )}</button>
              <input type="file" id="teacherAssetsImportInput" class="visually-hidden" accept="${escapeHtml(TEACHER_ASSET_IMPORT_ACCEPT)}" />
            </div>
            <a class="teacher-hub-cta teacher-hub-cta--compact teacher-hub-cta--secondary" href="${teacherCoursesAssetsHref(
              "trash",
            )}">${escapeHtml(
              t("teacher.assets.view_trash"),
            )}${trashCount > 0 ? ` (${escapeHtml(String(trashCount))})` : ""}</a>
          </div>
        </div>`
      : listView === "trash"
        ? `<div class="teacher-assets-list-toolbar teacher-assets-list-toolbar--trash">
          <div class="teacher-assets-list-toolbar-text">
            <h2 class="teacher-assets-list-toolbar-title">${escapeHtml(t("teacher.assets.tab_trash"))}</h2>
            <p class="teacher-assets-list-toolbar-desc">${escapeHtml(t("teacher.assets.trash_empty_body"))}</p>
          </div>
          <div class="teacher-assets-list-toolbar-actions">
            <a class="teacher-hub-cta teacher-hub-cta--compact teacher-hub-cta--secondary" href="${teacherCoursesAssetsHref(
              "active",
            )}">${escapeHtml(
              t("teacher.assets.back_to_active_decks"),
            )}</a>
            ${
              hasRows
                ? `<button type="button" class="teacher-hub-cta teacher-hub-cta--compact teacher-hub-cta--danger" id="teacherAssetsEmptyTrash">${escapeHtml(
                    t("teacher.assets.empty_trash"),
                  )}</button>`
                : ""
            }
          </div>
        </div>`
        : "";
  const tableBlock =
    listView === "active" && hasRows
      ? `<div class="teacher-manage-table-scroll">
        <table class="teacher-manage-table">
          <thead>
            <tr>
              <th scope="col">${escapeHtml(t("teacher.assets.col_title"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_type"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_source"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_status"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_note"))}</th>
              <th scope="col">${escapeHtml(t("teacher.publishing.col_publish"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_updated"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_commerce"))}</th>
              <th scope="col" class="teacher-manage-col-actions">${escapeHtml(t("teacher.assets.col_actions"))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
      : listView === "trash" && hasRows
        ? `<div class="teacher-manage-table-scroll teacher-trash-table-wrap">
        <table class="teacher-manage-table teacher-trash-table">
          <thead>
            <tr>
              <th scope="col">${escapeHtml(t("teacher.assets.col_title"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_type"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.col_source"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.trash_col_deleted_at"))}</th>
              <th scope="col">${escapeHtml(t("teacher.assets.trash_col_remaining"))}</th>
              <th scope="col" class="teacher-manage-col-actions">${escapeHtml(t("teacher.assets.col_actions"))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
        : "";

  const main = `
      <header class="card teacher-surface-hero teacher-admin-header teacher-assets-page-hero">
        <h1 class="teacher-admin-title">${escapeHtml(t("teacher.assets.page_title"))}</h1>
        <p class="teacher-admin-subtitle">${escapeHtml(t("teacher.assets.page_subtitle", { name: displayName }))}</p>
        <div class="teacher-assets-tabs" role="tablist" aria-label="${escapeHtml(t("teacher.assets.tabs_aria"))}">
          <a role="tab" class="teacher-assets-tab ${listView === "active" ? "is-active" : ""}" href="${teacherCoursesAssetsHref(
            "active",
          )}" aria-selected="${listView === "active" ? "true" : "false"}">${escapeHtml(
            t("teacher.assets.tab_active"),
          )}</a>
          <a role="tab" class="teacher-assets-tab ${listView === "trash" ? "is-active" : ""}" href="${teacherCoursesAssetsHref(
            "trash",
          )}" aria-selected="${listView === "trash" ? "true" : "false"}">${escapeHtml(
            t("teacher.assets.tab_trash"),
          )}</a>
        </div>
      </header>

      <section class="card teacher-assets-list-card${listView === "trash" ? " teacher-assets-list-card--trash" : ""}" aria-label="${escapeHtml(
        listView === "trash" ? t("teacher.assets.trash_list_aria") : t("teacher.assets.list_aria"),
      )}">${listToolbarHtml}${emptyBlock}${tableBlock}</section>
  `;
  container.innerHTML = main;

  const doQuickCreate = () => {
    const a = createClassroomAssetForLesson({
      teacherProfileId: profileId,
      ownerUserId: userId,
      course: "kids",
      level: "1",
      lesson: "1",
      t: tx,
    });
    try {
      alert(t("teacher.assets.create_ok_toast"));
    } catch {
      /* */
    }
    location.hash = `#teacher-asset-editor?id=${encodeURIComponent(a.id)}`;
  };
  container.querySelectorAll("[data-teacher-asset-trash]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const id = btn.getAttribute("data-teacher-asset-trash");
      if (!id || /** @type {HTMLButtonElement} */ (btn).disabled) return;
      ev.preventDefault();
      if (!confirm(trashConfirmMessage(t))) return;
      const r = moveTeacherAssetToTrash(id, userId);
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
      void onRefresh();
    });
  });

  container.querySelectorAll("[data-teacher-asset-restore]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const id = btn.getAttribute("data-teacher-asset-restore");
      if (!id) return;
      ev.preventDefault();
      const r = restoreTeacherAssetFromTrash(id, userId);
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
      location.hash = teacherCoursesAssetsHref("active");
      void onRefresh();
    });
  });

  container.querySelector("#teacherAssetsEmptyTrash")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (trashed.length === 0) return;
    if (!confirm(t("teacher.assets.empty_trash_confirm_1"))) return;
    if (!confirm(t("teacher.assets.empty_trash_confirm_2"))) return;
    const r = permanentlyDeleteAllTrashedForTeacherProfile(profileId);
    if (!r.ok) return;
    void onRefresh();
  });
  container.querySelector("#teacherAssetsEmptyQuickCreate")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    doQuickCreate();
  });

  container.querySelectorAll("[data-teacher-asset-archive]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const el = /** @type {HTMLButtonElement} */ (btn);
      const id = el.getAttribute("data-teacher-asset-archive");
      if (!id || el.disabled) return;
      ev.preventDefault();
      updateTeacherAsset({ id, status: ASSET_STATUS.archived });
      void onRefresh();
    });
  });

  container.querySelectorAll("[data-teacher-asset-submit]").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      const id = btn.getAttribute("data-teacher-asset-submit");
      if (!id || /** @type {HTMLButtonElement} */ (btn).disabled) return;
      ev.preventDefault();
      const res = await submitTeacherAssetListingForReview(id, userId);
      if (!res.ok) {
        const msg = t(`teacher.publishing.error.${res.code}`) || res.code || t("common.no_data");
        try {
          alert(msg);
        } catch {
          /* */
        }
        return;
      }
      void onRefresh();
    });
  });

  container.querySelectorAll(".teacher-commerce-pt").forEach((sel) => {
    sel.addEventListener("change", () => {
      const id = sel.getAttribute("data-commerce-pt");
      if (!id) return;
      const cell = container.querySelector(`[data-commerce-listing="${id}"]`);
      const pt = String(sel.value || "");
      const inp = cell?.querySelector(`[data-commerce-amt="${id}"]`);
      if (inp) {
        const show = pt === PRICING_TYPE.paid;
        /** @type {HTMLInputElement} */ (inp).style.display = show ? "" : "none";
        inp.toggleAttribute("aria-hidden", !show);
      }
    });
  });
  container.querySelectorAll("[data-commerce-save]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const id = btn.getAttribute("data-commerce-save");
      if (!id) return;
      ev.preventDefault();
      const cell = container.querySelector(`[data-commerce-listing="${id}"]`);
      const sel = cell?.querySelector(`[data-commerce-pt="${id}"]`);
      const inp = cell?.querySelector(`[data-commerce-amt="${id}"]`);
      const pt = String(sel?.value || "free");
      const raw = inp && "value" in inp ? String(/** @type {HTMLInputElement} */ (inp).value) : "0";
      const r = updateListingPricingForTeacher(id, {
        pricing_type: pt === PRICING_TYPE.paid ? PRICING_TYPE.paid : PRICING_TYPE.free,
        price_amount: raw,
        teacher_profile_id: profileId,
      });
      if (!r.ok) {
        const msg = t("teacher.assets.commerce_save_failed");
        try {
          alert(msg);
        } catch {
          /* */
        }
        return;
      }
      void onRefresh();
    });
  });
  container.querySelectorAll("[data-teacher-asset-gopublic]").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      const id = btn.getAttribute("data-teacher-asset-gopublic");
      if (!id) return;
      ev.preventDefault();
      const res = await setClassroomAssetListingToPublic(id, profileId);
      if (!res.ok) {
        const msg = t(`teacher.publishing.error.${res.code}`) || res.code;
        try {
          alert(msg);
        } catch {
          /* */
        }
        return;
      }
      void onRefresh();
    });
  });
  const importInp = container.querySelector("#teacherAssetsImportInput");
  container.querySelectorAll(".js-teacher-assets-import-trigger").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      importInp?.click();
    });
  });
  importInp?.addEventListener("change", () => {
    const f = importInp.files && importInp.files[0];
    importInp.value = "";
    if (!f) return;
    const v = validateTeacherImportFile(f);
    if (!v.ok) {
      const ek = `teacher.assets.import_error.${v.code}`;
      let msg = t(ek);
      if (msg === ek) msg = v.code || "";
      try {
        alert(msg);
      } catch {
        /* */
      }
      return;
    }
    try {
      createImportedSlideDraftFromFile(f, { teacherProfileId: profileId, ownerUserId: userId });
    } catch {
      try {
        alert(t("teacher.assets.import_error.unknown"));
      } catch {
        /* */
      }
      return;
    }
    try {
      alert(t("teacher.assets.import_ok_toast"));
    } catch {
      /* */
    }
    void onRefresh();
  });

  container.querySelectorAll("[data-teacher-asset-goprivate]").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      const id = btn.getAttribute("data-teacher-asset-goprivate");
      if (!id) return;
      ev.preventDefault();
      const res = await setClassroomAssetListingToPrivate(id, profileId);
      if (!res.ok) {
        const msg = t(`teacher.publishing.error.${res.code}`) || res.code;
        try {
          alert(msg);
        } catch {
          /* */
        }
        return;
      }
      void onRefresh();
    });
  });

  i18n.apply?.(container);
}