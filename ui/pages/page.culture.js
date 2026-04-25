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

const IDIOM_CATEGORY_ORDER = [
  "fable",
  "learning",
  "behavior",
  "wisdom",
  "emotion",
  "daily",
  "nature",
  "quantity",
];

/** 成语主分类；侧栏 L3=分类，L4=成语；空分类不渲染 */
const IDIOM_CATEGORY_LABEL_KEY = (cat) => `culture.idioms.category.${cat}`;

/** 成语目录索引缓存（id / idiom / pinyin / file / theme / difficulty / category 等） */
let _idiomsIndexCache = null;
let _idiomsIndexPromise = null;
/** 详情 JSON 分文件缓存 fileName → 详情数组 */
const _idiomDetailFileCache = new Map();
const _idiomDetailFilePromises = new Map();

let _idiomsPanelRequestId = 0;

/** 已展开侧栏的二级分类（成语/俗语等有下层子项的区块） */
const expandedCultureSections = new Set();
/** 成语 tab 下已展开的主分类（L3，仅 L4 列表展开；hash 不驱动此 Set） */
const expandedIdiomCategories = new Set();

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

function navItemClassL4(active) {
  const base = "section-side-nav-item level-4";
  return active ? `${base} is-active` : base;
}

/**
 * @param {object[]} index
 * @returns {Map<string, object[]>}
 */
function groupIdiomsByCategory(index) {
  const groups = new Map();
  for (const item of index) {
    const category = String(item?.category || "uncategorized").trim();
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  return groups;
}

/**
 * 某二级分类下是否有三级子项（可扩展；目前成语来自 JSON，其余可后续接入数据）
 * @param {string} sectionId
 */
function getSectionChildren(sectionId) {
  if (sectionId === "idioms" && _idiomsIndexCache && Array.isArray(_idiomsIndexCache) && _idiomsIndexCache.length) {
    return _idiomsIndexCache;
  }
  return [];
}

/**
 * @param {string} sectionId
 */
function sectionHasChildren(sectionId) {
  return getSectionChildren(sectionId).length > 0;
}

function idiomsDataBaseUrl() {
  const b = typeof window !== "undefined" && String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  return (b ? b + "/" : "/") + "data/culture/idioms/";
}

/**
 * @param {string} relativePath
 * @returns {Promise<unknown>}
 */
async function fetchIdiomsJsonFile(relativePath) {
  const rel = String(relativePath || "").replace(/^\//, "");
  const u = `${idiomsDataBaseUrl()}${rel}`;
  const tryOne = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("not ok");
    return res.json();
  };
  try {
    return await tryOne(u);
  } catch {
    if (u.startsWith("/data/")) {
      return tryOne(`.${u}`);
    }
    throw new Error("idioms json fetch failed");
  }
}

/**
 * @returns {Promise<object[]>}
 */
async function loadIdiomsIndex() {
  if (_idiomsIndexCache) return _idiomsIndexCache;
  if (_idiomsIndexPromise) return _idiomsIndexPromise;
  _idiomsIndexPromise = (async () => {
    const data = await fetchIdiomsJsonFile("idioms-index.json");
    if (!Array.isArray(data)) throw new Error("index bad shape");
    _idiomsIndexCache = data;
    return _idiomsIndexCache;
  })();
  try {
    return await _idiomsIndexPromise;
  } catch (e) {
    throw e;
  } finally {
    _idiomsIndexPromise = null;
  }
}

/**
 * @param {string} file
 * @returns {Promise<unknown[]>}
 */
async function loadIdiomDetailFile(file) {
  if (!file) throw new Error("no file");
  if (_idiomDetailFileCache.has(file)) {
    return /** @type {unknown[]} */ (_idiomDetailFileCache.get(file));
  }
  if (_idiomDetailFilePromises.has(file)) {
    return /** @type {Promise<unknown[]>} */ (_idiomDetailFilePromises.get(file));
  }
  const p = (async () => {
    const data = await fetchIdiomsJsonFile(file);
    if (!Array.isArray(data)) throw new Error("detail bad shape");
    _idiomDetailFileCache.set(file, data);
    return data;
  })();
  _idiomDetailFilePromises.set(file, p);
  try {
    return await p;
  } catch (e) {
    throw e;
  } finally {
    _idiomDetailFilePromises.delete(file);
  }
}

/**
 * 按 id 在 index 中定位 file，再加载详情 JSON 中同 id 的条目
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function loadIdiomDetailById(id) {
  const index = await loadIdiomsIndex();
  if (!index?.length) return null;
  const entry = index.find((item) => item && String(item.id) === String(id)) || index[0];
  if (!entry?.file) return null;
  const detailList = await loadIdiomDetailFile(String(entry.file));
  if (!Array.isArray(detailList)) return null;
  return detailList.find((item) => item && String(item.id) === String(entry.id)) || null;
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
  const exObj = item?.example && typeof item.example === "object" ? item.example : null;

  const explainZh = String(item?.chineseExplanation ?? "").trim();
  const explainPy = String(item?.chineseExplanationPinyin ?? "").trim();
  const meaningInLocale = pickMeaningForLocale(item);
  const exCn = exObj ? String(exObj.cn ?? "").trim() : "";
  const exTrans = exObj ? pickLocaleField(exObj) : "";
  const exPy = String(item?.examplePinyin ?? "").trim();

  const isCn = meaningLocaleKey() === "cn";
  const showMeaningSecond = Boolean(meaningInLocale) && (!isCn || !sameText(explainZh, meaningInLocale));
  const showExTranslation = Boolean(exTrans) && !sameText(exTrans, exCn);

  let h = "";
  h += `<article class="idiom-detail-card" data-idiom-detail="${esc(item?.id)}">`;
  h += `<header class="idiom-detail-header">`;
  h += `<h2 class="idiom-detail-title" lang="zh-Hans">${esc(item?.idiom)}</h2>`;
  h += `<p class="idiom-pinyin" lang="zh-Latn">${esc(item?.pinyin)}</p>`;
  h += `</header>`;

  h += `<section class="idiom-detail-section idiom-detail-section--reading">`;
  h += `<h3 class="idiom-section-title" data-i18n="culture.idioms.meaningLabel">${esc(t("culture.idioms.meaningLabel"))}</h3>`;
  h += `<p class="idiom-cn-text" lang="zh-Hans">${esc(explainZh)}</p>`;
  if (explainPy) {
    h += `<p class="idiom-pinyin-line idiom-meaning-pinyin-line" lang="zh-Latn">${esc(explainPy)}</p>`;
  }
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

  h += `<div class="idiom-ai-button-wrap">`;
  h += `<button type="button" class="idiom-ai-button" data-idiom-ai-btn="1" data-i18n="culture.idioms.aiExplain">${esc(
    t("culture.idioms.aiExplain")
  )}</button>`;
  h += `</div>`;
  h += `</article>`;
  return h;
}

/**
 * 成语：L2「成语」→ L3 主分类 → L4 单条；仅 expandedCultureSections / expandedIdiomCategories 控制展开，hash 不自动展开
 * @param {string} sectionId
 * @param {string} activeChildId
 */
function buildIdiomsNavGroupHtml(sectionId, activeChildId) {
  const index = getSectionChildren("idioms");
  if (!index.length) return "";
  const groups = groupIdiomsByCategory(index);
  const isSec = sectionId === "idioms";
  const expanded = expandedCultureSections.has("idioms");
  const chev = expanded ? "▾" : "▸";
  const childrenId = "culture-nav-children-idioms";
  const navKey = "culture.nav.idioms";
  const categoryBlocks = IDIOM_CATEGORY_ORDER.map((cat) => {
    const items = (groups.get(cat) || []).slice();
    if (!items.length) return "";
    items.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    const catKey = IDIOM_CATEGORY_LABEL_KEY(cat);
    const l4id = `culture-nav-children-idioms-${cat}`;
    const catExpanded = expandedIdiomCategories.has(cat);
    const catChev = catExpanded ? "▾" : "▸";
    const isCatActive = isSec && items.some((it) => String(it?.id) === String(activeChildId));
    const kids = items
      .map((it) => {
        const cid = String(it?.id ?? "");
        const isChild = isSec && Boolean(cid) && cid === String(activeChildId);
        return `<button type="button" class="${navItemClassL4(isChild)}" data-culture-child="${esc(
          cid
        )}" data-culture-parent-section="idioms" data-culture-idiom-cat="${esc(cat)}" data-culture-idiom="${esc(
          cid
        )}" aria-current="${isChild ? "true" : "false"}">${esc(it?.idiom)}</button>`;
      })
      .join("");
    return `<div class="section-side-nav__subgroup" data-culture-idiom-subgroup="${esc(cat)}">
  <button type="button" class="${navItemClassL3(isCatActive)} section-side-nav-item--expandable" data-culture-idiom-cat="${esc(
      cat
    )}" data-culture-parent-section="idioms" aria-expanded="${catExpanded ? "true" : "false"}" aria-controls="${esc(
      l4id
    )}" aria-current="false">
    <span class="section-side-nav-item__text" data-i18n="${esc(catKey)}">${esc(t(catKey))}</span>
    <span class="section-side-nav-count" aria-hidden="true">${items.length}</span>
    <span class="section-side-nav-item__chev" aria-hidden="true">${catChev}</span>
  </button>
  <div class="section-side-nav-children level-4-group" id="${esc(l4id)}" ${catExpanded ? "" : "hidden"}>${kids}</div>
</div>`;
  }).join("");

  return `<div class="section-side-nav__group" data-culture-group="idioms">
  <button type="button" class="${navItemClassL2("idioms", isSec)} section-side-nav-item--expandable" data-culture-nav="idioms" data-culture-expandable="1" aria-expanded="${expanded ? "true" : "false"}" aria-controls="${esc(
    childrenId
  )}" aria-current="${isSec ? "true" : "false"}">
    <span class="section-side-nav-item__text" data-i18n="${esc(navKey)}">${esc(t(navKey))}</span>
    <span class="section-side-nav-item__chev" aria-hidden="true">${chev}</span>
  </button>
  <div class="section-side-nav-children" id="${esc(childrenId)}" ${expanded ? "" : "hidden"}>${categoryBlocks}</div>
</div>`;
}

/**
 * @param {string} sectionId 当前 tab（来自 hash）
 * @param {string} activeChildId 当前选中的成语 id（idiom_xxxx）
 */
function buildSideNavInnerHtml(sectionId, activeChildId) {
  return CULTURE_SECTION_IDS.map((id) => {
    const navKey = `culture.nav.${id}`;
    const isSec = id === sectionId;
    if (id === "idioms" && sectionHasChildren("idioms")) {
      return buildIdiomsNavGroupHtml(sectionId, activeChildId);
    }
    const children = getSectionChildren(id);
    const hasCh = sectionHasChildren(id);
    if (!hasCh) {
      return `<button type="button" class="${navItemClassL2(id, isSec)}" data-culture-nav="${id}" data-i18n="${esc(navKey)}" aria-current="${isSec ? "true" : "false"}">${esc(t(navKey))}</button>`;
    }
    // 仅 expandedCultureSections 控制展开；activeChildId 只影响子级 is-active，不参与展开
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

function renderIdiomsIndexErrorPanel() {
  return `<p class="culture-idiom-error" data-i18n="culture.idioms.indexLoadError">${esc(t("culture.idioms.indexLoadError"))}</p>`;
}

function renderIdiomsDetailErrorPanel() {
  return `<p class="culture-idiom-error" data-i18n="culture.idioms.detailLoadError">${esc(t("culture.idioms.detailLoadError"))}</p>`;
}

function renderDefaultRightPanel(sectionId) {
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
  if (sectionId === "idioms") {
    const reqId = ++_idiomsPanelRequestId;
    inner.innerHTML = `<p class="culture-idiom-loading" data-i18n="common.loading">${esc(t("common.loading"))}</p>`;
    i18n.apply?.(inner);
    void (async () => {
      let index;
      try {
        index = await loadIdiomsIndex();
      } catch {
        if (reqId !== _idiomsPanelRequestId) return;
        if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
        if (currentSectionId() !== "idioms") return;
        const p = root.querySelector("[data-culture-panel-inner]");
        if (!p) return;
        updateSideNav(root, "idioms", getHashIdParam() || DEFAULT_IDIOM_ID);
        p.innerHTML = renderIdiomsIndexErrorPanel();
        i18n.apply?.(p);
        return;
      }
      if (reqId !== _idiomsPanelRequestId) return;
      if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
      if (currentSectionId() !== "idioms") return;
      if (!index?.length) {
        const p = root.querySelector("[data-culture-panel-inner]");
        if (!p) return;
        updateSideNav(root, "idioms", getHashIdParam() || DEFAULT_IDIOM_ID);
        p.innerHTML = renderIdiomsIndexErrorPanel();
        i18n.apply?.(p);
        return;
      }
      const iid = currentIdiomIdFromList(index);
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
      const p = root.querySelector("[data-culture-panel-inner]");
      if (!p) return;
      let item;
      try {
        item = await loadIdiomDetailById(iid);
      } catch {
        if (reqId !== _idiomsPanelRequestId) return;
        p.innerHTML = renderIdiomsDetailErrorPanel();
        i18n.apply?.(p);
        return;
      }
      if (reqId !== _idiomsPanelRequestId) return;
      if (String(location.hash || "").split("?")[0].toLowerCase() !== BASE) return;
      if (currentSectionId() !== "idioms") return;
      if (!item) {
        p.innerHTML = renderIdiomsDetailErrorPanel();
        i18n.apply?.(p);
        return;
      }
      p.innerHTML = renderIdiomDetailPage(item);
      i18n.apply?.(p);
    })();
    return;
  }
  updateSideNav(root, sectionId, "");
  inner.innerHTML = renderDefaultRightPanel(sectionId);
  i18n.apply?.(inner);
}

function updateNavForSectionOnly(root, sectionId) {
  if (sectionId === "idioms" && _idiomsIndexCache?.length) {
    updateSideNav(root, "idioms", currentIdiomIdFromList(_idiomsIndexCache));
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
/** @type {ReturnType<typeof setTimeout> | null} */
let _idiomAiToastTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let _idiomAiToastFadeTimer = null;

/**
 * 成语详情「AI讲解」：即将开放提示（固定底部轻提示，非长弹窗）
 * @param {string} message
 */
function showIdiomAiComingSoonToast(message) {
  const text = String(message || "").trim() || t("culture.idioms.aiComingSoon");
  const existing = document.querySelector(".culture-idiom-ai-toast");
  if (existing) {
    existing.remove();
  }
  if (_idiomAiToastTimer) {
    clearTimeout(_idiomAiToastTimer);
    _idiomAiToastTimer = null;
  }
  if (_idiomAiToastFadeTimer) {
    clearTimeout(_idiomAiToastFadeTimer);
    _idiomAiToastFadeTimer = null;
  }
  const el = document.createElement("div");
  el.className = "culture-idiom-ai-toast";
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.add("culture-idiom-ai-toast--show");
  });
  _idiomAiToastTimer = setTimeout(() => {
    el.classList.remove("culture-idiom-ai-toast--show");
    _idiomAiToastFadeTimer = setTimeout(() => {
      el.remove();
      _idiomAiToastFadeTimer = null;
    }, 200);
    _idiomAiToastTimer = null;
  }, 2600);
}

export function unmount() {
  try {
    _teardown?.();
  } catch {
    /* */
  }
  _teardown = null;
  expandedCultureSections.clear();
  expandedIdiomCategories.clear();
}

export async function mount() {
  unmount();
  ensureDefaultIdiomInHash();

  const app = document.getElementById("app");
  if (!app) return;
  ensureShellBgStyle();

  const sectionId = currentSectionId();
  const sideNavTitle = t("culture.side_nav_label");
  const sideNavTitleKey = "culture.side_nav_label";

  let rightBody =
    sectionId === "idioms" ? `<p class="culture-idiom-loading" data-i18n="common.loading">${esc(t("common.loading"))}</p>` : renderDefaultRightPanel(sectionId);
  if (sectionId === "idioms") {
    try {
      await loadIdiomsIndex();
    } catch {
      /* 下面按空 index 走错误区 */
    }
    if (_idiomsIndexCache?.length) {
      const iid = currentIdiomIdFromList(_idiomsIndexCache);
      if (getHashIdParam() !== iid) {
        try {
          const u = new URL(window.location.href);
          u.hash = `${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`;
          history.replaceState(null, "", u.toString());
        } catch {
          /* */
        }
      }
      try {
        const item = await loadIdiomDetailById(iid);
        rightBody = item ? renderIdiomDetailPage(item) : renderIdiomsDetailErrorPanel();
      } catch {
        rightBody = renderIdiomsDetailErrorPanel();
      }
    } else {
      rightBody = renderIdiomsIndexErrorPanel();
    }
  }

  const idiomIdForNav =
    _idiomsIndexCache && sectionId === "idioms" && _idiomsIndexCache.length
      ? currentIdiomIdFromList(_idiomsIndexCache)
      : sectionId === "idioms"
        ? getHashIdParam() || DEFAULT_IDIOM_ID
        : "";

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
            <div data-culture-panel-inner">
              ${rightBody}
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  i18n.apply?.(app);

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
          const c = childBtn.getAttribute("data-culture-idiom-cat");
          if (c) expandedIdiomCategories.add(c);
          navTo(`${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`);
        }
        return;
      }
    }

    const catOnly = e.target?.closest?.("button[data-culture-idiom-cat]");
    if (catOnly && !catOnly.getAttribute("data-culture-child")) {
      e.preventDefault();
      const cat = catOnly.getAttribute("data-culture-idiom-cat");
      if (cat) {
        if (expandedIdiomCategories.has(cat)) {
          expandedIdiomCategories.delete(cat);
        } else {
          expandedIdiomCategories.add(cat);
        }
        updateNavForSectionOnly(app, "idioms");
      }
      return;
    }

    const btn = e.target?.closest?.("[data-culture-nav]");
    if (!btn) return;
    const id = btn.getAttribute("data-culture-nav");
    if (!id || !ALLOWED.has(id)) return;

    if (sectionHasChildren(id) && btn.getAttribute("data-culture-expandable") === "1") {
      e.preventDefault();
      if (currentSectionId() !== id) {
        expandedCultureSections.add(id);
        if (id === "idioms" && _idiomsIndexCache?.length) {
          const iid = currentIdiomIdFromList(_idiomsIndexCache);
          navTo(`${BASE}?${TAB_PARAM}=idioms&${ID_PARAM}=${encodeURIComponent(iid)}`);
        } else {
          navTo(`${BASE}?${TAB_PARAM}=${encodeURIComponent(id)}`);
        }
        return;
      }
      if (expandedCultureSections.has(id)) {
        expandedCultureSections.delete(id);
        if (id === "idioms") {
          expandedIdiomCategories.clear();
        }
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

  const onPanelClick = (e) => {
    const aiBtn = e.target?.closest?.("[data-idiom-ai-btn]");
    if (!aiBtn) return;
    e.preventDefault();
    showIdiomAiComingSoonToast(t("culture.idioms.aiComingSoon"));
  };
  app.querySelector("[data-culture-panel]")?.addEventListener("click", onPanelClick);

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
    if (_idiomAiToastTimer) {
      clearTimeout(_idiomAiToastTimer);
      _idiomAiToastTimer = null;
    }
    if (_idiomAiToastFadeTimer) {
      clearTimeout(_idiomAiToastFadeTimer);
      _idiomAiToastFadeTimer = null;
    }
    document.querySelectorAll(".culture-idiom-ai-toast").forEach((n) => n.remove());
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
export function render() {
  return mount();
}
