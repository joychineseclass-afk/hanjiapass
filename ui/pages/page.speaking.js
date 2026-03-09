// /ui/pages/page.speaking.js
// ✅ Speaking 课程域主页 — 统一平台风格
// ✅ 全部文案走 i18n，支持 KR/CN/EN/JP
// ✅ 语言切换后完整 rerender

import { i18n } from "../i18n.js";

const STYLE_ID = "lumina-speaking-style";
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
    .lumina-speaking{ background: var(--soft,#f8fafc); color: var(--text,#0f172a); }
    .lumina-speaking .wrap{ max-width: var(--max,1120px); margin:0 auto; padding:0 16px; }
    .lumina-speaking .section{ padding:10px 0 18px; }
    .lumina-speaking .card{ background:rgba(255,255,255,.72); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.45); border-radius:calc(var(--radius,18px) + 8px); box-shadow:0 20px 50px rgba(0,0,0,.08); overflow:hidden; }
    .lumina-speaking .inner{ padding:18px; display:grid; gap:12px; }
    .lumina-speaking .page-title{ margin:0; font-size:24px; font-weight:900; }
    .lumina-speaking .page-desc{ margin:0; color:var(--muted,#475569); font-size:15px; line-height:1.6; }
  `;
  document.head.appendChild(style);
}

function renderSpeaking(root) {
  ensureStyles();
  const title = t("speaking.title", "Speaking");
  const subtitle = t("speaking.subtitle", "Real-world speaking practice");
  const comingSoon = t("speaking.comingSoon", "Coming soon");

  root.innerHTML = `
    <div class="lumina-speaking">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <h1 class="page-title">${escapeHtml(title)}</h1>
              <p class="page-desc">${escapeHtml(subtitle)}. ${escapeHtml(comingSoon)}</p>
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
    renderSpeaking(el);
  };
  window.addEventListener("joy:langChanged", rerender);
  try { i18n?.on?.("change", rerender); } catch {}
  try { i18n?.onChange?.(rerender); } catch {}
}

export default function pageSpeaking(ctxOrRoot) {
  const root = ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;
  bindLiveRerender(root);
  renderSpeaking(root);
}

export function mount(ctxOrRoot) { return pageSpeaking(ctxOrRoot); }
export function render(ctxOrRoot) { return pageSpeaking(ctxOrRoot); }
