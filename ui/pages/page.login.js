// #login 最小登录页

import { i18n } from "../i18n.js";
import { loginUser } from "../auth/authService.js";
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

function returnHash() {
  const h = String(location.hash || "");
  const q = h.indexOf("?");
  if (q < 0) return "#teacher";
  const sp = new URLSearchParams(h.slice(q + 1));
  const n = sp.get("next");
  if (!n) return "#teacher";
  const s = String(n);
  if (s.startsWith("#")) return s;
  return `#${s}`;
}

export default async function pageLogin(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="wrap auth-page">
      <section class="card auth-card">
        <h1 class="auth-title">${escapeHtml(tx("auth.login_title"))}</h1>
        <p class="auth-lead">${escapeHtml(tx("auth.login_lead"))}</p>
        <form class="auth-form" id="authLoginForm">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.email"))}</span>
            <input name="email" type="email" required autocomplete="email" placeholder="${escapeHtml(tx("auth.email_placeholder"))}" />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.password"))}</span>
            <input name="password" type="password" required autocomplete="current-password" placeholder="${escapeHtml(tx("auth.password_placeholder"))}" />
          </label>
          <p class="auth-error" id="authLoginErr" hidden></p>
          <button type="submit" class="auth-submit">${escapeHtml(tx("auth.login_cta"))}</button>
        </form>
        <p class="auth-footer">
          <a href="#register" class="auth-link">${escapeHtml(tx("auth.go_register"))}</a>
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
      email: String(fd.get("email") || ""),
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
    navigateTo(returnHash(), { force: true });
  });
}

export function mount(c) {
  return pageLogin(c);
}
export function render(c) {
  return pageLogin(c);
}
