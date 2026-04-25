// /ui/pages/page.culture.js
// ✅ Culture 课程域主页 — 统一平台风格
// ✅ 全部文案走 i18n，支持 KR/CN/EN/JP
// ✅ 语言切换后完整 rerender

import { i18n } from "../i18n.js";

const STYLE_ID = "lumina-culture-style";
let _bound = false;

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    if (v == null) return fallback;
    const s = String(v).trim();
    if (!s || s === key || s === `[${key}]`) return fallback;
    return s;
  } catch { return fallback; }
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .lumina-culture{ background: var(--soft,#f8fafc); color: var(--text,#0f172a); }
    .lumina-culture .wrap{ max-width: var(--max,1120px); margin:0 auto; padding:0 16px; }
    .lumina-culture .section{ padding:10px 0 18px; }
    .lumina-culture .card{ background:rgba(255,255,255,.72); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.45); border-radius:calc(var(--radius,18px) + 8px); box-shadow:0 20px 50px rgba(0,0,0,.08); overflow:hidden; }
    .lumina-culture .inner{ padding:18px; display:grid; gap:12px; }
    .lumina-culture .page-title{ margin:0; font-size:24px; font-weight:900; }
    .lumina-culture .page-desc{ margin:0; color:var(--muted,#475569); font-size:15px; line-height:1.6; }
  `;
  document.head.appendChild(style);
}

function renderCulture(root) {
  ensureStyles();
  const title = t("culture.title", "Culture");
  const subtitle = t("culture.subtitle", "Learn Chinese language and culture together.");
  const comingSoon = t("culture.comingSoon", "Coming soon");

  root.innerHTML = `
    <div class="lumina-culture">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <h1 class="page-title" data-i18n="culture.title">${escapeHtml(title)}</h1>
              <p class="page-desc" data-i18n="culture.subtitle">${escapeHtml(subtitle)}</p>
              <p class="page-desc" style="opacity:.85" data-i18n="culture.comingSoon">${escapeHtml(comingSoon)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
  try {
    i18n.apply?.(root);
  } catch {
    /* */
  }
}

function escapeHtml(s) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function bindLiveRerender(root) {
  if (_bound) return;
  _bound = true;
  const rerender = () => {
    const el = root?.isConnected ? root : document.getElementById("app");
    if (!el) return;
    renderCulture(el);
  };
  window.addEventListener("joy:langChanged", rerender);
  try { i18n?.on?.("change", rerender); } catch {}
  try { i18n?.onChange?.(rerender); } catch {}
}

export default function pageCulture(ctxOrRoot) {
  const root = ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;
  bindLiveRerender(root);
  renderCulture(root);
}

export function mount(ctxOrRoot) { return pageCulture(ctxOrRoot); }
export function render(ctxOrRoot) { return pageCulture(ctxOrRoot); }
