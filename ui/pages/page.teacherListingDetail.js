// 前台：老师 listing 公开展示 + 免费获取 / 模拟购买（Step 5）+ 教师会话态预览

import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import { formatCommerceEnum, formatTeacherHubCourseDisplay, safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { findAssetById, getEffectiveTeacherNote, ASSET_TYPE } from "../lumina-commerce/teacherAssetsStore.js";
import { LISTING_STATUS, VISIBILITY, PRICING_TYPE } from "../lumina-commerce/enums.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import {
  getListingCommerceUiState,
  getListingPricingType,
  purchaseOrGrantListingAccess,
} from "../lumina-commerce/teacherCommerceBridge.js";
import {
  canCurrentUserPreviewTeacherListing,
  setClassroomAssetListingToPrivate,
} from "../lumina-commerce/teacherListingBridge.js";
import { i18n } from "../i18n.js";
import { demoBannerHtml } from "../components/demoBanner.js";

function tx(k, p) {
  return safeUiText(k, p);
}

function parseQuery() {
  const hash = String(location.hash || "");
  const q = hash.indexOf("?");
  if (q < 0) return /** @type {Record<string, string>} */ ({});
  const sp = new URLSearchParams(hash.slice(q + 1));
  const out = /** @type {Record<string, string>} */ ({});
  sp.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 与 #teacher 工作台统一的状态 pill 文案/样式。
 * @param {import('../lumina-commerce/schema.js').Listing} L
 * @param {(k: string, p?: object) => string} t
 */
function listingUnifiedPillsForDetail(L, t) {
  const st = L.status;
  const stMod =
    st === LISTING_STATUS.pending_review
      ? "pending"
      : st === LISTING_STATUS.approved
        ? "approved"
        : st === LISTING_STATUS.rejected
          ? "rejected"
          : "draft";
  const stKey =
    st === LISTING_STATUS.pending_review
      ? "status_pending"
      : st === LISTING_STATUS.approved
        ? "status_approved"
        : st === LISTING_STATUS.rejected
          ? "status_rejected"
          : "status_draft";
  const pub = L.visibility === VISIBILITY.public;
  const visKey = pub ? "vis_public" : "vis_private";
  const visMod = pub ? "vis_public" : "vis_private";
  return `<span class="teacher-state-pill teacher-state-pill--${stMod}">${escapeHtml(
    t(`teacher.unified.${stKey}`),
  )}</span><span class="teacher-state-pill teacher-state-pill--${visMod}">${escapeHtml(t(`teacher.unified.${visKey}`))}</span>`;
}

/**
 * 教师预览模式下的首屏说明
 * @param {import('../lumina-commerce/schema.js').Listing} L
 * @param {(k: string, p?: object) => string} t
 */
function teacherPreviewContextLine(L, t) {
  const st = L.status;
  if (st === LISTING_STATUS.approved && L.visibility !== VISIBILITY.public) {
    return t("teacher.listing_detail.preview_context_approved_unlisted");
  }
  if (st === LISTING_STATUS.pending_review) {
    return t("teacher.listing_detail.preview_context_pending");
  }
  if (st === LISTING_STATUS.rejected) {
    return t("teacher.listing_detail.preview_context_rejected");
  }
  if (st === LISTING_STATUS.draft) {
    return t("teacher.listing_detail.preview_context_draft");
  }
  return t("teacher.listing_detail.preview_context_generic");
}

/**
 * @param {HTMLElement} root
 * @param {string} listingId
 */
async function renderPublicDetail(root, listingId) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  if (!snap) {
    root.innerHTML = `<div class="wrap"><p>${escapeHtml(tx("common.loading"))}</p></div>`;
    return;
  }

  const L = snap.listings.find((l) => l.id === listingId) || null;
  if (!L) {
    root.innerHTML = `<div class="wrap teacher-listing-public-page teacher-listing-detail">
    <section class="card teacher-listing-gate teacher-listing-gate--product">
      <h1 class="teacher-listing-gate-title">${escapeHtml(tx("teacher.listing_public.not_found"))}</h1>
      <p class="teacher-listing-gate-body">${escapeHtml(tx("teacher.listing_public.not_found_desc"))}</p>
      <p class="teacher-listing-gate-actions"><a class="teacher-hub-cta" href="#teacher">${escapeHtml(
        tx("teacher.listing_detail.go_teacher_home"),
      )}</a></p>
    </section></div>`;
    i18n.apply?.(root);
    return;
  }

  const u = getCurrentUser();
  const isPublicListing = L.status === LISTING_STATUS.approved && L.visibility === VISIBILITY.public;
  const canTeacherPreview = canCurrentUserPreviewTeacherListing(snap, L, u);
  if (!isPublicListing && !canTeacherPreview) {
    const limitedTitle = tx("teacher.listing_detail.unavailable_title");
    const limitedBody = tx("teacher.listing_detail.unavailable_body");
    root.innerHTML = `<div class="wrap teacher-listing-public-page teacher-listing-detail">
    <section class="card teacher-listing-gate teacher-listing-gate--product">
      <h1 class="teacher-listing-gate-title">${escapeHtml(limitedTitle)}</h1>
      <p class="teacher-listing-gate-body">${escapeHtml(limitedBody)}</p>
      <p class="teacher-listing-gate-status">${escapeHtml(
        tx("teacher.listing_detail.status_line", { status: formatCommerceEnum("listing_status", L.status) }),
      )}</p>
      <p class="teacher-listing-gate-actions"><a class="teacher-hub-cta" href="#teacher">${escapeHtml(
        tx("teacher.listing_detail.go_teacher_home"),
      )}</a></p>
    </section></div>`;
    i18n.apply?.(root);
    return;
  }

  const viewMode = isPublicListing ? "public" : "teacher_preview";

  /** 适合公开展示的教师备注前段（不整段外泄） */
  const publicTeacherTeaser = (s, max) => {
    const t0 = String(s || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t0) return "";
    if (t0.length <= max) return t0;
    return t0.slice(0, max) + "…";
  };

  const ui = await getListingCommerceUiState(listingId, u.id);
  const tp = L.teacher_id ? snap.teacher_profiles.find((p) => p.id === L.teacher_id) : null;
  const teacherName = tp?.display_name || "—";
  const asset = L.source_kind === "classroom_asset" && L.source_id ? findAssetById(String(L.source_id)) : null;
  const isCourseware = Boolean(asset) && asset && asset.asset_type === ASSET_TYPE.lesson_slide_draft;
  const sourceCourse = asset
    ? tx("teacher.publishing.source_course_line", {
        course: formatTeacherHubCourseDisplay(asset.source?.course),
        level: String(asset.source?.level),
        lesson: String(asset.source?.lesson),
      })
    : tx("teacher.publishing.source_course_unknown");

  const mainTitle = isCourseware && asset && String(asset.title).trim() ? String(asset.title).trim() : L.title;
  const subT = isCourseware && asset && String(asset.subtitle || "").trim() ? String(asset.subtitle).trim() : "";
  const desc = isCourseware && asset
    ? [String(asset.summary || "").trim(), L.description, L.summary]
        .map((x) => String(x || "").trim())
        .find((x) => x.length) || ""
    : (L.description || L.summary || L.title || "").trim();
  const coverBlurb = isCourseware && asset ? String(asset.cover_note || "").trim() : "";
  const teachTease =
    isCourseware && asset && getEffectiveTeacherNote(asset)
      ? publicTeacherTeaser(getEffectiveTeacherNote(asset), 220)
      : "";
  const typeLabel = safeUiText(`commerce.enum.listing_type.${L.listing_type}`);
  const productFormatLabel = isCourseware
    ? tx("teacher.listing_detail.format_teacher_courseware")
    : typeLabel;
  const pt = getListingPricingType(L);
  const priceLine =
    pt === PRICING_TYPE.free
      ? tx("learner.commerce.price_free")
      : tx("learner.commerce.price_paid_line", {
          amount: String(L.sale_price_amount ?? L.price_amount ?? "0"),
          currency: String(L.price_currency || "KRW"),
        });

  const hasAccess = viewMode === "public" && ui?.hasAccess;
  const isGuestVisitor = Boolean(u.isGuest) || !u.id || u.id === "u_guest";
  const canBuy =
    viewMode === "public" &&
    !isGuestVisitor &&
    ui?.canAttemptPurchase &&
    (pt === PRICING_TYPE.free || (pt === PRICING_TYPE.paid && (ui?.amount || 0) > 0));
  const ownedLabel = hasAccess
    ? pt === PRICING_TYPE.free
      ? tx("learner.commerce.status_granted")
      : tx("learner.commerce.status_purchased")
    : "";

  const classUrl =
    L.source_kind === "classroom_asset" && L.source_id ? "#classroom?assetId=" + encodeURIComponent(String(L.source_id)) : "#classroom";
  const editorUrl =
    asset && L.source_kind === "classroom_asset" && L.source_id
      ? "#teacher-asset-editor?id=" + encodeURIComponent(String(L.source_id))
      : null;

  const statusBlock = hasAccess
    ? `<p class="teacher-listing-owned-badge" role="status">${escapeHtml(ownedLabel)}</p>
       <p class="teacher-listing-toast-placeholder" id="teacherListingToast" hidden></p>`
    : `<p class="teacher-listing-toast-placeholder" id="teacherListingToast" hidden></p>`;

  const loginNext = encodeURIComponent(`teacher-listing?id=${listingId}`);
  const purchaseBlock =
    viewMode === "teacher_preview"
      ? `<p class="teacher-listing-preview-purchase-hint" role="note">${escapeHtml(tx("teacher.listing_detail.preview_acquire_note"))}</p>`
      : hasAccess
        ? `<a class="teacher-hub-cta" href="${classUrl}">${escapeHtml(tx("teacher.listing_public.cta_classroom"))}</a>
       <button type="button" class="teacher-listing-cta-fake" disabled>${escapeHtml(tx("learner.commerce.already_owned_hint"))}</button>`
        : isGuestVisitor
          ? `<p class="teacher-listing-guest-acquire-hint" role="note">${escapeHtml(tx("learner.commerce.login_to_acquire"))}</p>
      <a class="teacher-hub-cta teacher-listing-login-to-acquire" href="#login?next=${loginNext}">${escapeHtml(tx("auth.nav_login"))}</a>`
          : `<button type="button" class="teacher-hub-cta teacher-listing-buy" id="teacherListingAcquire" ${
              canBuy ? "" : "disabled"
            }" data-listing-id="${escapeHtml(listingId)}">
        ${escapeHtml(pt === PRICING_TYPE.free ? tx("learner.commerce.cta_free") : tx("learner.commerce.cta_buy"))}
      </button>
      <span class="teacher-listing-sim-note">${escapeHtml(tx("learner.commerce.simulated_checkout_note"))}</span>`;

  const visLabel =
    isPublicListing || L.visibility === VISIBILITY.public
      ? tx("teacher.unified.vis_public")
      : tx("teacher.unified.vis_private");
  const reviewStatusLabel = formatCommerceEnum("listing_status", L.status);
  const isVisPublic = L.status === LISTING_STATUS.approved && L.visibility === VISIBILITY.public;

  const previewGoPublicHint =
    L.status === LISTING_STATUS.approved && L.visibility !== VISIBILITY.public
      ? `<p class="teacher-listing-preview-banner-go-public">${escapeHtml(tx("teacher.listing_detail.preview_can_go_public"))}</p>`
      : "";

  const isListingOwner =
    !u.isGuest &&
    Boolean(u.teacherProfileId) &&
    Boolean(L.teacher_id) &&
    String(u.teacherProfileId) === String(L.teacher_id);
  const assetIdForListing =
    L.source_kind === "classroom_asset" && L.source_id ? String(L.source_id) : "";
  const ownerPublicBar =
    viewMode === "public" && isListingOwner && assetIdForListing
      ? `<div class="teacher-listing-owner-vis" role="region" aria-label="${escapeHtml(tx("teacher.listing_detail.owner_vis_aria"))}">
  <p class="teacher-listing-owner-vis-text">${escapeHtml(tx("teacher.listing_detail.owner_listing_is_public"))}</p>
  <button type="button" class="teacher-hub-cta teacher-hub-cta--compact teacher-hub-cta--secondary" id="teacherListingMakePrivate" data-asset-id="${escapeHtml(
    assetIdForListing,
  )}">${escapeHtml(tx("teacher.listing_detail.make_private"))}</button>
</div>`
      : "";

  const previewBanner =
    viewMode === "teacher_preview"
      ? `<div class="teacher-listing-preview-banner" role="region" aria-label="${escapeHtml(tx("teacher.listing_detail.preview_aria"))}">
  <p class="teacher-listing-preview-banner-kicker">${escapeHtml(tx("teacher.listing_detail.preview_badge"))}</p>
  <p class="teacher-listing-preview-banner-title">${escapeHtml(tx("teacher.listing_detail.preview_mode_title"))}</p>
  <p class="teacher-listing-preview-banner-lead">${escapeHtml(tx("teacher.listing_detail.preview_mode_lead"))}</p>
  <p class="teacher-listing-preview-banner-context">${escapeHtml(teacherPreviewContextLine(L, tx))}</p>
  ${previewGoPublicHint}
  <ul class="teacher-listing-preview-facts" role="list">
    <li><span class="teacher-listing-preview-k">${escapeHtml(tx("teacher.listing_detail.preview_row_review"))}</span> <span class="teacher-listing-preview-v">${escapeHtml(
        reviewStatusLabel,
      )}</span></li>
    <li><span class="teacher-listing-preview-k">${escapeHtml(tx("teacher.listing_detail.preview_row_visibility"))}</span> <span class="teacher-listing-preview-v">${escapeHtml(
        L.visibility === VISIBILITY.public ? tx("teacher.unified.vis_public") : tx("teacher.unified.vis_private"),
      )}</span></li>
    <li><span class="teacher-listing-preview-k">${escapeHtml(tx("teacher.listing_detail.preview_row_public"))}</span> <span class="teacher-listing-preview-v">${escapeHtml(
        isVisPublic ? tx("teacher.unified.vis_public") : tx("teacher.unified.vis_private"),
      )}</span></li>
  </ul>
  <p class="teacher-listing-preview-nav">
    <a class="teacher-listing-preview-nav-link" href="#teacher-publishing">${escapeHtml(tx("teacher.listing_detail.nav_back_publishing"))}</a>
    <span class="teacher-listing-preview-nav-sep" aria-hidden="true">·</span>
    <a class="teacher-listing-preview-nav-link" href="#teacher-publishing">${escapeHtml(tx("teacher.workflow.view_review_status"))}</a>
    <span class="teacher-listing-preview-nav-sep" aria-hidden="true">·</span>
    <a class="teacher-listing-preview-nav-link" href="#teacher-courses?tab=assets">${escapeHtml(tx("teacher.listing_detail.nav_back_assets"))}</a>
    ${
      editorUrl
        ? `<span class="teacher-listing-preview-nav-sep" aria-hidden="true">·</span><a class="teacher-listing-preview-nav-link" href="${editorUrl}">${escapeHtml(
            tx("teacher.listing_detail.nav_back_editor"),
          )}</a>`
        : ""
    }
  </p>
</div>`
      : "";

  const heroClass = isCourseware ? " teacher-listing-hero--courseware" : "";
  const kickerT =
    viewMode === "teacher_preview"
      ? tx("teacher.listing_detail.preview_kicker")
      : isCourseware
        ? tx("teacher.listing_detail.courseware_hero_kicker")
        : tx("teacher.listing_public.kicker");
  const publicBadge =
    viewMode === "public"
      ? `<span class="teacher-listing-pill teacher-listing-pill--ok">${escapeHtml(tx("teacher.listing_detail.badge_public"))}</span>`
      : viewMode === "teacher_preview"
        ? `<span class="teacher-listing-pill teacher-listing-pill--preview">${escapeHtml(tx("teacher.listing_detail.preview_badge"))}</span>`
        : "";
  const detailWrapClass =
    (isCourseware ? " teacher-listing-detail--courseware" : "") + (viewMode === "teacher_preview" ? " teacher-listing-detail--teacher-preview" : "");

  const surfaceNav =
    viewMode === "teacher_preview"
      ? `<div class="teacher-surface-action-row" role="navigation" aria-label="${escapeHtml(tx("teacher.surface.nav_aria"))}">
        <a class="teacher-surface-link teacher-surface-link--secondary" href="#teacher">${escapeHtml(tx("teacher.listing_detail.go_teacher_home"))}</a>
        <a class="teacher-surface-link" href="#teacher-courses?tab=assets">${escapeHtml(tx("teacher.listing_detail.nav_back_assets"))}</a>
        <a class="teacher-surface-link" href="#teacher-publishing">${escapeHtml(tx("teacher.listing_detail.nav_back_publishing"))}</a>
        <a class="teacher-surface-link" href="#teacher-publishing">${escapeHtml(tx("teacher.workflow.view_review_status"))}</a>
        ${
          editorUrl
            ? `<a class="teacher-surface-link" href="${editorUrl}">${escapeHtml(tx("teacher.listing_detail.nav_back_editor"))}</a>`
            : ""
        }
        <a class="teacher-surface-link" href="${classUrl}">${escapeHtml(tx("teacher.listing_public.cta_classroom"))}</a>
      </div>`
      : "";

  root.innerHTML = `${demoBannerHtml("listing")}
  <div class="wrap teacher-listing-public-page teacher-listing-detail${detailWrapClass}" data-teacher-listing-mode="${viewMode}">
    ${previewBanner}
    <section class="card teacher-surface-hero teacher-listing-hero${heroClass}">
      <p class="teacher-listing-kicker">${escapeHtml(kickerT)}</p>
      <h1 class="teacher-listing-title">${escapeHtml(mainTitle)}</h1>
      ${
        subT
          ? `<p class="teacher-listing-subtitle">${escapeHtml(subT)}</p>`
          : ""
      }
      ${surfaceNav}
      <div class="teacher-listing-badges">
        ${publicBadge}
        ${viewMode === "teacher_preview" ? "" : `<span class="teacher-listing-pill">${escapeHtml(visLabel)}</span>`}
        <span class="teacher-listing-pill">${escapeHtml(
          pt === PRICING_TYPE.free ? tx("learner.commerce.pricing_free") : tx("learner.commerce.pricing_paid"),
        )}</span>
        <span class="teacher-listing-pill teacher-listing-pill--tone">${escapeHtml(tx("teacher.listing_detail.content_form_label"))}: ${escapeHtml(
          productFormatLabel,
        )}</span>
        ${
          viewMode === "teacher_preview"
            ? `<span class="teacher-listing-unified-badges" role="group">${listingUnifiedPillsForDetail(L, tx)}</span>`
            : ""
        }
      </div>
      ${ownerPublicBar}
      <div class="teacher-listing-price-card">
        <span class="teacher-listing-price-label">${escapeHtml(tx("learner.commerce.price"))}</span>
        <span class="teacher-listing-price-value">${escapeHtml(priceLine)}</span>
        <span class="teacher-listing-price-type">${escapeHtml(
          pt === PRICING_TYPE.free ? tx("learner.commerce.pricing_free") : tx("learner.commerce.pricing_paid"),
        )}</span>
      </div>
      <p class="teacher-listing-meta">
        <span class="teacher-listing-teacher">${escapeHtml(tx("teacher.listing_public.teacher_label"))}: ${escapeHtml(teacherName)}</span>
        <span class="teacher-listing-sep" aria-hidden="true">·</span>
        <span class="teacher-listing-type">${escapeHtml(isCourseware ? productFormatLabel : typeLabel)}</span>
      </p>
      <p class="teacher-listing-source-line"><strong>${escapeHtml(tx("teacher.listing_detail.source_course_label"))}</strong> ${escapeHtml(sourceCourse)}</p>
      <p class="teacher-listing-desc">${escapeHtml(desc || tx("teacher.listing_detail.desc_placeholder"))}</p>
      ${
        coverBlurb
          ? `<p class="teacher-listing-cover-note" role="note"><strong>${escapeHtml(tx("teacher.listing_detail.cover_label"))}</strong> ${escapeHtml(
              coverBlurb,
            )}</p>`
          : ""
      }
      ${
        teachTease
          ? `<p class="teacher-listing-teacher-public-tease" role="note"><strong>${escapeHtml(
              tx("teacher.listing_detail.public_note_teaser_label"),
            )}</strong> ${escapeHtml(teachTease)}</p>`
          : ""
      }
      <p class="teacher-listing-asset-hint"><strong>${escapeHtml(tx("teacher.listing_detail.source_asset_label"))}</strong> ${
    asset
      ? escapeHtml(asset.title)
      : escapeHtml(L.source_id && L.source_kind === "classroom_asset" ? L.source_id : "—")
  }</p>
      ${statusBlock}
      <div class="teacher-listing-cta">
        ${purchaseBlock}
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="${classUrl}">${escapeHtml(tx("teacher.listing_public.cta_classroom"))}</a>
      </div>
    </section>
    <section class="card teacher-listing-body-skeleton teacher-listing-about" aria-labelledby="tld-skel-h">
      <h2 id="tld-skel-h" class="teacher-listing-body-title">${escapeHtml(
        isCourseware ? tx("teacher.listing_detail.about_courseware_title") : tx("teacher.listing_detail.content_section_title"),
      )}</h2>
      <dl class="teacher-listing-dl">
        <div class="teacher-listing-dl-row">
          <dt>${escapeHtml(tx("teacher.listing_detail.audience"))}</dt>
          <dd>${escapeHtml(tx("teacher.listing_detail.audience_placeholder"))}</dd>
        </div>
        <div class="teacher-listing-dl-row">
          <dt>${escapeHtml(tx("teacher.listing_detail.course_source"))}</dt>
          <dd>${escapeHtml(sourceCourse)}</dd>
        </div>
        <div class="teacher-listing-dl-row">
          <dt>${escapeHtml(tx("teacher.listing_detail.content_format"))}</dt>
          <dd>${escapeHtml(productFormatLabel)} · ${
    isCourseware
      ? escapeHtml(tx("teacher.listing_detail.format_courseware_blurb"))
      : `${escapeHtml(typeLabel)} · ${escapeHtml(tx("teacher.listing_detail.format_placeholder"))}`
  }</dd>
        </div>
        <div class="teacher-listing-dl-row">
          <dt>${escapeHtml(tx("teacher.listing_detail.usage"))}</dt>
          <dd>${escapeHtml(tx("teacher.listing_detail.usage_placeholder"))}</dd>
        </div>
      </dl>
      <p class="teacher-listing-coming-soon">${escapeHtml(tx("teacher.listing_detail.coming_more"))}</p>
    </section>
  </div>`;

  const btn = root.querySelector("#teacherListingAcquire");
  const toast = root.querySelector("#teacherListingToast");
  root.querySelector("#teacherListingMakePrivate")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const mk = root.querySelector("#teacherListingMakePrivate");
    const aid = mk?.getAttribute("data-asset-id") || "";
    const tid = u.teacherProfileId ? String(u.teacherProfileId) : "";
    if (!aid || !tid) return;
    const res = await setClassroomAssetListingToPrivate(aid, tid);
    if (!res.ok) {
      const key = `teacher.publishing.error.${res.code}`;
      const msg = tx(key) !== key ? tx(key) : String(res.code || "");
      try {
        alert(msg);
      } catch {
        /* */
      }
      return;
    }
    await renderPublicDetail(root, listingId);
  });

  btn?.addEventListener("click", async () => {
    if (!btn || btn.disabled) return;
    const res = await purchaseOrGrantListingAccess(listingId, u);
    if (!res.ok) {
      const key = `learner.commerce.error.${res.code}`;
      const msg = tx(key) !== key ? tx(key) : tx("learner.commerce.error.unknown");
      if (toast) {
        toast.hidden = false;
        toast.textContent = msg;
      } else {
        try {
          alert(msg);
        } catch {
          /* */
        }
      }
      return;
    }
    if (toast) {
      toast.hidden = false;
      toast.textContent = tx("learner.commerce.success_in_library");
    }
    await renderPublicDetail(root, listingId);
  });

  i18n.apply?.(root);
}

export default async function pageTeacherListingDetail(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  const q = parseQuery();
  const id = String(q.id || "").trim();

  if (!id) {
    root.innerHTML = `<div class="wrap teacher-listing-public-page teacher-listing-detail"><section class="card teacher-listing-gate teacher-listing-gate--product">
      <h1 class="teacher-listing-gate-title">${escapeHtml(tx("teacher.listing_public.not_found"))}</h1>
      <p class="teacher-listing-gate-body">${escapeHtml(tx("teacher.listing_public.not_found_desc"))}</p>
      <p class="teacher-listing-gate-actions"><a class="teacher-hub-cta" href="#teacher">${escapeHtml(
        tx("teacher.listing_detail.go_teacher_home"),
      )}</a></p>
    </section></div>`;
    i18n.apply?.(root);
    return;
  }

  await renderPublicDetail(root, id);
}

export function mount(ctx) {
  return pageTeacherListingDetail(ctx);
}
export function render(ctx) {
  return pageTeacherListingDetail(ctx);
}
