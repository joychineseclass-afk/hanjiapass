// /ui/pages/page.resources.js — 资料库：左侧分类导航 + 右侧内容（全站 .page-shell 规范）
import { i18n } from "../i18n.js";
import {
  RESOURCE_SECTION_IDS,
  parseHashSectionId,
  resourceSectionContentKeys,
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

const BASE = "#resources";
const TAB_PARAM = "tab";
const DEFAULT_ID = "free";
const ALLOWED = new Set(RESOURCE_SECTION_IDS);

/** @type {{ title: string, desc: string }} */
const NAV_LABEL_KEYS = {
  free: { title: "resources.free.title", desc: "resources.free.desc" },
  paid: { title: "resources.paid.title", desc: "resources.paid.desc" },
  official: { title: "resources.official.title", desc: "resources.official.desc" },
  teacher: { title: "resources.teacherShared.title", desc: "resources.teacherShared.desc" },
};

function currentSectionId() {
  return /** @type {'free'|'paid'|'official'|'teacher'} */ (
    parseHashSectionId(BASE, TAB_PARAM, DEFAULT_ID, ALLOWED)
  );
}

function navItemClass(id, active) {
  const base = "section-side-nav-item level-2";
  return active ? `${base} is-active` : base;
}

function renderRightPanelMarkup(sectionId) {
  const keys = resourceSectionContentKeys(sectionId);
  return `
    <h2 class="title" data-resource-panel="title" data-i18n="${esc(keys.titleKey)}">${esc(t(keys.titleKey))}</h2>
    <p class="desc" data-resource-panel="desc" data-i18n="${esc(keys.descKey)}">${esc(t(keys.descKey))}</p>
  `;
}

function updatePanel(root, sectionId) {
  const inner = root.querySelector("[data-resource-panel-inner]");
  if (!inner) return;
  inner.innerHTML = renderRightPanelMarkup(sectionId);
  i18n.apply?.(inner);
}

function updateNavActive(root, sectionId) {
  root.querySelectorAll("[data-resource-nav]").forEach((el) => {
    const id = el.getAttribute("data-resource-nav");
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
  const sideNavTitle = t("resources.side_nav_label");
  const sideNavTitleKey = "resources.side_nav_label";

  const navButtons = RESOURCE_SECTION_IDS.map((id) => {
    const lbl = NAV_LABEL_KEYS[id].title;
    return `<button type="button" class="${navItemClass(id, id === sectionId)}" data-resource-nav="${id}" data-i18n="${esc(lbl)}" aria-current="${id === sectionId ? "true" : "false"}">${esc(t(lbl))}</button>`;
  }).join("");

  app.innerHTML = `
    <div class="resource-library wrap" style="max-width:var(--max,1120px);margin:0 auto;padding:12px 16px 24px">
      <div class="page-shell page-shell--resource">
        <aside class="section-side-nav" aria-label="${esc(sideNavTitle)}">
          <p class="section-side-nav__title" data-i18n="${esc(sideNavTitleKey)}">${esc(sideNavTitle)}</p>
          <nav class="section-side-nav-inner" data-resource-side-nav>
            ${navButtons}
          </nav>
        </aside>
        <main class="section-main-panel">
          <div class="section-main-panel-inner" data-resource-panel>
            <div data-resource-panel-inner>
              ${renderRightPanelMarkup(sectionId)}
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  i18n.apply?.(app);

  const onNavClick = (e) => {
    const btn = e.target?.closest?.("[data-resource-nav]");
    if (!btn) return;
    const id = btn.getAttribute("data-resource-nav");
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
  app.querySelector("[data-resource-side-nav]")?.addEventListener("click", onNavClick);

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
    app.querySelector("[data-resource-side-nav]")?.removeEventListener("click", onNavClick);
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
