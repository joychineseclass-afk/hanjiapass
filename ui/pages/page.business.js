// /ui/pages/page.business.js
// ✅ Business 课程域主页 — 统一平台风格，专业清晰
// ✅ 全部文案走 i18n，支持 KR/CN/EN/JP
// ✅ 语言切换后完整 rerender

import { i18n } from "../i18n.js";

const STYLE_ID = "lumina-business-style";
let _bound = false;

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    if (v == null) return fallback;
    const s = String(v).trim();
    if (!s || s === key || s === `[${key}]`) return fallback;
    return s;
  } catch {
    return fallback;
  }
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .lumina-business{ background: var(--soft,#f8fafc); color: var(--text,#0f172a); }
    .lumina-business .wrap{ max-width: var(--max,1120px); margin:0 auto; padding:0 16px; }
    .lumina-business .section{ padding:10px 0 18px; }
    .lumina-business .card{ background:rgba(255,255,255,.92); backdrop-filter:blur(14px); border:1px solid rgba(226,232,240,.9); border-radius:calc(var(--radius,18px) + 8px); box-shadow:0 20px 50px rgba(0,0,0,.06); overflow:hidden; }
    .lumina-business .inner{ padding:18px; display:grid; gap:12px; }
    .lumina-business .page-title{ margin:0; font-size:24px; font-weight:900; letter-spacing:-0.3px; }
    .lumina-business .page-desc{ margin:0; color:var(--muted,#475569); font-size:15px; line-height:1.6; }
    .lumina-business .section-title{ margin:0; font-size:16px; font-weight:800; }
    .lumina-business .card-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
    .lumina-business .course-card{ padding:16px; border:1px solid rgba(14,165,233,.15); border-radius:14px; background:#fff; transition:transform .15s, box-shadow .15s; }
    .lumina-business .course-card:hover{ transform:translateY(-2px); box-shadow:0 8px 24px rgba(14,165,233,.12); }
    .lumina-business .course-card .card-title{ font-weight:800; font-size:15px; margin-bottom:4px; }
    .lumina-business .course-card .card-desc{ font-size:13px; color:var(--muted,#475569); }
    .lumina-business .badge{ font-size:12px; font-weight:800; color:#0ea5e9; background:rgba(14,165,233,.1); border:1px solid rgba(14,165,233,.2); padding:6px 10px; border-radius:999px; width:fit-content; }
  `;
  document.head.appendChild(style);
}

function renderBusiness(root) {
  ensureStyles();
  const title = t("business.title", "Business Chinese");
  const subtitle = t("business.subtitle", "Practical Chinese for the workplace");
  const comingSoon = t("business.comingSoon", "Coming soon");
  const conversation = t("business.conversation", "Business conversation");
  const email = t("business.email", "Business email");
  const meeting = t("business.meeting", "Meeting expressions");
  const phone = t("business.phone", "Phone expressions");
  const reception = t("business.reception", "Reception expressions");
  const roleplay = t("business.roleplay", "Role play");

  root.innerHTML = `
    <div class="lumina-business">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <span class="badge">${escapeHtml(t("nav.business", "Business"))}</span>
              <h1 class="page-title">${escapeHtml(title)}</h1>
              <p class="page-desc">${escapeHtml(subtitle)}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <h2 class="section-title">${escapeHtml(t("business.start", "Course entries"))}</h2>
          <div class="card-grid">
            <div class="course-card">
              <div class="card-title">${escapeHtml(conversation)}</div>
              <div class="card-desc">${escapeHtml(comingSoon)}</div>
            </div>
            <div class="course-card">
              <div class="card-title">${escapeHtml(email)}</div>
              <div class="card-desc">${escapeHtml(comingSoon)}</div>
            </div>
            <div class="course-card">
              <div class="card-title">${escapeHtml(meeting)}</div>
              <div class="card-desc">${escapeHtml(comingSoon)}</div>
            </div>
            <div class="course-card">
              <div class="card-title">${escapeHtml(phone)}</div>
              <div class="card-desc">${escapeHtml(comingSoon)}</div>
            </div>
            <div class="course-card">
              <div class="card-title">${escapeHtml(reception)}</div>
              <div class="card-desc">${escapeHtml(comingSoon)}</div>
            </div>
            <div class="course-card">
              <div class="card-title">${escapeHtml(roleplay)}</div>
              <div class="card-desc">${escapeHtml(comingSoon)}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
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
    renderBusiness(el);
  };
  window.addEventListener("joy:langChanged", rerender);
  try { i18n?.on?.("change", rerender); } catch {}
  try { i18n?.onChange?.(rerender); } catch {}
  window.addEventListener("storage", (e) => {
    if (e.key === "joy_lang" || e.key === "site_lang") rerender();
  });
}

export default function pageBusiness(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;
  bindLiveRerender(root);
  renderBusiness(root);
}

export function mount(ctxOrRoot) { return pageBusiness(ctxOrRoot); }
export function render(ctxOrRoot) { return pageBusiness(ctxOrRoot); }
