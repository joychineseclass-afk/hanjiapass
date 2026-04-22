// 前台：老师 listing 公开展示 + 免费获取 / 模拟购买（Step 5）

import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import { formatTeacherHubCourseDisplay, safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { findAssetById } from "../lumina-commerce/teacherAssetsStore.js";
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
    root.innerHTML = `<div class="wrap teacher-listing-public-page"><section class="card teacher-listing-gate">
      <h1 class="teacher-listing-gate-title">${escapeHtml(tx("teacher.listing_public.not_found"))}</h1>
      <p class="teacher-listing-gate-body">${escapeHtml(tx("teacher.listing_public.not_found_desc"))}</p>
    </section></div>`;
    i18n.apply?.(root);
    return;
  }

  const isPublic = L.status === LISTING_STATUS.approved && L.visibility === VISIBILITY.public;
  if (!isPublic) {
    root.innerHTML = `<div class="wrap teacher-listing-public-page"><section class="card teacher-listing-gate">
      <h1 class="teacher-listing-gate-title">${escapeHtml(tx("teacher.listing_public.no_access_title"))}</h1>
      <p class="teacher-listing-gate-body">${escapeHtml(tx("teacher.listing_public.no_access_body"))}</p>
    </section></div>`;
    i18n.apply?.(root);
    return;
  }

  const u = getCurrentUser();
  const ui = await getListingCommerceUiState(listingId, u.id);
  const tp = L.teacher_id ? snap.teacher_profiles.find((p) => p.id === L.teacher_id) : null;
  const teacherName = tp?.display_name || "—";
  const asset = L.source_kind === "classroom_asset" && L.source_id ? findAssetById(String(L.source_id)) : null;
  const sourceCourse = asset
    ? tx("teacher.publishing.source_course_line", {
        course: formatTeacherHubCourseDisplay(asset.source?.course),
        level: String(asset.source?.level),
        lesson: String(asset.source?.lesson),
      })
    : tx("teacher.publishing.source_course_unknown");

  const desc = (L.description || L.summary || L.title || "").trim();
  const typeLabel = safeUiText(`commerce.enum.listing_type.${L.listing_type}`);
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

  root.innerHTML = `<div class="wrap teacher-listing-public-page">
    <section class="card teacher-listing-hero">
      <p class="teacher-listing-kicker">${escapeHtml(tx("teacher.listing_public.kicker"))}</p>
      <h1 class="teacher-listing-title">${escapeHtml(L.title)}</h1>
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
        <span class="teacher-listing-type">${escapeHtml(typeLabel)}</span>
      </p>
      <p class="teacher-listing-source-line"><strong>${escapeHtml(tx("teacher.publishing.source_course"))}</strong> ${escapeHtml(sourceCourse)}</p>
      <p class="teacher-listing-desc">${escapeHtml(desc)}</p>
      <p class="teacher-listing-asset-hint"><strong>${escapeHtml(tx("teacher.publishing.from_asset"))}</strong> ${
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
    root.innerHTML = `<div class="wrap teacher-listing-public-page"><section class="card teacher-listing-gate">
      <h1 class="teacher-listing-gate-title">${escapeHtml(tx("teacher.listing_public.not_found"))}</h1>
      <p class="teacher-listing-gate-body">${escapeHtml(tx("teacher.listing_public.not_found_desc"))}</p>
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
