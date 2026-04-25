// /ui/pages/page.resources.js — 资料库 / 资源市场（不含学习模块入口）
import { i18n } from "../i18n.js";
import { demoBannerHtml } from "../components/demoBanner.js";

function t(key) {
  try {
    const v = i18n?.t?.(key);
    if (v == null) return key;
    const s = String(v).trim();
    if (!s || s === key) return key;
    return s;
  } catch {
    return key;
  }
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cardBlock(titleKey, descKey) {
  return `
    <div class="card" style="padding:16px 18px; margin:0; height:100%; display:flex; flex-direction:column; justify-content:flex-start; box-shadow:0 8px 24px rgba(15,23,42,.07)">
      <h2 class="title" style="font-size:1.05rem; margin:0 0 8px" data-i18n="${esc(titleKey)}">${esc(t(titleKey))}</h2>
      <p class="desc" style="margin:0; color:var(--muted,#475569); line-height:1.65; font-size:14px" data-i18n="${esc(descKey)}">${esc(t(descKey))}</p>
    </div>`;
}

function ensureResourceGridCss() {
  if (document.getElementById("lumina-resources-grid-mq")) return;
  const style = document.createElement("style");
  style.id = "lumina-resources-grid-mq";
  style.textContent = `
    @media (max-width: 700px) {
      .resource-library .resources-market-grid {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export function mount() {
  ensureResourceGridCss();
  const app = document.getElementById("app");
  if (!app) return;

  const title = t("resources.title");
  const sub = t("resources.subtitle");

  app.innerHTML = `
    <div class="resource-library wrap" style="max-width:var(--max,1120px);margin:0 auto;padding:12px 16px 24px">
      ${demoBannerHtml("resources")}
      <header class="card" style="padding:16px 18px;margin-bottom:12px; box-shadow:0 8px 24px rgba(15,23,42,.07)">
        <h1 class="title" style="font-size:1.35rem;margin:0 0 8px" data-i18n="resources.title">${esc(title)}</h1>
        <p class="desc" style="margin:0;color:var(--muted,#475569);line-height:1.6" data-i18n="resources.subtitle">${esc(sub)}</p>
      </header>
      <div
        class="resources-market-grid"
        style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch"
      >
        <div style="min-width:0">${cardBlock("resources.free.title", "resources.free.desc")}</div>
        <div style="min-width:0">${cardBlock("resources.paid.title", "resources.paid.desc")}</div>
        <div style="min-width:0">${cardBlock("resources.official.title", "resources.official.desc")}</div>
        <div style="min-width:0">${cardBlock("resources.teacherShared.title", "resources.teacherShared.desc")}</div>
      </div>
    </div>
  `;

  i18n.apply?.(app);
}
