// ui/pages/page.hanja.js — 汉字学习：左侧二级/三级导航 + 右侧说明（#hanja?tab=…&level=…）
import { i18n } from "../i18n.js";
import {
  HANJA_SECTION_IDS,
  HANJA_BASIC3000_LEVEL_COUNTS,
  parseHashSectionId,
  parseHanjaLevel,
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
const LEVEL_PARAM = "level";
const DEFAULT_ID = "basic3000";
const ALLOWED = new Set(HANJA_SECTION_IDS);
const ALLOWED_LEVELS = new Set([1, 2, 3, 4, 5, 6]);

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

function currentLevel() {
  return parseHanjaLevel(BASE);
}

function navItemClass(id, active) {
  const base = "section-side-nav-item level-2";
  return active ? `${base} is-active` : base;
}

/**
 * 是否应将 hash 归一为带 tab=basic3000&level=1（#hanja 或 #hanja?tab=basic3000 无 level）
 */
function hanjaHashNeedsDefaultLevel() {
  const raw = String(typeof location !== "undefined" ? location.hash || "" : "");
  if (raw.split("?")[0].split("/")[0].toLowerCase() !== BASE) return false;
  const q = raw.indexOf("?");
  if (q < 0) return true;
  const sp = new URLSearchParams(raw.slice(q + 1));
  const tab = (sp.get("tab") || "basic3000").toLowerCase();
  if (tab !== "basic3000") return false;
  return !sp.has("level");
}

function buildSideNavMarkup(sectionId, level) {
  const chunks = [];
  for (const id of HANJA_SECTION_IDS) {
    const lbl = NAV_LABEL_KEY(id);
    chunks.push(
      `<button type="button" class="${navItemClass(id, id === sectionId)}" data-hanja-nav="${id}" data-i18n="${esc(
        lbl
      )}" aria-current="${id === sectionId ? "true" : "false"}">${esc(t(lbl))}</button>`
    );
    if (id === "basic3000") {
      const hiddenAttr = sectionId !== "basic3000" ? " hidden" : "";
      const levelBtns = [1, 2, 3, 4, 5, 6]
        .map((n) => {
          const k = `hanja.basic3000.level${n}`;
          const isOn = sectionId === "basic3000" && n === level;
          return `<button type="button" class="section-side-nav-item level-3 hanja-level-item${
            isOn ? " is-active" : ""
          }" data-hanja-level="${n}" data-i18n="${esc(k)}" aria-current="${isOn ? "true" : "false"}">${esc(t(k))}</button>`;
        })
        .join("");
      chunks.push(`<div class="hanja-level-subnav" data-hanja-level-wrap${hiddenAttr}>${levelBtns}</div>`);
    }
  }
  return chunks.join("");
}

function renderRightPanelMarkup(sectionId, level) {
  if (sectionId === "basic3000") {
    const lv = Math.min(6, Math.max(1, level));
    const titleKey = `hanja.basic3000.level${lv}Title`;
    const count = HANJA_BASIC3000_LEVEL_COUNTS[lv - 1];
    const descText = i18n.t("hanja.basic3000.levelDesc", { count });
    return `
      <h2 class="title" data-hanja-panel="title" data-i18n="${esc(titleKey)}">${esc(t(titleKey))}</h2>
      <p class="desc" data-hanja-panel="desc">${esc(descText)}</p>
    `;
  }
  const keys = hanjaSectionContentKeys(sectionId);
  return `
    <h2 class="title" data-hanja-panel="title" data-i18n="${esc(keys.titleKey)}">${esc(t(keys.titleKey))}</h2>
    <p class="desc" data-hanja-panel="desc" data-i18n="${esc(keys.descKey)}">${esc(t(keys.descKey))}</p>
  `;
}

function updatePanel(root, sectionId, level) {
  const inner = root.querySelector("[data-hanja-panel-inner]");
  if (!inner) return;
  inner.innerHTML = renderRightPanelMarkup(sectionId, level);
  i18n.apply?.(inner);
}

function syncFromHash(root) {
  if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
  const tab = currentSectionId();
  const level = currentLevel();
  const wrap = root.querySelector("[data-hanja-level-wrap]");
  if (wrap) {
    wrap.hidden = tab !== "basic3000";
  }
  root.querySelectorAll("[data-hanja-nav]").forEach((el) => {
    const id = el.getAttribute("data-hanja-nav");
    if (!id) return;
    const on = id === tab;
    el.classList.toggle("is-active", on);
    if (el instanceof HTMLButtonElement) el.setAttribute("aria-current", on ? "true" : "false");
  });
  root.querySelectorAll("[data-hanja-level]").forEach((el) => {
    const n = parseInt(String(el.getAttribute("data-hanja-level")), 10);
    const on = tab === "basic3000" && n === level;
    el.classList.toggle("is-active", on);
    if (el instanceof HTMLButtonElement) el.setAttribute("aria-current", on ? "true" : "false");
  });
  updatePanel(root, tab, level);
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

function normalizeHanjaHashIfNeeded() {
  if (!hanjaHashNeedsDefaultLevel()) return;
  import("../router.js")
    .then((r) => {
      r.navigateTo(`${BASE}?${TAB_PARAM}=${encodeURIComponent("basic3000")}&${LEVEL_PARAM}=1`, { force: true });
    })
    .catch(() => {
      if (typeof location !== "undefined") {
        location.hash = `${BASE}?${TAB_PARAM}=basic3000&${LEVEL_PARAM}=1`;
      }
    });
}

export function mount() {
  unmount();
  const app = document.getElementById("app");
  if (!app) return;

  const sectionId = currentSectionId();
  const level = currentLevel();
  const sideNavTitle = t("hanja.side_nav_label");
  const sideNavTitleKey = "hanja.side_nav_label";
  const navInner = buildSideNavMarkup(sectionId, level);

  app.innerHTML = `
    <div class="hanja-page wrap" style="max-width:var(--max,1120px);margin:0 auto;padding:12px 16px 24px">
      <div class="page-shell page-shell--resource">
        <aside class="section-side-nav" aria-label="${esc(sideNavTitle)}">
          <p class="section-side-nav__title" data-i18n="${esc(sideNavTitleKey)}">${esc(sideNavTitle)}</p>
          <nav class="section-side-nav-inner" data-hanja-side-nav>
            ${navInner}
          </nav>
        </aside>
        <main class="section-main-panel">
          <div class="section-main-panel-inner" data-hanja-panel>
            <div data-hanja-panel-inner>
              ${renderRightPanelMarkup(sectionId, level)}
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  i18n.apply?.(app);
  queueMicrotask(() => normalizeHanjaHashIfNeeded());

  const onClick = (e) => {
    const lvBtn = e.target?.closest?.("[data-hanja-level]");
    if (lvBtn) {
      const raw = lvBtn.getAttribute("data-hanja-level");
      const n = parseInt(String(raw), 10);
      if (!ALLOWED_LEVELS.has(n)) return;
      if (currentSectionId() === "basic3000" && n === currentLevel()) return;
      import("../router.js")
        .then((r) => {
          r.navigateTo(
            `${BASE}?${TAB_PARAM}=${encodeURIComponent("basic3000")}&${LEVEL_PARAM}=${encodeURIComponent(
              String(n)
            )}`,
            { force: true }
          );
        })
        .catch(() => {
          if (typeof location !== "undefined") {
            location.hash = `${BASE}?${TAB_PARAM}=basic3000&${LEVEL_PARAM}=${encodeURIComponent(String(n))}`;
          }
        });
      return;
    }
    const tabBtn = e.target?.closest?.("[data-hanja-nav]");
    if (!tabBtn) return;
    const id = /** @type {string|null} */ (tabBtn.getAttribute("data-hanja-nav"));
    if (!id || !ALLOWED.has(id)) return;
    if (id === "oracle" || id === "korean-test") {
      if (id === currentSectionId()) return;
      import("../router.js")
        .then((r) => {
          r.navigateTo(`${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`, { force: true });
        })
        .catch(() => {
          if (typeof location !== "undefined") {
            location.hash = `${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`;
          }
        });
      return;
    }
    if (id === "basic3000" && currentSectionId() === "basic3000" && currentLevel() === 1) return;
    import("../router.js")
      .then((r) => {
        r.navigateTo(`${BASE}?${TAB_PARAM}=basic3000&${LEVEL_PARAM}=1`, { force: true });
      })
      .catch(() => {
        if (typeof location !== "undefined") {
          location.hash = `${BASE}?${TAB_PARAM}=basic3000&${LEVEL_PARAM}=1`;
        }
      });
  };
  app.querySelector("[data-hanja-side-nav]")?.addEventListener("click", onClick);

  const onHash = () => {
    syncFromHash(app);
  };
  window.addEventListener("hashchange", onHash);

  const onLang = () => {
    i18n.apply?.(app);
    syncFromHash(app);
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
    app.querySelector("[data-hanja-side-nav]")?.removeEventListener("click", onClick);
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
