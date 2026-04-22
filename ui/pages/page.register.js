// #register 最小注册页

import { i18n } from "../i18n.js";
import { registerAndLogin } from "../auth/authService.js";
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
  if (q < 0) return "#my";
  const sp = new URLSearchParams(h.slice(q + 1));
  const n = sp.get("next");
  if (!n) return "#my";
  const s = String(n);
  if (s.startsWith("#")) return s;
  return `#${s}`;
}

export default async function pageRegister(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="wrap auth-page">
      <section class="card auth-card">
        <h1 class="auth-title">${escapeHtml(tx("auth.register_title"))}</h1>
        <p class="auth-lead">${escapeHtml(tx("auth.register_lead"))}</p>
        <form class="auth-form" id="authRegForm">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.name"))}</span>
            <input name="name" type="text" required autocomplete="name" />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.email"))}</span>
            <input name="email" type="email" required autocomplete="email" />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("auth.password"))}</span>
            <input name="password" type="password" required minlength="4" autocomplete="new-password" />
          </label>
          <p class="auth-error" id="authRegErr" hidden></p>
          <button type="submit" class="auth-submit">${escapeHtml(tx("auth.register_cta"))}</button>
        </form>
        <p class="auth-footer">
          <a href="#login" class="auth-link">${escapeHtml(tx("auth.go_login"))}</a>
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
    const res = await registerAndLogin({
      name: String(fd.get("name") || ""),
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
  return pageRegister(c);
}
export function render(c) {
  return pageRegister(c);
}
