// /ui/pages/page.culture.js — 文化学习：左侧分类导航 + 右侧内容（与资料页 .page-shell 一致）
import { i18n } from "../i18n.js";
import {
  CULTURE_SECTION_IDS,
  parseHashSectionId,
  cultureSectionContentKeys,
} from "../components/sideSectionNav.js";

const STYLE_ID = "lumina-culture-shell";

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

const BASE = "#culture";
const TAB_PARAM = "tab";
const DEFAULT_ID = "idioms";
const ALLOWED = new Set(CULTURE_SECTION_IDS);

/**
 * @returns {'idioms'|'proverbs'|'festivals'|'etiquette'|'figures'|'expressions'}
 */
function currentSectionId() {
  return /** @type {'idioms'|'proverbs'|'festivals'|'etiquette'|'figures'|'expressions'} */ (
    parseHashSectionId(BASE, TAB_PARAM, DEFAULT_ID, ALLOWED)
  );
}

function navItemClass(id, active) {
  const base = "section-side-nav-item level-2";
  return active ? `${base} is-active` : base;
}

function renderRightPanelMarkup(sectionId) {
  const keys = cultureSectionContentKeys(sectionId);
  return `
    <h2 class="title" data-i18n="${esc(keys.titleKey)}">${esc(t(keys.titleKey))}</h2>
    <p class="desc" data-i18n="${esc(keys.descKey)}">${esc(t(keys.descKey))}</p>
    <p class="desc" style="margin-top:14px;opacity:0.88;font-size:14px" data-i18n="culture.comingSoon">${esc(t("culture.comingSoon"))}</p>
  `;
}

function updatePanel(root, sectionId) {
  const inner = root.querySelector("[data-culture-panel-inner]");
  if (!inner) return;
  inner.innerHTML = renderRightPanelMarkup(sectionId);
  i18n.apply?.(inner);
}

function updateNavActive(root, sectionId) {
  root.querySelectorAll("[data-culture-nav]").forEach((el) => {
    const id = el.getAttribute("data-culture-nav");
    const on = id === sectionId;
    el.classList.toggle("is-active", on);
    if (el instanceof HTMLButtonElement) el.setAttribute("aria-current", on ? "true" : "false");
  });
}

function ensureShellBgStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .lumina-culture{background:var(--soft,#f8fafc);min-height:50vh}
  `;
  document.head.appendChild(style);
}

let _teardown = null;

export function unmount() {
  try {
    _teardown?.();
  } catch {
    /* */
  }
  _teardown = null;
}

export function mount() {
  unmount();
  const app = document.getElementById("app");
  if (!app) return;
  ensureShellBgStyle();

  const sectionId = currentSectionId();
  const sideNavTitle = t("culture.side_nav_label");
  const sideNavTitleKey = "culture.side_nav_label";

  const navButtons = CULTURE_SECTION_IDS.map((id) => {
    const navKey = `culture.nav.${id}`;
    return `<button type="button" class="${navItemClass(id, id === sectionId)}" data-culture-nav="${id}" data-i18n="${esc(navKey)}" aria-current="${id === sectionId ? "true" : "false"}">${esc(t(navKey))}</button>`;
  }).join("");

  app.innerHTML = `
    <div class="lumina-culture resource-library wrap" style="max-width:var(--max,1120px);margin:0 auto;padding:12px 16px 24px">
      <header class="card" style="padding:16px 18px;margin-bottom:12px; box-shadow:0 8px 24px rgba(15,23,42,.07)">
        <h1 class="title" style="font-size:1.35rem;margin:0 0 8px" data-i18n="culture.title">${esc(t("culture.title"))}</h1>
        <p class="desc" style="margin:0;color:var(--muted,#475569);line-height:1.6" data-i18n="culture.subtitle">${esc(t("culture.subtitle"))}</p>
      </header>
      <div class="page-shell page-shell--resource">
        <aside class="section-side-nav" aria-label="${esc(sideNavTitle)}">
          <p class="section-side-nav__title" data-i18n="${esc(sideNavTitleKey)}">${esc(sideNavTitle)}</p>
          <nav class="section-side-nav-inner" data-culture-side-nav>
            ${navButtons}
          </nav>
        </aside>
        <main class="section-main-panel">
          <div class="section-main-panel-inner" data-culture-panel>
            <div data-culture-panel-inner>
              ${renderRightPanelMarkup(sectionId)}
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  i18n.apply?.(app);

  const onNavClick = (e) => {
    const btn = e.target?.closest?.("[data-culture-nav]");
    if (!btn) return;
    const id = btn.getAttribute("data-culture-nav");
    if (!id || !ALLOWED.has(id) || id === currentSectionId()) return;
    import("../router.js")
      .then((r) => {
        r.navigateTo(`${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`, { force: true });
      })
      .catch(() => {
        if (typeof location !== "undefined") {
          location.hash = `${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`;
        }
      });
  };
  app.querySelector("[data-culture-side-nav]")?.addEventListener("click", onNavClick);

  const onHash = () => {
    if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
    const next = currentSectionId();
    updateNavActive(app, next);
    updatePanel(app, next);
  };
  window.addEventListener("hashchange", onHash);

  const onLang = () => {
    i18n.apply?.(app);
    updatePanel(app, currentSectionId());
  };
  window.addEventListener("joy:langChanged", onLang);
  try {
    i18n?.on?.("change", onLang);
  } catch {
    /* */
  }

  _teardown = () => {
    app.querySelector("[data-culture-side-nav]")?.removeEventListener("click", onNavClick);
    window.removeEventListener("hashchange", onHash);
    window.removeEventListener("joy:langChanged", onLang);
    try {
      i18n?.off?.("change", onLang);
    } catch {
      /* */
    }
  };
}

export default { mount, unmount };
export function render(ctxOrRoot) {
  return mount();
}
