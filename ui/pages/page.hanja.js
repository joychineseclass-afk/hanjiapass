// ui/pages/page.hanja.js — 汉字学习：左侧二级导航 + 右侧说明（#hanja?tab=…）
import { i18n } from "../i18n.js";
import {
  HANJA_SECTION_IDS,
  parseHashSectionId,
  hanjaSectionContentKeys,
} from "../components/sideSectionNav.js";

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

const BASE = "#hanja";
const TAB_PARAM = "tab";
const DEFAULT_ID = "basic3000";
const ALLOWED = new Set(HANJA_SECTION_IDS);

/** @param {'basic3000'|'oracle'|'korean-test'} id */
const NAV_LABEL_KEY = (id) => {
  if (id === "basic3000") return "hanja.nav.basic3000";
  if (id === "oracle") return "hanja.nav.oracle";
  return "hanja.nav.koreanTest";
};

function currentSectionId() {
  return /** @type {'basic3000'|'oracle'|'korean-test'} */ (
    parseHashSectionId(BASE, TAB_PARAM, DEFAULT_ID, ALLOWED)
  );
}

function navItemClass(id, active) {
  const base = "section-side-nav-item level-2";
  return active ? `${base} is-active` : base;
}

function renderRightPanelMarkup(sectionId) {
  const keys = hanjaSectionContentKeys(sectionId);
  return `
    <h2 class="title" data-hanja-panel="title" data-i18n="${esc(keys.titleKey)}">${esc(t(keys.titleKey))}</h2>
    <p class="desc" data-hanja-panel="desc" data-i18n="${esc(keys.descKey)}">${esc(t(keys.descKey))}</p>
  `;
}

function updatePanel(root, sectionId) {
  const inner = root.querySelector("[data-hanja-panel-inner]");
  if (!inner) return;
  inner.innerHTML = renderRightPanelMarkup(sectionId);
  i18n.apply?.(inner);
}

function updateNavActive(root, sectionId) {
  root.querySelectorAll("[data-hanja-nav]").forEach((el) => {
    const id = el.getAttribute("data-hanja-nav");
    const on = id === sectionId;
    el.classList.toggle("is-active", on);
    if (el instanceof HTMLButtonElement) el.setAttribute("aria-current", on ? "true" : "false");
  });
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

  const sectionId = currentSectionId();
  const sideNavTitle = t("hanja.side_nav_label");
  const sideNavTitleKey = "hanja.side_nav_label";

  const navButtons = HANJA_SECTION_IDS.map((id) => {
    const lbl = NAV_LABEL_KEY(id);
    return `<button type="button" class="${navItemClass(id, id === sectionId)}" data-hanja-nav="${id}" data-i18n="${esc(
      lbl
    )}" aria-current="${id === sectionId ? "true" : "false"}">${esc(t(lbl))}</button>`;
  }).join("");

  app.innerHTML = `
    <div class="hanja-page wrap" style="max-width:var(--max,1120px);margin:0 auto;padding:12px 16px 24px">
      <header class="card" style="padding:16px 18px;margin-bottom:12px;box-shadow:0 8px 24px rgba(15,23,42,.07)">
        <h1 class="title" style="font-size:1.35rem;margin:0 0 8px" data-i18n="hanja.title">${esc(t("hanja.title"))}</h1>
        <p class="desc" style="margin:0;color:var(--muted,#475569);line-height:1.6" data-i18n="hanja.lead">${esc(
          t("hanja.lead")
        )}</p>
      </header>
      <div class="page-shell page-shell--resource">
        <aside class="section-side-nav" aria-label="${esc(sideNavTitle)}">
          <p class="section-side-nav__title" data-i18n="${esc(sideNavTitleKey)}">${esc(sideNavTitle)}</p>
          <nav class="section-side-nav-inner" data-hanja-side-nav>
            ${navButtons}
          </nav>
        </aside>
        <main class="section-main-panel">
          <div class="section-main-panel-inner" data-hanja-panel>
            <div data-hanja-panel-inner>
              ${renderRightPanelMarkup(sectionId)}
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  i18n.apply?.(app);

  const onNavClick = (e) => {
    const btn = e.target?.closest?.("[data-hanja-nav]");
    if (!btn) return;
    const id = btn.getAttribute("data-hanja-nav");
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
  app.querySelector("[data-hanja-side-nav]")?.addEventListener("click", onNavClick);

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
  window.addEventListener("joy:lang", onLang);
  window.addEventListener("i18n:changed", onLang);
  try {
    i18n?.on?.("change", onLang);
  } catch {
    /* */
  }

  _teardown = () => {
    app.querySelector("[data-hanja-side-nav]")?.removeEventListener("click", onNavClick);
    window.removeEventListener("hashchange", onHash);
    window.removeEventListener("joy:langChanged", onLang);
    window.removeEventListener("joy:lang", onLang);
    window.removeEventListener("i18n:changed", onLang);
    try {
      i18n?.off?.("change", onLang);
    } catch {
      /* */
    }
  };
}

export default { mount, unmount };
