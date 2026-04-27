// 我的内容：已获 entitlement 的 listing（#my-content）

import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import { getCurrentUser, setCurrentUser } from "../lumina-commerce/currentUser.js";
import { ensureE2EClassroomFixtureAsset } from "../lumina-commerce/teacherAssetsStore.js";
import { E2E_FIXTURE_DEMO_STUDENT_USER_ID } from "../lumina-commerce/e2eClassroomFixture.js";
import { listActiveEntitlementsForUser } from "../lumina-commerce/entitlementService.js";
import { ENTITLEMENT_SOURCE_TYPE, PRICING_TYPE, USER_ROLE } from "../lumina-commerce/enums.js";
import { getListingPricingType } from "../lumina-commerce/teacherCommerceBridge.js";
import { safeUiText, formatCommerceEnum } from "../lumina-commerce/commerceDisplayLabels.js";
import { i18n } from "../i18n.js";

function tx(k, p) {
  return safeUiText(k, p);
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default async function pageMyLearningContent(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  await initCommerceStore();
  ensureE2EClassroomFixtureAsset();
  const snap = getCommerceStoreSync();
  const u = getCurrentUser();
  if (!snap) {
    root.innerHTML = `<div class="wrap learner-my-page"><p>${escapeHtml(tx("common.loading"))}</p></div>`;
    return;
  }

  const all = listActiveEntitlementsForUser(snap.entitlements, u.id);
  const withListings = all
    .filter((e) => e.listing_id)
    .map((e) => {
      const L = snap.listings.find((l) => l.id === e.listing_id) || null;
      if (!L) return null;
      return { e, L };
    })
    .filter(Boolean);

  const tr = (withListings.length ? withListings : [])
    .map(({ e, L }) => {
      const pt = getListingPricingType(L);
      const how =
        e.source_type === ENTITLEMENT_SOURCE_TYPE.order
          ? tx("learner.commerce.via_purchase")
          : pt === PRICING_TYPE.free
            ? tx("learner.commerce.via_free")
            : tx("learner.commerce.via_purchase");
      const tname =
        L.teacher_id && snap.teacher_profiles.find((p) => p.id === L.teacher_id)?.display_name
          ? snap.teacher_profiles.find((p) => p.id === L.teacher_id).display_name
          : "—";
      const typeLab = formatCommerceEnum("listing_type", L.listing_type);
      const href = `#teacher-listing?id=${encodeURIComponent(L.id)}`;
      const classHref =
        L.source_kind === "classroom_asset" && L.source_id
          ? "#classroom?assetId=" + encodeURIComponent(String(L.source_id))
          : "#classroom";
      return `<tr>
        <td><a class="learner-my-link" href="${href}">${escapeHtml(L.title)}</a></td>
        <td>${escapeHtml(tname)}</td>
        <td>${escapeHtml(typeLab)}</td>
        <td>${escapeHtml(how)}</td>
        <td>${escapeHtml((e.created_at || "").replace("T", " ").slice(0, 16))}</td>
        <td><a class="learner-my-link" href="${classHref}">${escapeHtml(tx("learner.commerce.open_classroom"))}</a></td>
      </tr>`;
    })
    .join("");

  const e2eBtn =
    String(u.id) !== E2E_FIXTURE_DEMO_STUDENT_USER_ID || u.isGuest
      ? `<p class="learner-my-e2e-hint my-content-e2e-hint"><button type="button" class="lts0-btn lts0-btn--ghost" id="myContentE2eDemoStudent">${escapeHtml(
          tx("learner.my_content.e2e_apply_demo_student"),
        )}</button></p>`
      : "";
  const empty = withListings.length
    ? ""
    : `<p class="learner-my-empty my-content-empty">${escapeHtml(tx("learner.my_content.empty"))}</p>${e2eBtn}`;
  const table = withListings.length
    ? `<div class="learner-my-table-wrap"><table class="learner-my-table">
      <thead><tr>
        <th>${escapeHtml(tx("learner.my_content.col_title"))}</th>
        <th>${escapeHtml(tx("learner.my_content.col_teacher"))}</th>
        <th>${escapeHtml(tx("learner.my_content.col_type"))}</th>
        <th>${escapeHtml(tx("learner.my_content.col_how"))}</th>
        <th>${escapeHtml(tx("learner.my_content.col_time"))}</th>
        <th>${escapeHtml(tx("learner.my_content.col_action"))}</th>
      </tr></thead>
      <tbody>${tr}</tbody>
    </table></div>`
    : "";

  root.innerHTML = `<div class="wrap learner-my-page">
    <header class="card learner-my-hero">
      <h1 class="learner-my-title">${escapeHtml(tx("learner.nav.my_content"))}</h1>
      <p class="learner-my-lead">${escapeHtml(tx("learner.my_content.lead"))}</p>
    </header>
    <section class="card learner-my-section">${empty}${table}</section>
  </div>`;
  root.querySelector("#myContentE2eDemoStudent")?.addEventListener("click", () => {
    setCurrentUser({
      id: E2E_FIXTURE_DEMO_STUDENT_USER_ID,
      name: "示例学生 A",
      roles: [USER_ROLE.student],
      teacherProfileId: null,
      isGuest: false,
    });
    try {
      sessionStorage.setItem("joy_return_hash_after_login", "#my-content");
    } catch {
      /* */
    }
    location.hash = "#my-content";
  });
  i18n.apply?.(root);
}

export function mount(c) {
  return pageMyLearningContent(c);
}
export function render(c) {
  return pageMyLearningContent(c);
}
