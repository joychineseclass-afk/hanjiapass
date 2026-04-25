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

/**
 * @param {object} item
 */
function renderIdiomDetailPage(item) {
  const lang = meaningLocaleKey();
  const exObj = item?.example && typeof item.example === "object" ? item.example : null;
  const storyObj = item?.story && typeof item.story === "object" ? item.story : null;
  const srcObj = item?.storySource && typeof item.storySource === "object" ? item.storySource : null;

  const meaningText = pickLocaleField(item?.meaning);
  const explainZh = String(item?.chineseExplanation ?? "").trim();
  const hideMeaningIfDup = lang === "cn" && meaningText && explainZh && meaningText === explainZh;

  const exCn = exObj ? String(exObj.cn ?? "").trim() : "";
  const exTrans = exObj ? pickLocaleField(exObj) : "";
  const showExampleTranslation = lang !== "cn" && exTrans && exTrans !== exCn;

  const storySrc = srcObj ? pickLocaleField(srcObj) : "";
  const storyZh = String(storyObj?.cn ?? "").trim();
  const storyLang = storyObj ? pickLocaleField(storyObj) : "";
  const showLangStory = lang !== "cn" && Boolean(storyLang) && storyLang !== storyZh;

  let h = "";
  h += `<article class="idiom-detail-panel" data-idiom-detail="${esc(item?.id)}">`;
  h += `<header class="idiom-detail-head">`;
  h += `<h2 class="idiom-detail-title" lang="zh-Hans">${esc(item?.idiom)}</h2>`;
  h += `<p class="idiom-detail-pinyin" lang="zh-Latn">${esc(item?.pinyin)}</p>`;
  h += `</header>`;

  h += `<section class="idiom-detail-section idiom-detail-section--card">`;
  h += `<h3 class="idiom-detail-h3" data-i18n="culture.idioms.chineseExplanationLabel">${esc(t("culture.idioms.chineseExplanationLabel"))}</h3>`;
  h += `<p class="idiom-detail-body idiom-detail-body--zh" lang="zh-Hans">${esc(explainZh)}</p>`;
  h += `</section>`;

  if (!hideMeaningIfDup) {
    h += `<section class="idiom-detail-section idiom-detail-section--card">`;
    h += `<h3 class="idiom-detail-h3" data-i18n="culture.idioms.meaningLabel">${esc(t("culture.idioms.meaningLabel"))}</h3>`;
    h += `<p class="idiom-detail-body">${esc(meaningText)}</p>`;
    h += `</section>`;
  }

  h += `<section class="idiom-detail-section idiom-detail-section--card">`;
  h += `<h3 class="idiom-detail-h3" data-i18n="culture.idioms.exampleLabel">${esc(t("culture.idioms.exampleLabel"))}</h3>`;
  h += `<p class="idiom-detail-body idiom-detail-body--zh" lang="zh-Hans">${esc(exCn)}</p>`;
  h += `</section>`;

  if (showExampleTranslation) {
    h += `<section class="idiom-detail-section idiom-detail-section--card">`;
    h += `<h3 class="idiom-detail-h3" data-i18n="culture.idioms.exampleTranslationLabel">${esc(t("culture.idioms.exampleTranslationLabel"))}</h3>`;
    h += `<p class="idiom-detail-body">${esc(exTrans)}</p>`;
    h += `</section>`;
  }

  h += `<section class="idiom-ai-section" aria-label="${esc(t("culture.idioms.aiSectionTitle"))}">`;
  h += `<h3 class="idiom-ai-section__title" data-i18n="culture.idioms.aiSectionTitle">${esc(t("culture.idioms.aiSectionTitle"))}</h3>`;
  h += `<div class="idiom-ai-section__inner">`;
  h += `<div class="idiom-ai-block">`;
  h += `<h4 class="idiom-detail-h4" data-i18n="culture.idioms.storySourceLabel">${esc(t("culture.idioms.storySourceLabel"))}</h4>`;
  h += `<p class="idiom-detail-body">${esc(storySrc)}</p>`;
  h += `</div>`;
  if (lang === "cn") {
    h += `<div class="idiom-ai-block">`;
    h += `<h4 class="idiom-detail-h4" data-i18n="culture.idioms.storyLangLabel">${esc(t("culture.idioms.storyLangLabel"))}</h4>`;
    h += `<p class="idiom-detail-body idiom-detail-body--zh" lang="zh-Hans">${esc(storyZh)}</p>`;
    h += `</div>`;
  } else {
    if (storyZh) {
      h += `<div class="idiom-ai-block">`;
      h += `<h4 class="idiom-detail-h4" data-i18n="culture.idioms.storyCnLabel">${esc(t("culture.idioms.storyCnLabel"))}</h4>`;
      h += `<p class="idiom-detail-body idiom-detail-body--zh" lang="zh-Hans">${esc(storyZh)}</p>`;
      h += `</div>`;
    }
    if (showLangStory) {
      h += `<div class="idiom-ai-block">`;
      h += `<h4 class="idiom-detail-h4" data-i18n="culture.idioms.storyLangLabel">${esc(t("culture.idioms.storyLangLabel"))}</h4>`;
      h += `<p class="idiom-detail-body">${esc(storyLang)}</p>`;
      h += `</div>`;
    }
  }
  h += `</div></section>`;
  h += `</article>`;
  return h;
}

/**
 * @param {object[]|null} idiomList
 * @param {string} sectionId
 * @param {string} activeIdiomId
 */
function buildSideNavInnerHtml(idiomList, sectionId, activeIdiomId) {
  return CULTURE_SECTION_IDS.map((id) => {
    const navKey = `culture.nav.${id}`;
    const isSec = id === sectionId;
    if (id !== "idioms") {
      return `<button type="button" class="${navItemClassL2(id, isSec)}" data-culture-nav="${id}" data-i18n="${esc(navKey)}" aria-current="${isSec ? "true" : "false"}">${esc(t(navKey))}</button>`;
    }
    const kids =
      idiomList && idiomList.length
        ? idiomList
            .map((it) => {
              const iid = String(it?.id ?? "");
              const isId = isSec && iid && iid === activeIdiomId;
              return `<button type="button" class="${navItemClassL3(isId)}" data-culture-idiom="${esc(iid)}" aria-current="${isId ? "true" : "false"}">${esc(it?.idiom)}</button>`;
            })
            .join("")
        : `<p class="section-side-nav-idiom-placeholder" data-i18n="common.loading">${esc(t("common.loading"))}</p>`;
    return `<div class="section-side-nav__idiom-block">
  <button type="button" class="${navItemClassL2("idioms", isSec)}" data-culture-nav="idioms" data-i18n="${esc(navKey)}" aria-current="${isSec ? "true" : "false"}">${esc(t(navKey))}</button>
  <div class="section-side-nav-idiom-children" data-idiom-children="1">${kids}</div>
</div>`;
  }).join("");
}

/**
 * @param {object} root
 * @param {object[]|null} list
 * @param {string} sectionId
 * @param {string} idiomId
 */
function updateSideNav(root, list, sectionId, idiomId) {
  const navInner = root.querySelector("[data-culture-side-nav]");
  if (!navInner) return;
  navInner.innerHTML = buildSideNavInnerHtml(list, sectionId, idiomId);
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
      updateSideNav(root, _idiomsCache, "idioms", iid);
      renderIdiomRight(root, _idiomsCache, "idioms", iid);
      return;
    }
    updateSideNav(root, null, "idioms", DEFAULT_IDIOM_ID);
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
        updateSideNav(root, list, "idioms", iid);
        p.innerHTML = renderIdiomDetailPage(list.find((x) => x.id === iid) || list[0]);
        i18n.apply?.(p);
      })
      .catch(() => {
        if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
        if (currentSectionId() !== "idioms") return;
        updateSideNav(root, null, "idioms", DEFAULT_IDIOM_ID);
        const p = root.querySelector("[data-culture-panel-inner]");
        if (!p) return;
        p.innerHTML = renderIdiomsErrorPanel();
        i18n.apply?.(p);
      });
    return;
  }
  updateSideNav(root, _idiomsCache, sectionId, "");
  inner.innerHTML = renderDefaultRightPanel(sectionId);
  i18n.apply?.(inner);
}

function updateNavForSectionOnly(root, sectionId) {
  if (sectionId === "idioms" && _idiomsCache) {
    updateSideNav(root, _idiomsCache, "idioms", currentIdiomIdFromList(_idiomsCache));
  } else {
    updateSideNav(root, _idiomsCache, sectionId, "");
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

  const sideNavBody = _idiomsCache
    ? buildSideNavInnerHtml(_idiomsCache, sectionId, idiomIdForNav)
    : buildSideNavInnerHtml(null, sectionId, DEFAULT_IDIOM_ID);

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
    updateSideNav(app, _idiomsCache, "idioms", iid);
    const inner = app.querySelector("[data-culture-panel-inner]");
    if (inner) {
      const item = _idiomsCache.find((x) => x.id === iid) || _idiomsCache[0];
      inner.innerHTML = renderIdiomDetailPage(item);
      i18n.apply?.(inner);
    }
  }

  const onNavClick = (e) => {
    const idiomBtn = e.target?.closest?.("[data-culture-idiom]");
    if (idiomBtn) {
      const iid = idiomBtn.getAttribute("data-culture-idiom");
      if (!iid) return;
      e.preventDefault();
      import("../router.js")
        .then((r) => {
          r.navigateTo(`${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`, { force: true });
        })
        .catch(() => {
          if (typeof location !== "undefined") {
            location.hash = `${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`;
          }
        });
      return;
    }
    const btn = e.target?.closest?.("[data-culture-nav]");
    if (!btn) return;
    const id = btn.getAttribute("data-culture-nav");
    if (!id || !ALLOWED.has(id) || id === currentSectionId()) {
      if (id === "idioms" && id === currentSectionId()) e.preventDefault();
      return;
    }
    e.preventDefault();
    if (id === "idioms" && _idiomsCache?.length) {
      const iid = currentIdiomIdFromList(_idiomsCache);
      import("../router.js")
        .then((r) => {
          r.navigateTo(`${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`, { force: true });
        })
        .catch(() => {
          if (typeof location !== "undefined") {
            location.hash = `${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`;
          }
        });
    } else {
      import("../router.js")
        .then((r) => {
          r.navigateTo(`${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`, { force: true });
        })
        .catch(() => {
          if (typeof location !== "undefined") {
            location.hash = `${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`;
          }
        });
    }
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
