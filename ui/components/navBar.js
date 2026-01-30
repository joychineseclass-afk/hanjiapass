// navBar.js (ES Module)
// - 只负责渲染一次 navbar
// - data-i18n 文案由 i18n.apply() 来替换
// - 自动高亮当前 hash 对应的导航项

import { i18n } from "./i18n.js";

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
  { href: "#my", key: "nav_my" }
];

function normalizeHash(h) {
  if (!h) return "#home";
  return h.startsWith("#") ? h : `#${h}`;
}

function setActive(navEl) {
  const current = normalizeHash(location.hash);
  const links = navEl.querySelectorAll("a[data-nav]");
  links.forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("active", href === current);
  });
}

export function mountNavBar(navEl) {
  if (!navEl) return;

  // ✅ 防止重复 mount
  if (navEl.dataset.mounted === "1") {
    setActive(navEl);
    return;
  }
  navEl.dataset.mounted = "1";

  // render
  navEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  NAV_ITEMS.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;
    a.setAttribute("data-nav", "1");
    a.setAttribute("data-i18n", it.key); // 交给 i18n.apply() 替换
    a.textContent = i18n.t(it.key);      // 先给一个默认值（避免闪）
    frag.appendChild(a);
  });

  navEl.appendChild(frag);

  // click -> active
  navEl.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (!a) return;
    // 让 hash 改变后再统一刷新 active
    // （某些浏览器立即读 hash 可能还没变）
    setTimeout(() => setActive(navEl), 0);
  });

  // language changed -> re-apply text
  i18n.on("change", () => {
    i18n.apply(navEl);
  });

  // route changed
  i18n.on("route", () => {
    setActive(navEl);
  });

  // initial active
  if (!location.hash) location.hash = "#home";
  setActive(navEl);
}
