// #auth-register 统一注册

import { i18n } from "../i18n.js";
import { registerAndLogin } from "../auth/authService.js";
import { getResolvedHashAfterRegisterSuccess } from "../auth/resolveSessionRoute.js";
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

export default async function pageAuthRegister(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;

  const { getCurrentSessionAuthUser } = await import("../auth/authService.js");
  if (getCurrentSessionAuthUser()) {
    const { navigateTo } = await import("../router.js");
    const { getDefaultPostAuthTargetHash: land } = await import("../auth/authService.js");
    navigateTo(land(), { force: true });
    return;
  }

  root.innerHTML = `
    <div class="wrap auth-page">
      <section class="card auth-card">
        <h1 class="auth-title">${escapeHtml(tx("auth.register_title_unified"))}</h1>
        <p class="auth-lead">${escapeHtml(tx("auth.register_lead_unified"))}</p>
        <form class="auth-form" id="authRegForm">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.account"))}</span>
            <input name="account" type="text" required autocomplete="username" placeholder="${escapeHtml(tx("auth.account_placeholder"))}" />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.nickname_optional"))}</span>
            <input name="name" type="text" autocomplete="nickname" placeholder="${escapeHtml(tx("auth.nickname_placeholder"))}" />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.password"))}</span>
            <input name="password" type="password" required minlength="4" autocomplete="new-password" />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.password_confirm"))}</span>
            <input name="password2" type="password" required minlength="4" autocomplete="new-password" />
          </label>
          <label class="auth-field auth-field--check">
            <input name="terms" type="checkbox" value="1" required />
            <span class="auth-label-inline">${escapeHtml(tx("auth.terms_agree"))}</span>
          </label>
          <p class="auth-error" id="authRegErr" hidden></p>
          <button type="submit" class="auth-submit">${escapeHtml(tx("auth.register_cta"))}</button>
        </form>
        <p class="auth-footer">
          <a href="#auth-login" class="auth-link">${escapeHtml(tx("auth.go_login"))}</a>
        </p>
      </section>
    </div>
  `;
  i18n.apply?.(root);

  const form = root.querySelector("#authRegForm");
  const errEl = root.querySelector("#authRegErr");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errEl) errEl.hidden = true;
    const fd = new FormData(/** @type {HTMLFormElement} */ (e.target));
    const pw = String(fd.get("password") || "");
    const pw2 = String(fd.get("password2") || "");
    if (pw !== pw2) {
      if (errEl) {
        errEl.textContent = tx("auth.error.password_mismatch");
        errEl.hidden = false;
      }
      return;
    }
    const res = await registerAndLogin({
      name: String(fd.get("name") || ""),
      account: String(fd.get("account") || ""),
      email: String(fd.get("account") || ""),
      password: pw,
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
    navigateTo(getResolvedHashAfterRegisterSuccess(), { force: true });
  });
}

export function mount(c) {
  return pageAuthRegister(c);
}
export function render(c) {
  return pageAuthRegister(c);
}
