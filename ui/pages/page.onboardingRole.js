// #onboarding-role 注册后方向选择

import { i18n } from "../i18n.js";
import { getCurrentSessionAuthUser, markOnboardingCompletedStudentPath } from "../auth/authService.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { consumePendingPostAuthTargetHash, clearPendingPostAuthTargetHash } from "../auth/postAuthRedirect.js";

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

export default async function pageOnboardingRole(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;

  if (!getCurrentSessionAuthUser()) {
    const { navigateTo } = await import("../router.js");
    navigateTo("#auth-login", { force: true });
    return;
  }
  const { findUserById } = await import("../auth/authStore.js");
  const u0 = getCurrentSessionAuthUser();
  if (u0) {
    const full = findUserById(u0.id);
    if (full && full.onboardingCompleted !== false) {
      const { navigateTo } = await import("../router.js");
      navigateTo("#my-learning", { force: true });
      return;
    }
  }

  root.innerHTML = `
    <div class="wrap auth-page lumina-onboarding">
      <header class="lumina-onboarding__head">
        <h1 class="auth-title">${escapeHtml(tx("onboarding.welcome_title"))}</h1>
        <p class="auth-lead">${escapeHtml(tx("onboarding.how_title"))}</p>
      </header>
      <div class="lumina-onboarding__grid">
        <section class="card lumina-onboarding__card">
          <h2 class="lumina-onboarding__card-title">${escapeHtml(tx("onboarding.card_learn_title"))}</h2>
          <p class="lumina-onboarding__card-desc">${escapeHtml(tx("onboarding.card_learn_desc"))}</p>
          <button type="button" class="auth-submit" id="onbLearnBtn">${escapeHtml(tx("onboarding.cta_learn"))}</button>
        </section>
        <section class="card lumina-onboarding__card">
          <h2 class="lumina-onboarding__card-title">${escapeHtml(tx("onboarding.card_teach_title"))}</h2>
          <p class="lumina-onboarding__card-desc">${escapeHtml(tx("onboarding.card_teach_desc"))}</p>
          <p class="lumina-onboarding__hint">${escapeHtml(tx("onboarding.hint_teach"))}</p>
          <button type="button" class="auth-submit auth-submit--secondary" id="onbTeachBtn">${escapeHtml(tx("onboarding.cta_teach"))}</button>
        </section>
      </div>
    </div>
  `;
  i18n.apply?.(root);

  root.querySelector("#onbLearnBtn")?.addEventListener("click", async () => {
    const r = await markOnboardingCompletedStudentPath();
    if (!r?.ok) return;
    const { navigateTo } = await import("../router.js");
    navigateTo(consumePendingPostAuthTargetHash() || "#my-learning", { force: true });
  });
  root.querySelector("#onbTeachBtn")?.addEventListener("click", async () => {
    clearPendingPostAuthTargetHash();
    const { navigateTo } = await import("../router.js");
    navigateTo("#teacher-apply", { force: true });
  });
}

export function mount(c) {
  return pageOnboardingRole(c);
}
export function render(c) {
  return pageOnboardingRole(c);
}
