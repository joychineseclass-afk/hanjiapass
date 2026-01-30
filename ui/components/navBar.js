// ui/components/navBar.js
// - 只负责渲染一次 navbar
// - data-i18n 文案由 i18n.apply() 来替换
// - 自动高亮当前 hash 对应的导航项

import { i18n } from "../i18n.js"; // ✅ 从 components 返回到 ui

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

  if (navEl.dataset.mounted === "1") {
    setActive(navEl);
    return;
  }
  navEl.dataset.mounted = "1";

  navEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  NAV_ITEMS.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;
    a.setAttribute("data-nav", "1");
    a.setAttribute("data-i18n", it.key);
    a.textContent = i18n.t(it.key);
    frag.appendChild(a);
  });

  navEl.appendChild(frag);

  navEl.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (!a) return;
    setTimeout(() => setActive(navEl), 0);
  });

  // 语言变化 → 更新菜单文字
  i18n.on("change", () => {
    i18n.apply(navEl);
  });

  // 路由变化 → 更新高亮
  i18n.on("route", () => {
    setActive(navEl);
  });

  if (!location.hash) location.hash = "#home";
  setActive(navEl);
}
