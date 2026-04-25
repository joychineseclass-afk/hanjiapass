// /ui/pages/page.culture.js — 文化学习：左侧分类导航 + 右侧内容（与资料页 .page-shell 一致）
import { i18n } from "../i18n.js";
import * as LE from "../core/languageEngine.js";
import {
  CULTURE_SECTION_IDS,
  parseHashSectionId,
  cultureSectionContentKeys,
} from "../components/sideSectionNav.js";

const STYLE_ID = "lumina-culture-shell";

let _idiomsCache = null;
let _idiomsFetchPromise = null;

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

function idiomsDataUrl() {
  const b = typeof window !== "undefined" && String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  return (b ? b + "/" : "/") + "data/culture/idioms/idioms-basic.json";
}

/**
 * @returns {Promise<unknown[]>}
 */
async function loadIdiomsData() {
  if (_idiomsCache) return _idiomsCache;
  if (_idiomsFetchPromise) return _idiomsFetchPromise;
  _idiomsFetchPromise = (async () => {
    const u = idiomsDataUrl();
    const tryFetch = async (url) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("idioms fetch failed");
      return res.json();
    };
    let data;
    try {
      data = await tryFetch(u);
    } catch {
      if (u.startsWith("/data/")) {
        try {
          data = await tryFetch("." + u);
        } catch {
          throw new Error("idioms fetch failed");
        }
      } else {
        throw new Error("idioms fetch failed");
      }
    }
    if (!Array.isArray(data)) throw new Error("idioms bad shape");
    _idiomsCache = data;
    return _idiomsCache;
  })();
  try {
    return await _idiomsFetchPromise;
  } catch (e) {
    _idiomsCache = null;
    throw e;
  } finally {
    _idiomsFetchPromise = null;
  }
}

function meaningLocaleKey() {
  const l = LE.getLang();
  if (l === "cn" || l === "kr" || l === "en" || l === "jp") return l;
  return "en";
}

/**
 * @param {Record<string, string>|null|undefined} m
 */
function pickMeaning(m) {
  if (!m || typeof m !== "object") return "";
  const k = meaningLocaleKey();
  return String(m[k] ?? m.en ?? m.cn ?? "");
}

/**
 * @param {object} item
 */
function oneIdiomCard(item) {
  const id = String(item?.id ?? "");
  const mean = pickMeaning(item?.meaning);
  const zhExp = String(item?.chineseExplanation ?? "");
  const ex = String(item?.example ?? "");
  return `
  <article class="culture-idiom-card" data-idiom-id="${esc(id)}">
    <h3 class="culture-idiom-card__word" lang="zh-Hans">${esc(item?.idiom)}</h3>
    <p class="culture-idiom-card__pinyin" lang="zh-Latn">${esc(item?.pinyin)}</p>
    <div class="culture-idiom-card__row">
      <div class="culture-idiom-card__label" data-i18n="culture.idioms.meaningLabel">${esc(t("culture.idioms.meaningLabel"))}</div>
      <p class="culture-idiom-card__value">${esc(mean)}</p>
    </div>
    <div class="culture-idiom-card__row">
      <div class="culture-idiom-card__label" data-i18n="culture.idioms.chineseExplanationLabel">${esc(t("culture.idioms.chineseExplanationLabel"))}</div>
      <p class="culture-idiom-card__value culture-idiom-card__value--zh" lang="zh-Hans">${esc(zhExp)}</p>
    </div>
    <div class="culture-idiom-card__row">
      <div class="culture-idiom-card__label" data-i18n="culture.idioms.exampleLabel">${esc(t("culture.idioms.exampleLabel"))}</div>
      <p class="culture-idiom-card__value culture-idiom-card__value--zh" lang="zh-Hans">${esc(ex)}</p>
    </div>
    <button type="button" class="culture-idiom-card__ai" data-idiom-ai="1" data-i18n="culture.idioms.aiExplain">${esc(t("culture.idioms.aiExplain"))}</button>
  </article>`;
}

/**
 * @param {object[]} list
 */
function idiomListInnerHtml(list) {
  if (!list.length) {
    return `<p class="culture-idiom-empty" data-i18n="common.no_data">${esc(t("common.no_data"))}</p>`;
  }
  return `<div class="culture-idiom-list">${list.map((x) => oneIdiomCard(x)).join("")}</div>`;
}

function renderIdiomsHeader() {
  const keys = cultureSectionContentKeys("idioms");
  return `
    <h2 class="title" data-i18n="${esc(keys.titleKey)}">${esc(t(keys.titleKey))}</h2>
    <p class="desc" data-i18n="${esc(keys.descKey)}">${esc(t(keys.descKey))}</p>`;
}

function renderIdiomsPanelLoading() {
  return (
    renderIdiomsHeader() +
    `<p class="culture-idiom-loading" data-i18n="common.loading">${esc(t("common.loading"))}</p>`
  );
}

/**
 * @param {object[]} list
 */
function renderIdiomsPanelWithList(list) {
  return renderIdiomsHeader() + idiomListInnerHtml(list);
}

function renderIdiomsPanelError() {
  return (
    renderIdiomsHeader() +
    `<p class="culture-idiom-error" data-i18n="culture.idioms.loadError">${esc(t("culture.idioms.loadError"))}</p>`
  );
}

function renderDefaultRightPanel(sectionId) {
  const keys = cultureSectionContentKeys(sectionId);
  return `
    <h2 class="title" data-i18n="${esc(keys.titleKey)}">${esc(t(keys.titleKey))}</h2>
    <p class="desc" data-i18n="${esc(keys.descKey)}">${esc(t(keys.descKey))}</p>
    <p class="desc" style="margin-top:14px;opacity:0.88;font-size:14px" data-i18n="culture.comingSoon">${esc(t("culture.comingSoon"))}</p>
  `;
}

function renderRightPanelMarkup(sectionId) {
  if (sectionId === "idioms") {
    return renderIdiomsPanelLoading();
  }
  return renderDefaultRightPanel(sectionId);
}

function showAiComingSoonToast() {
  const msg = t("culture.idioms.aiComingSoon");
  const ex = document.getElementById("culture-idiom-toast");
  if (ex) ex.remove();
  const el = document.createElement("div");
  el.id = "culture-idiom-toast";
  el.className = "culture-idiom-toast";
  el.setAttribute("role", "status");
  el.textContent = msg;
  document.body.appendChild(el);
  window.setTimeout(() => {
    try {
      el.remove();
    } catch {
      /* */
    }
  }, 2600);
}

function updatePanel(root, sectionId) {
  const inner = root.querySelector("[data-culture-panel-inner]");
  if (!inner) return;
  if (sectionId === "idioms") {
    if (_idiomsCache) {
      inner.innerHTML = renderIdiomsPanelWithList(_idiomsCache);
      i18n.apply?.(inner);
      return;
    }
    inner.innerHTML = renderIdiomsPanelLoading();
    i18n.apply?.(inner);
    loadIdiomsData()
      .then((list) => {
        if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
        if (currentSectionId() !== "idioms") return;
        const p = root.querySelector("[data-culture-panel-inner]");
        if (!p) return;
        p.innerHTML = renderIdiomsPanelWithList(list);
        i18n.apply?.(p);
      })
      .catch(() => {
        if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
        if (currentSectionId() !== "idioms") return;
        const p = root.querySelector("[data-culture-panel-inner]");
        if (!p) return;
        p.innerHTML = renderIdiomsPanelError();
        i18n.apply?.(p);
      });
    return;
  }
  inner.innerHTML = renderDefaultRightPanel(sectionId);
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
  updatePanel(app, sectionId);

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

  const onPanelClick = (e) => {
    const b = e.target?.closest?.("[data-idiom-ai]");
    if (!b) return;
    e.preventDefault();
    showAiComingSoonToast();
  };
  app.querySelector("[data-culture-panel]")?.addEventListener("click", onPanelClick);

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
    app.querySelector("[data-culture-panel]")?.removeEventListener("click", onPanelClick);
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
