// #auth-login 统一登录

import { i18n } from "../i18n.js";
import { loginUser } from "../auth/authService.js";
import { getResolvedSessionLandingHash } from "../auth/resolveSessionRoute.js";
import { consumePendingPostAuthTargetHash } from "../auth/postAuthRedirect.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";

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

export default async function pageAuthLogin(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;

  const { getCurrentSessionAuthUser } = await import("../auth/authService.js");
  if (getCurrentSessionAuthUser()) {
    const { navigateTo } = await import("../router.js");
    navigateTo(getResolvedSessionLandingHash(), { force: true });
    return;
  }

  root.innerHTML = `
    <div class="wrap auth-page">
      <section class="card auth-card">
        <h1 class="auth-title">${escapeHtml(tx("auth.login_title"))}</h1>
        <p class="auth-lead">${escapeHtml(tx("auth.login_lead_unified"))}</p>
        <form class="auth-form" id="authLoginForm">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.account"))}</span>
            <input name="account" type="text" required autocomplete="username" placeholder="${escapeHtml(tx("auth.account_placeholder"))}" />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.password"))}</span>
            <input name="password" type="password" required autocomplete="current-password" placeholder="${escapeHtml(tx("auth.password_placeholder"))}" />
          </label>
          <p class="auth-error" id="authLoginErr" hidden></p>
          <button type="submit" class="auth-submit">${escapeHtml(tx("auth.login_cta"))}</button>
        </form>
        <p class="auth-footer">
          <a href="#auth-register" class="auth-link">${escapeHtml(tx("auth.go_register"))}</a>
        </p>
      </section>
    </div>
  `;
  i18n.apply?.(root);

  const form = root.querySelector("#authLoginForm");
  const errEl = root.querySelector("#authLoginErr");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errEl) errEl.hidden = true;
    const fd = new FormData(/** @type {HTMLFormElement} */ (e.target));
    const res = await loginUser({
      account: String(fd.get("account") || ""),
      password: String(fd.get("password") || ""),
    });
    if (!res.ok) {
      const key = `auth.error.${res.code}`;
      const msg = tx(key) !== key ? tx(key) : tx("auth.error.unknown");
      if (errEl) {
        errEl.textContent = msg;
        errEl.hidden = false;
      }
      return;
    }
    const { navigateTo } = await import("../router.js");
    const land = getResolvedSessionLandingHash();
    if (land === "#onboarding-role") {
      navigateTo("#onboarding-role", { force: true });
    } else {
      navigateTo(consumePendingPostAuthTargetHash() || land, { force: true });
    }
  });
}

export function mount(c) {
  return pageAuthLogin(c);
}
export function render(c) {
  return pageAuthLogin(c);
}
