// /ui/pages/page.culture.js — 文化学习：左侧分类导航 + 右侧内容（与资料页 .page-shell 一致）
import { i18n } from "../i18n.js";
import * as LE from "../core/languageEngine.js";
import {
  CULTURE_SECTION_IDS,
  parseHashSectionId,
  cultureSectionContentKeys,
} from "../components/sideSectionNav.js";

const STYLE_ID = "lumina-culture-shell";
const BASE = "#culture";
const TAB_PARAM = "tab";
const ID_PARAM = "id";
const DEFAULT_ID = "idioms";
const DEFAULT_IDIOM_ID = "idiom_0001";
const ALLOWED = new Set(CULTURE_SECTION_IDS);

let _idiomsCache = null;
let _idiomsFetchPromise = null;

/** 已展开侧栏的二级分类（有三级子项的区块点击后 open） */
const expandedCultureSections = new Set();

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

/**
 * @returns {'idioms'|'proverbs'|'festivals'|'etiquette'|'figures'|'expressions'}
 */
function currentSectionId() {
  return /** @type {'idioms'|'proverbs'|'festivals'|'etiquette'|'figures'|'expressions'} */ (
    parseHashSectionId(BASE, TAB_PARAM, DEFAULT_ID, ALLOWED)
  );
}

function navItemClassL2(id, active) {
  const base = "section-side-nav-item level-2";
  return active ? `${base} is-active` : base;
}

function navItemClassL3(active) {
  const base = "section-side-nav-item level-3";
  return active ? `${base} is-active` : base;
}

/**
 * 某二级分类下是否有三级子项（可扩展；目前成语来自 JSON，其余可后续接入数据）
 * @param {string} sectionId
 */
function getSectionChildren(sectionId) {
  if (sectionId === "idioms" && _idiomsCache && Array.isArray(_idiomsCache) && _idiomsCache.length) {
    return _idiomsCache;
  }
  return [];
}

/**
 * @param {string} sectionId
 */
function sectionHasChildren(sectionId) {
  return getSectionChildren(sectionId).length > 0;
}

function idiomsDataUrl() {
  const b = typeof window !== "undefined" && String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  return (b ? b + "/" : "/") + "data/culture/idioms/idioms-basic.json";
}

/**
 * 默认 #culture 无 query 时 tab 为 idioms；为 idioms 且缺少 id 时补全为第一个成语
 */
function ensureDefaultIdiomInHash() {
  if (typeof location === "undefined") return;
  if (String(location.hash || "").split("?")[0].split("/")[0].toLowerCase() !== BASE) return;
  if (currentSectionId() !== "idioms") return;
  const raw = String(location.hash || "");
  const q = raw.indexOf("?");
  const params = q >= 0 ? new URLSearchParams(raw.slice(q + 1)) : new URLSearchParams();
  if (params.get(ID_PARAM)) return;
  const want = `${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(DEFAULT_IDIOM_ID)}`;
  try {
    const u = new URL(window.location.href);
    u.hash = want;
    history.replaceState(null, "", u.toString());
  } catch {
    try {
      location.replace(`${location.pathname}${location.search || ""}${want}`);
    } catch {
      location.hash = want;
    }
  }
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
 * 当前语言 → kr → cn → en → jp
 * @param {Record<string, string>|null|undefined} obj
 */
function pickLocaleField(obj) {
  if (!obj || typeof obj !== "object") return "";
  const first = meaningLocaleKey();
  const order = [first, "kr", "cn", "en", "jp"];
  const seen = new Set();
  for (const k of order) {
    if (seen.has(k)) continue;
    seen.add(k);
    const s = String(obj[k] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function getHashIdParam() {
  try {
    const raw = String(location.hash || "");
    const q = raw.indexOf("?");
    if (q < 0) return null;
    return new URLSearchParams(raw.slice(q + 1)).get(ID_PARAM);
  } catch {
    return null;
  }
}

/**
 * @param {object[]} list
 * @returns {string}
 */
function currentIdiomIdFromList(list) {
  if (!list?.length) return DEFAULT_IDIOM_ID;
  const fromHash = getHashIdParam();
  const allowed = new Set(list.map((x) => x?.id).filter(Boolean));
  if (fromHash && allowed.has(fromHash)) return fromHash;
  return String(list[0].id);
}

function sameText(a, b) {
  return String(a ?? "")
    .trim()
    .replaceAll(/\s+/g, " ") ===
    String(b ?? "")
      .trim()
      .replaceAll(/\s+/g, " ");
}

/**
 * 当前系统语言下「释义」段第二行用；CN 时取 meaning.cn
 * @param {object} item
 */
function pickMeaningForLocale(item) {
  const o = item?.meaning;
  if (!o || typeof o !== "object") return "";
  const k = meaningLocaleKey();
  return String(o[k] ?? o.cn ?? o.en ?? "").trim() || pickLocaleField(o);
}

/**
 * @param {object} item
 */
function renderIdiomDetailPage(item) {
  const lang = meaningLocaleKey();
  const exObj = item?.example && typeof item.example === "object" ? item.example : null;
  const storyObj = item?.story && typeof item.story === "object" ? item.story : null;
  const srcObj = item?.storySource && typeof item.storySource === "object" ? item.storySource : null;

  const explainZh = String(item?.chineseExplanation ?? "").trim();
  const meaningInLocale = pickMeaningForLocale(item);
  const exCn = exObj ? String(exObj.cn ?? "").trim() : "";
  const exTrans = exObj ? pickLocaleField(exObj) : "";
  const exPy = String(item?.examplePinyin ?? "").trim();

  const showMeaningSecond =
    Boolean(explainZh) && Boolean(meaningInLocale) && !sameText(explainZh, meaningInLocale);
  const showExTranslation = Boolean(exTrans) && !sameText(exTrans, exCn);

  const storySrc = srcObj ? pickLocaleField(srcObj) : "";
  const storyZh = String(storyObj?.cn ?? "").trim();
  const storyLang = storyObj ? pickLocaleField(storyObj) : "";
  const showLangStory = lang !== "cn" && Boolean(storyLang) && !sameText(storyLang, storyZh);

  let h = "";
  h += `<article class="idiom-detail-card" data-idiom-detail="${esc(item?.id)}">`;
  h += `<header class="idiom-detail-header">`;
  h += `<h2 class="idiom-detail-title" lang="zh-Hans">${esc(item?.idiom)}</h2>`;
  h += `<p class="idiom-pinyin" lang="zh-Latn">${esc(item?.pinyin)}</p>`;
  h += `</header>`;

  h += `<section class="idiom-detail-section idiom-detail-section--reading">`;
  h += `<h3 class="idiom-section-title" data-i18n="culture.idioms.meaningLabel">${esc(t("culture.idioms.meaningLabel"))}</h3>`;
  h += `<p class="idiom-cn-text" lang="zh-Hans">${esc(explainZh)}</p>`;
  if (showMeaningSecond) {
    h += `<p class="idiom-lang-text">${esc(meaningInLocale)}</p>`;
  }
  h += `</section>`;

  h += `<section class="idiom-detail-section idiom-detail-section--reading">`;
  h += `<h3 class="idiom-section-title" data-i18n="culture.idioms.exampleLabel">${esc(t("culture.idioms.exampleLabel"))}</h3>`;
  h += `<p class="idiom-cn-text" lang="zh-Hans">${esc(exCn)}</p>`;
  if (exPy) {
    h += `<p class="idiom-pinyin-line" lang="zh-Latn">${esc(exPy)}</p>`;
  }
  if (showExTranslation) {
    h += `<p class="idiom-lang-text">${esc(exTrans)}</p>`;
  }
  h += `</section>`;

  h += `<section class="idiom-ai-section" aria-label="${esc(t("culture.idioms.aiSectionTitle"))}">`;
  h += `<h3 class="idiom-ai-main-title" data-i18n="culture.idioms.aiSectionTitle">${esc(t("culture.idioms.aiSectionTitle"))}</h3>`;
  h += `<div class="idiom-ai-group">`;
  h += `<h4 class="idiom-ai-subhead" data-i18n="culture.idioms.storySourceLabel">${esc(t("culture.idioms.storySourceLabel"))}</h4>`;
  h += `<p class="idiom-ai-para">${esc(storySrc)}</p>`;
  h += `</div>`;
  h += `<div class="idiom-ai-group">`;
  h += `<h4 class="idiom-ai-subhead" data-i18n="culture.idioms.storyCnLabel">${esc(t("culture.idioms.storyCnLabel"))}</h4>`;
  h += `<p class="idiom-ai-para idiom-cn-text" lang="zh-Hans">${esc(storyZh)}</p>`;
  h += `</div>`;
  if (showLangStory) {
    h += `<div class="idiom-ai-group">`;
    h += `<h4 class="idiom-ai-subhead" data-i18n="culture.idioms.storyLangLabel">${esc(t("culture.idioms.storyLangLabel"))}</h4>`;
    h += `<p class="idiom-ai-para idiom-lang-text">${esc(storyLang)}</p>`;
    h += `</div>`;
  }
  h += `</section>`;
  h += `</article>`;
  return h;
}

/**
 * @param {string} sectionId 当前 tab（来自 hash）
 * @param {string} activeChildId 当前选中的三级 id（成语为 idiom_xxxx）
 */
function buildSideNavInnerHtml(sectionId, activeChildId) {
  return CULTURE_SECTION_IDS.map((id) => {
    const navKey = `culture.nav.${id}`;
    const isSec = id === sectionId;
    const children = getSectionChildren(id);
    const hasCh = sectionHasChildren(id);
    if (!hasCh) {
      return `<button type="button" class="${navItemClassL2(id, isSec)}" data-culture-nav="${id}" data-i18n="${esc(navKey)}" aria-current="${isSec ? "true" : "false"}">${esc(t(navKey))}</button>`;
    }
    const expanded = expandedCultureSections.has(id);
    const chev = expanded ? "▾" : "▸";
    const childrenId = `culture-nav-children-${id}`;
    const kids = children
      .map((it) => {
        const cid = String(it?.id ?? "");
        const isChild = isSec && Boolean(cid) && cid === activeChildId;
        return `<button type="button" class="${navItemClassL3(isChild)}" data-culture-child="${esc(cid)}" data-culture-parent-section="${esc(id)}" data-culture-idiom="${esc(cid)}" aria-current="${isChild ? "true" : "false"}">${esc(it?.idiom)}</button>`;
      })
      .join("");
    return `<div class="section-side-nav__group" data-culture-group="${esc(id)}">
  <button type="button" class="${navItemClassL2(id, isSec)} section-side-nav-item--expandable" data-culture-nav="${id}" data-culture-expandable="1" aria-expanded="${expanded ? "true" : "false"}" aria-controls="${esc(childrenId)}" aria-current="${isSec ? "true" : "false"}">
    <span class="section-side-nav-item__text" data-i18n="${esc(navKey)}">${esc(t(navKey))}</span>
    <span class="section-side-nav-item__chev" aria-hidden="true">${chev}</span>
  </button>
  <div class="section-side-nav-children" id="${esc(childrenId)}" ${expanded ? "" : "hidden"}>${kids}</div>
</div>`;
  }).join("");
}

/**
 * @param {object} root
 * @param {string} sectionId
 * @param {string} activeChildId
 */
function updateSideNav(root, sectionId, activeChildId) {
  const navInner = root.querySelector("[data-culture-side-nav]");
  if (!navInner) return;
  navInner.innerHTML = buildSideNavInnerHtml(sectionId, activeChildId);
  i18n.apply?.(navInner);
}

/**
 * @param {object} root
 * @param {string} sectionId
 * @param {object[]|null} list
 * @param {string} [idiomId]
 */
function renderIdiomRight(root, list, sectionId, idiomId) {
  const inner = root.querySelector("[data-culture-panel-inner]");
  if (!inner) return;
  if (!_idiomsCache || !list?.length) {
    inner.innerHTML = `<p class="culture-idiom-loading" data-i18n="common.loading">${esc(t("common.loading"))}</p>`;
    i18n.apply?.(inner);
    return;
  }
  const targetId = idiomId || currentIdiomIdFromList(list);
  const item = list.find((x) => String(x.id) === targetId) || list[0];
  inner.innerHTML = renderIdiomDetailPage(item);
  i18n.apply?.(inner);
}

function renderDefaultRightPanel(sectionId) {
  const keys = cultureSectionContentKeys(sectionId);
  return `
    <h2 class="title" data-i18n="${esc(keys.titleKey)}">${esc(t(keys.titleKey))}</h2>
    <p class="desc" data-i18n="${esc(keys.descKey)}">${esc(t(keys.descKey))}</p>
    <p class="desc" style="margin-top:14px;opacity:0.88;font-size:14px" data-i18n="culture.comingSoon">${esc(t("culture.comingSoon"))}</p>
  `;
}

function renderIdiomsErrorPanel() {
  return `<p class="culture-idiom-error" data-i18n="culture.idioms.loadError">${esc(t("culture.idioms.loadError"))}</p>`;
}

function updatePanel(root, sectionId) {
  const inner = root.querySelector("[data-culture-panel-inner]");
  if (!inner) return;
  if (sectionId === "idioms") {
    if (_idiomsCache) {
      const iid = currentIdiomIdFromList(_idiomsCache);
      updateSideNav(root, "idioms", iid);
      renderIdiomRight(root, _idiomsCache, "idioms", iid);
      return;
    }
    updateSideNav(root, "idioms", DEFAULT_IDIOM_ID);
    inner.innerHTML = `<p class="culture-idiom-loading" data-i18n="common.loading">${esc(t("common.loading"))}</p>`;
    i18n.apply?.(inner);
    loadIdiomsData()
      .then((list) => {
        if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
        if (currentSectionId() !== "idioms") return;
        const p = root.querySelector("[data-culture-panel-inner]");
        if (!p) return;
        const iid = currentIdiomIdFromList(list);
        if (getHashIdParam() !== iid) {
          try {
            const u = new URL(window.location.href);
            u.hash = `${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`;
            history.replaceState(null, "", u.toString());
          } catch {
            /* */
          }
        }
        updateSideNav(root, "idioms", iid);
        p.innerHTML = renderIdiomDetailPage(list.find((x) => x.id === iid) || list[0]);
        i18n.apply?.(p);
      })
      .catch(() => {
        if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
        if (currentSectionId() !== "idioms") return;
        updateSideNav(root, "idioms", DEFAULT_IDIOM_ID);
        const p = root.querySelector("[data-culture-panel-inner]");
        if (!p) return;
        p.innerHTML = renderIdiomsErrorPanel();
        i18n.apply?.(p);
      });
    return;
  }
  updateSideNav(root, sectionId, "");
  inner.innerHTML = renderDefaultRightPanel(sectionId);
  i18n.apply?.(inner);
}

function updateNavForSectionOnly(root, sectionId) {
  if (sectionId === "idioms" && _idiomsCache) {
    updateSideNav(root, "idioms", currentIdiomIdFromList(_idiomsCache));
  } else {
    updateSideNav(root, sectionId, "");
  }
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
  expandedCultureSections.clear();
}

export function mount() {
  unmount();
  ensureDefaultIdiomInHash();

  const app = document.getElementById("app");
  if (!app) return;
  ensureShellBgStyle();

  const sectionId = currentSectionId();
  const sideNavTitle = t("culture.side_nav_label");
  const sideNavTitleKey = "culture.side_nav_label";
  const idiomIdForNav =
    _idiomsCache && sectionId === "idioms" ? currentIdiomIdFromList(_idiomsCache) : sectionId === "idioms" ? getHashIdParam() || DEFAULT_IDIOM_ID : "";

  const sideNavBody = buildSideNavInnerHtml(sectionId, idiomIdForNav);

  app.innerHTML = `
    <div class="lumina-culture resource-library wrap" style="max-width:var(--max,1120px);margin:0 auto;padding:12px 16px 24px">
      <div class="page-shell page-shell--resource">
        <aside class="section-side-nav" aria-label="${esc(sideNavTitle)}">
          <p class="section-side-nav__title" data-i18n="${esc(sideNavTitleKey)}">${esc(sideNavTitle)}</p>
          <nav class="section-side-nav-inner" data-culture-side-nav>
            ${sideNavBody}
          </nav>
        </aside>
        <main class="section-main-panel">
          <div class="section-main-panel-inner" data-culture-panel>
            <div data-culture-panel-inner>
              ${
                sectionId === "idioms"
                  ? _idiomsCache
                    ? renderIdiomDetailPage(_idiomsCache.find((x) => x.id === currentIdiomIdFromList(_idiomsCache)) || _idiomsCache[0])
                    : `<p class="culture-idiom-loading" data-i18n="common.loading">${esc(t("common.loading"))}</p>`
                  : renderDefaultRightPanel(sectionId)
              }
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  i18n.apply?.(app);
  if (sectionId === "idioms" && !_idiomsCache) {
    updatePanel(app, "idioms");
  } else if (sectionId === "idioms" && _idiomsCache) {
    const iid = currentIdiomIdFromList(_idiomsCache);
    updateSideNav(app, "idioms", iid);
    const inner = app.querySelector("[data-culture-panel-inner]");
    if (inner) {
      const item = _idiomsCache.find((x) => x.id === iid) || _idiomsCache[0];
      inner.innerHTML = renderIdiomDetailPage(item);
      i18n.apply?.(inner);
    }
  }

  const navTo = (hash) => {
    import("../router.js")
      .then((r) => {
        r.navigateTo(hash, { force: true });
      })
      .catch(() => {
        if (typeof location !== "undefined") {
          location.hash = hash;
        }
      });
  };

  const onNavClick = (e) => {
    const childBtn = e.target?.closest?.("[data-culture-child]");
    if (childBtn) {
      const iid = childBtn.getAttribute("data-culture-child");
      const parentSec = childBtn.getAttribute("data-culture-parent-section");
      if (iid && parentSec) {
        e.preventDefault();
        expandedCultureSections.add(parentSec);
        if (parentSec === "idioms") {
          navTo(`${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`);
        }
        return;
      }
    }

    const btn = e.target?.closest?.("[data-culture-nav]");
    if (!btn) return;
    const id = btn.getAttribute("data-culture-nav");
    if (!id || !ALLOWED.has(id)) return;

    if (sectionHasChildren(id) && btn.getAttribute("data-culture-expandable") === "1") {
      e.preventDefault();
      if (currentSectionId() !== id) {
        expandedCultureSections.add(id);
        if (id === "idioms" && _idiomsCache?.length) {
          const iid = currentIdiomIdFromList(_idiomsCache);
          navTo(`${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`);
        } else {
          navTo(`${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`);
        }
        return;
      }
      if (expandedCultureSections.has(id)) {
        expandedCultureSections.delete(id);
      } else {
        expandedCultureSections.add(id);
      }
      updateNavForSectionOnly(app, id);
      return;
    }

    if (id === currentSectionId()) return;
    e.preventDefault();
    navTo(`${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`);
  };
  app.querySelector("[data-culture-side-nav]")?.addEventListener("click", onNavClick);

  const onHash = () => {
    if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
    const next = currentSectionId();
    ensureDefaultIdiomInHash();
    updateNavForSectionOnly(app, next);
    updatePanel(app, next);
  };
  window.addEventListener("hashchange", onHash);

  const onLang = () => {
    i18n.apply?.(app);
    const sec = currentSectionId();
    ensureDefaultIdiomInHash();
    updateNavForSectionOnly(app, sec);
    updatePanel(app, sec);
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
export function render() {
  return mount();
}
