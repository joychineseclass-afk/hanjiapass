// ui/components/navBar.js (Stable++)
// - 只负责渲染一次 navbar（防重复）
// - data-i18n 文案交给 i18n.apply() 替换
// - 自动高亮：click / hashchange / i18n route
// - ✅ 不重复注册监听（避免多页面进入后触发多次）
// - ✅ 兼容未来 hash 扩展：#hsk/xxx 也能高亮 #hsk

import { i18n } from "../i18n.js";

const NAV_ITEMS = [
  { href: "#home", key: "nav_home" },
  { href: "#hsk", key: "nav_hsk" },
  { href: "#stroke", key: "nav_stroke" },
  { href: "#hanjagongfu", key: "nav_hanjagongfu" },
  { href: "#speaking", key: "nav_speaking" },
  { href: "#travel", key: "nav_travel" },
  { href: "#culture", key: "nav_culture" },
  { href: "#review", key: "nav_review" },
  { href: "#resources", key: "nav_resources" },
  { href: "#teacher", key: "nav_teacher" },
  { href: "#my", key: "nav_my" },
];

function normalizeHash(h) {
  const s = String(h || "").trim();
  if (!s) return "";
  return s.startsWith("#") ? s : `#${s}`;
}

/**
 * ✅ 更稳的 active 判断：
 * - 完全相等：#hsk === #hsk
 * - 前缀匹配：#hsk/lesson1 也算在 #hsk 下（未来扩展不会返工）
 */
function isActiveHref(currentHash, itemHref) {
  const cur = normalizeHash(currentHash);
  const href = normalizeHash(itemHref);

  if (!cur || !href) return false;
  if (cur === href) return true;

  // 允许 #hsk/xxx #hsk?x=1 也匹配到 #hsk
  return cur.startsWith(href + "/") || cur.startsWith(href + "?");
}

function applyI18nTo(navEl) {
  try {
    // ✅ 兼容 i18n.apply(navEl) 或 i18n.apply()
    if (typeof i18n?.apply === "function") {
      if (i18n.apply.length >= 1) i18n.apply(navEl);
      else i18n.apply();
    }
  } catch {}
}

function setActive(navEl) {
  const current = normalizeHash(location.hash) || "#home";
  const links = navEl.querySelectorAll("a[data-nav]");
  links.forEach((a) => {
    const href = a.getAttribute("href") || "";
    a.classList.toggle("active", isActiveHref(current, href));
    a.setAttribute("aria-current", isActiveHref(current, href) ? "page" : "false");
  });
}

function render(navEl) {
  navEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  NAV_ITEMS.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;
    a.setAttribute("data-nav", "1");
    a.setAttribute("data-i18n", it.key);

    // ✅ 先给默认文案避免闪烁（即便之后 i18n.apply 会再替换）
    try {
      a.textContent = i18n?.t?.(it.key) || it.key;
    } catch {
      a.textContent = it.key;
    }

    frag.appendChild(a);
  });

  navEl.appendChild(frag);
}

/**
 * mountNavBar(navEl, options?)
 * options:
 * - defaultHash: 默认 hash（无 hash 时）
 */
export function mountNavBar(navEl, options = {}) {
  if (!navEl) return { destroy() {} };

  const defaultHash = normalizeHash(options.defaultHash || "#home") || "#home";

  // ✅ 防重复 mount（同一个 navEl 只 mount 一次）
  if (navEl.dataset.mounted === "1") {
    // 只刷新一下状态
    if (!location.hash) location.hash = defaultHash;
    applyI18nTo(navEl);
    setActive(navEl);
    return navEl.__navBarApi || { destroy() {} };
  }
  navEl.dataset.mounted = "1";

  // ✅ 渲染一次
  render(navEl);

  // ✅ 初次 apply + active
  if (!location.hash) location.hash = defaultHash;
  applyI18nTo(navEl);
  setActive(navEl);

  // ✅ 绑定事件（只绑定一次）
  const onClick = (e) => {
    const a = e.target.closest?.("a[data-nav]");
    if (!a) return;
    // 等 hash 更新后再设置 active
    setTimeout(() => setActive(navEl), 0);
  };

  const onHashChange = () => setActive(navEl);

  const onLangChange = () => {
    applyI18nTo(navEl);
  };

  const onRoute = () => setActive(navEl);

  navEl.addEventListener("click", onClick);
  window.addEventListener("hashchange", onHashChange);

  // ✅ 避免重复注册：把解绑函数存在元素上
  // （即便将来 SPA 多次 mount/unmount，也不会监听累积）
  const offFns = [];

  try {
    if (typeof i18n?.on === "function") {
      i18n.on("change", onLangChange);
      i18n.on("route", onRoute);

      // 如果你的 i18n 有 off，就记录下来；没有也没关系
      if (typeof i18n.off === "function") {
        offFns.push(() => i18n.off("change", onLangChange));
        offFns.push(() => i18n.off("route", onRoute));
      }
    }
  } catch {}

  function destroy() {
    try {
      navEl.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHashChange);
      offFns.forEach((fn) => fn());
    } catch {}

    try {
      delete navEl.__navBarApi;
    } catch {}
  }

  const api = { destroy };
  navEl.__navBarApi = api;
  return api;
}
