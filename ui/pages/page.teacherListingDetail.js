// 前台：老师 listing 公开展示（仅 approved + public；本地演示）

import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import { formatTeacherHubCourseDisplay, safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { findAssetById } from "../lumina-commerce/teacherAssetsStore.js";
import { LISTING_STATUS, VISIBILITY } from "../lumina-commerce/enums.js";
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

  await initCommerceStore();
  const snap = getCommerceStoreSync();
  if (!snap) {
    root.innerHTML = `<div class="wrap"><p>${escapeHtml(tx("common.loading"))}</p></div>`;
    return;
  }

  const L = snap.listings.find((l) => l.id === id) || null;
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

  root.innerHTML = `<div class="wrap teacher-listing-public-page">
    <section class="card teacher-listing-hero">
      <p class="teacher-listing-kicker">${escapeHtml(tx("teacher.listing_public.kicker"))}</p>
      <h1 class="teacher-listing-title">${escapeHtml(L.title)}</h1>
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
      <div class="teacher-listing-cta">
        <a class="teacher-hub-cta" href="${
          L.source_kind === "classroom_asset" && L.source_id
            ? "#classroom?assetId=" + encodeURIComponent(String(L.source_id))
            : "#classroom"
        }">${escapeHtml(tx("teacher.listing_public.cta_classroom"))}</a>
        <button type="button" class="teacher-listing-cta-fake" disabled title="${escapeHtml(
          tx("teacher.listing_public.cta_purchase_note"),
        )}">${escapeHtml(tx("teacher.listing_public.cta_purchase"))}</button>
        <button type="button" class="teacher-listing-cta-fake" disabled title="${escapeHtml(
          tx("teacher.listing_public.cta_entitlement_note"),
        )}">${escapeHtml(tx("teacher.listing_public.cta_entitlement"))}</button>
      </div>
    </section>
  </div>`;
  i18n.apply?.(root);
}

export function mount(ctx) {
  return pageTeacherListingDetail(ctx);
}
export function render(ctx) {
  return pageTeacherListingDetail(ctx);
}
