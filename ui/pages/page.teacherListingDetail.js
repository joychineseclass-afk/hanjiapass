// 前台：老师 listing 公开展示 + 免费获取 / 模拟购买（Step 5）

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
import { i18n } from "../i18n.js";

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

  const isPublic = L.status === LISTING_STATUS.approved && L.visibility === VISIBILITY.public;
  /** 适合公开展示的教师备注前段（不整段外泄） */
  const publicTeacherTeaser = (s, max) => {
    const t0 = String(s || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t0) return "";
    if (t0.length <= max) return t0;
    return t0.slice(0, max) + "…";
  };
  if (!isPublic) {
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

  const u = getCurrentUser();
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

  const hasAccess = ui?.hasAccess;
  const canBuy = ui?.canAttemptPurchase && (pt === PRICING_TYPE.free || (pt === PRICING_TYPE.paid && (ui?.amount || 0) > 0));
  const ownedLabel = hasAccess
    ? pt === PRICING_TYPE.free
      ? tx("learner.commerce.status_granted")
      : tx("learner.commerce.status_purchased")
    : "";

  const classUrl =
    L.source_kind === "classroom_asset" && L.source_id ? "#classroom?assetId=" + encodeURIComponent(String(L.source_id)) : "#classroom";

  const statusBlock = hasAccess
    ? `<p class="teacher-listing-owned-badge" role="status">${escapeHtml(ownedLabel)}</p>
       <p class="teacher-listing-toast-placeholder" id="teacherListingToast" hidden></p>`
    : `<p class="teacher-listing-toast-placeholder" id="teacherListingToast" hidden></p>`;

  const purchaseBlock = hasAccess
    ? `<a class="teacher-hub-cta" href="${classUrl}">${escapeHtml(tx("teacher.listing_public.cta_classroom"))}</a>
       <button type="button" class="teacher-listing-cta-fake" disabled>${escapeHtml(tx("learner.commerce.already_owned_hint"))}</button>`
    : `<button type="button" class="teacher-hub-cta teacher-listing-buy" id="teacherListingAcquire" ${
        canBuy ? "" : "disabled"
      }" data-listing-id="${escapeHtml(listingId)}">
        ${escapeHtml(pt === PRICING_TYPE.free ? tx("learner.commerce.cta_free") : tx("learner.commerce.cta_buy"))}
      </button>
      <span class="teacher-listing-sim-note">${escapeHtml(tx("learner.commerce.simulated_checkout_note"))}</span>`;

  const visLabel = safeUiText(`commerce.enum.visibility.${L.visibility || "private"}`);

  const heroClass = isCourseware ? " teacher-listing-hero--courseware" : "";
  const kickerT = isCourseware ? tx("teacher.listing_detail.courseware_hero_kicker") : tx("teacher.listing_public.kicker");
  root.innerHTML = `<div class="wrap teacher-listing-public-page teacher-listing-detail${isCourseware ? " teacher-listing-detail--courseware" : ""}">
    <section class="card teacher-listing-hero${heroClass}">
      <p class="teacher-listing-kicker">${escapeHtml(kickerT)}</p>
      <h1 class="teacher-listing-title">${escapeHtml(mainTitle)}</h1>
      ${
        subT
          ? `<p class="teacher-listing-subtitle">${escapeHtml(subT)}</p>`
          : ""
      }
      <div class="teacher-listing-badges">
        <span class="teacher-listing-pill teacher-listing-pill--ok">${escapeHtml(tx("teacher.listing_detail.badge_public"))}</span>
        <span class="teacher-listing-pill">${escapeHtml(visLabel)}</span>
        <span class="teacher-listing-pill">${escapeHtml(
          pt === PRICING_TYPE.free ? tx("learner.commerce.pricing_free") : tx("learner.commerce.pricing_paid"),
        )}</span>
        <span class="teacher-listing-pill teacher-listing-pill--tone">${escapeHtml(tx("teacher.listing_detail.content_form_label"))}: ${escapeHtml(
          productFormatLabel,
        )}</span>
      </div>
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
