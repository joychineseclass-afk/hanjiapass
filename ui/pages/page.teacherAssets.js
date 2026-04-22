// 我的课堂资产：列表、进入课堂、归档、发布审核（Step 4）

import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { updateTeacherAsset } from "../lumina-commerce/teacherAssetsStore.js";
import {
  listAssetsByProfileId,
  ASSET_STATUS,
  ASSET_TYPE,
  createClassroomAssetForLesson,
  getEffectiveTeacherNote,
} from "../lumina-commerce/teacherAssetsSelectors.js";
import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import {
  findListingByAssetId,
  submitTeacherAssetListingForReview,
  setClassroomAssetListingToPublic,
  getTeacherAssetPublishUiState,
} from "../lumina-commerce/teacherListingBridge.js";
import { LISTING_STATUS, PRICING_TYPE, VISIBILITY } from "../lumina-commerce/enums.js";
import {
  countGrantsForListing,
  getListingPayableAmount,
  getListingPricingType,
  updateListingPricingForTeacher,
} from "../lumina-commerce/teacherCommerceBridge.js";
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
 * @param {string} profileId
 * @param {string} userId
 * @param {import('../lumina-commerce/store.js').CommerceStoreSnapshot|null} snap
 */
function assetRow(a, t, profileId, userId, listing, snap) {
  const src = a.source;
  const srcLine = t("teacher.assets.source_line", {
    course: formatTeacherHubCourseDisplay(src.course),
    level: String(src.level),
    lesson: String(src.lesson),
  });
  const stClass = `teacher-asset-status-chip--${String(a.status).replace(/[^a-z0-9_]/g, "_")}`;
  const pub = getTeacherAssetPublishUiState(profileId, userId, listing || null, a, t);
  const reviewLine = pub.listingStateLabel;
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
  const publicUrl = hasPubListing && listing && listing.status === LISTING_STATUS.approved && listing.visibility === VISIBILITY.public
    ? `#teacher-listing?id=${encodeURIComponent(listing.id)}`
    : "";
  const archDisabled = a.status === ASSET_STATUS.archived;
  const hasNote = Boolean(getEffectiveTeacherNote(a));
  const noteShort = hasNote ? t("teacher.assets.has_teacher_note_badge") : t("teacher.assets.has_teacher_note_no");
  const editDeck =
    a.asset_type === ASSET_TYPE.lesson_slide_draft
      ? `<a class="teacher-asset-btn teacher-asset-btn--primary" href="#teacher-asset-editor?id=${encodeURIComponent(a.id)}">${escapeHtml(
          t("teacher.assets.edit_deck"),
        )}</a>`
      : `<span class="teacher-asset-muted" title="${escapeHtml(t("teacher.assets.edit_placeholder"))}">${escapeHtml(
          t("teacher.assets.edit"),
        )}</span>`;
  const enterRoom = `<a class="teacher-asset-btn teacher-asset-btn--accent" href="#classroom?assetId=${encodeURIComponent(
    a.id,
  )}">${escapeHtml(t("teacher.assets.enter_classroom_teach"))}</a>`;
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
    const nGrants = countGrantsForListing(snap, listing.id);
    const priceVal = payAmt > 0 ? String(payAmt) : String(listing.price_amount || listing.sale_price_amount || 0);
    return `<td class="teacher-manage-cell-commerce" data-commerce-listing="${escapeHtml(listing.id)}">
      <div class="teacher-asset-commerce-summary">
        <span class="teacher-commerce-chip teacher-commerce-chip--price">${escapeHtml(priceShort)}</span>
        <span class="teacher-commerce-chip ${isPub ? "is-pub" : ""}">${escapeHtml(
      isPub ? t("teacher.assets.commerce_public_yes") : t("teacher.assets.commerce_public_no"),
    )}</span>
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
  const stitle = a.subtitle && String(a.subtitle).trim() ? String(a.subtitle).trim() : "";
  return `<tr data-teacher-asset-id="${escapeHtml(a.id)}">
    <td class="teacher-manage-cell-title">
      <div class="teacher-asset-title-line">${escapeHtml(a.title)}</div>
      ${stitle ? `<div class="teacher-asset-subline">${escapeHtml(stitle)}</div>` : ""}
    </td>
    <td class="teacher-manage-cell-meta"><span class="teacher-asset-type-pill">${escapeHtml(t(`teacher.assets.type.${a.asset_type}`))}</span></td>
    <td>${escapeHtml(srcLine)}</td>
    <td><span class="teacher-asset-status-chip ${escapeHtml(stClass)}">${escapeHtml(assetStatusLabel(t, a.status))}</span></td>
    <td class="teacher-manage-cell-note"><span class="teacher-asset-note-chip ${hasNote ? "has-note" : ""}">${escapeHtml(noteShort)}</span></td>
    <td class="teacher-manage-cell-publish">
      <div class="teacher-asset-pub-row">
        <span class="teacher-publish-chip teacher-publish-chip--listing">${escapeHtml(
          hasPubListing ? t("teacher.assets.has_listing_yes") : t("teacher.assets.has_listing_no"),
        )}</span>
        <span class="teacher-publish-chip teacher-publish-chip--state">${escapeHtml(reviewLine)}</span>
        ${
          hasPubListing
            ? `<span class="teacher-asset-visibility-pill ${isVisPublic ? "is-pub" : "is-prv"}">${escapeHtml(
                isVisPublic ? t("teacher.assets.publish_vis_public") : t("teacher.assets.publish_vis_private"),
              )}</span>`
            : ""
        }
      </div>
      <p class="teacher-asset-pub-aux">
        <a class="teacher-asset-link" href="#teacher-publishing" title="${escapeHtml(t("teacher.assets.view_publish_state"))}">${escapeHtml(
          t("teacher.assets.view_publish_state"),
        )}</a>
        ${
          hasPubListing && listingId
            ? ` <a class="teacher-asset-link teacher-asset-link--preview" href="#teacher-listing?id=${encodeURIComponent(
                listingId,
              )}">${escapeHtml(t("teacher.assets.preview_listing_page"))}</a>`
            : ""
        }
      </p>
      ${rejectHint}
    </td>
    <td>${escapeHtml(formatDemoShortUpdated(a.updated_at))}</td>
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
      ${
        hasPubListing && publicUrl
          ? `<span class="teacher-asset-sep" aria-hidden="true">|</span><a class="teacher-asset-link" href="${publicUrl}">${escapeHtml(
              t("teacher.publishing.view_public_detail"),
            )}</a>`
          : hasPubListing
            ? `<span class="teacher-asset-sep" aria-hidden="true">|</span><span class="teacher-asset-muted">${escapeHtml(
                t("teacher.publishing.not_public_yet"),
              )}</span>`
            : ""
      }
      ${
        canSetPublic
          ? `<span class="teacher-asset-sep" aria-hidden="true">|</span><button type="button" class="teacher-asset-ghost" data-teacher-asset-gopublic="${escapeHtml(
              a.id,
            )}">${escapeHtml(t("teacher.publishing.go_public"))}</button>`
          : ""
      }
      <span class="teacher-asset-sep" aria-hidden="true">|</span>
      <button type="button" class="teacher-asset-ghost" data-teacher-asset-archive="${escapeHtml(a.id)}" ${
    archDisabled ? "disabled" : ""
  }>${escapeHtml(t("teacher.assets.archive"))}</button>
      </div>
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

  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const profileId = ctx.profile.id;
  const userId = ctx.user?.id || "";

  const assets = listAssetsByProfileId(profileId);
  const hasRows = assets.length > 0;
  const rows = hasRows
    ? assets
        .map((a) => {
          const listing = snap ? findListingByAssetId(snap, a.id) : null;
          return assetRow(a, t, profileId, userId, listing, snap);
        })
        .join("")
    : "";
  const emptyBlock = hasRows
    ? ""
    : `<div class="teacher-assets-empty card">
         <h3 class="teacher-assets-empty-title">${escapeHtml(t("teacher.assets.empty_title_v2"))}</h3>
         <p class="teacher-assets-empty-body">${escapeHtml(t("teacher.assets.empty_body_v3"))}</p>
         <p class="teacher-assets-empty-cta">
           <button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetsEmptyQuickCreate">
             ${escapeHtml(t("teacher.assets.empty_cta_new_deck"))}
           </button>
           <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-courses">${escapeHtml(
             t("teacher.assets.empty_cta_from_course"),
           )}</a>
         </p>
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
    : "";

  root.innerHTML = `
    <div class="teacher-page wrap teacher-assets-page teacher-manage-page">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker teacher-page-kicker--shell">${escapeHtml(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("assets", t)}
      <header class="card teacher-surface-hero teacher-admin-header">
        <h1 class="teacher-admin-title">${escapeHtml(t("teacher.assets.page_title"))}</h1>
        <p class="teacher-admin-subtitle">${escapeHtml(t("teacher.assets.page_subtitle", { name: ctx.profile.display_name }))}</p>
        <p class="teacher-assets-step4-hint teacher-tile-desc">${escapeHtml(t("teacher.publishing.page_hint"))}</p>
        <div class="teacher-assets-header-actions">
          <button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetsHeaderQuickCreate">
            ${escapeHtml(t("teacher.assets.new_classroom_deck"))}
          </button>
        </div>
        <div class="teacher-surface-action-row" role="navigation" aria-label="${escapeHtml(t("teacher.surface.nav_aria"))}">
          <a class="teacher-surface-link teacher-surface-link--secondary" href="#teacher">${escapeHtml(t("teacher.nav.back_mine_workbench"))}</a>
          <a class="teacher-surface-link" href="#teacher-publishing">${escapeHtml(t("teacher.nav.my_publishing"))}</a>
          <a class="teacher-surface-link" href="#teacher-review">${escapeHtml(t("teacher.nav.review_console"))}</a>
        </div>
      </header>
      ${teacherPathStripHtml("assets", t)}
      ${teacherPathStripClassroomHintHtml(t)}

      ${emptyBlock}
      <section class="card teacher-assets-list-card" aria-label="${escapeHtml(t("teacher.assets.list_aria"))}">${tableBlock}</section>
    </div>
  `;

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
  root.querySelector("#teacherAssetsHeaderQuickCreate")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    doQuickCreate();
  });
  root.querySelector("#teacherAssetsEmptyQuickCreate")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    doQuickCreate();
  });

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

  root.querySelectorAll("[data-teacher-asset-submit]").forEach((btn) => {
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
      void renderPage(root);
    });
  });

  root.querySelectorAll(".teacher-commerce-pt").forEach((sel) => {
    sel.addEventListener("change", () => {
      const id = sel.getAttribute("data-commerce-pt");
      if (!id) return;
      const cell = root.querySelector(`[data-commerce-listing="${id}"]`);
      const pt = String(sel.value || "");
      const inp = cell?.querySelector(`[data-commerce-amt="${id}"]`);
      if (inp) {
        const show = pt === PRICING_TYPE.paid;
        /** @type {HTMLInputElement} */ (inp).style.display = show ? "" : "none";
        inp.toggleAttribute("aria-hidden", !show);
      }
    });
  });
  root.querySelectorAll("[data-commerce-save]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const id = btn.getAttribute("data-commerce-save");
      if (!id) return;
      ev.preventDefault();
      const cell = root.querySelector(`[data-commerce-listing="${id}"]`);
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
      void renderPage(root);
    });
  });
  root.querySelectorAll("[data-teacher-asset-gopublic]").forEach((btn) => {
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
