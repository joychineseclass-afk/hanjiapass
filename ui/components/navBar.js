import { i18n } from "../i18n.js";

const NAV_ITEMS_FULL = [
  { href: "/index.html#home", key: "nav_home", label: "홈", color: "#3b82f6" },
  { href: "/pages/hsk.html", key: "nav_hsk", label: "HSK 학습", color: "#22c55e" },
  { href: "/pages/stroke.html", key: "nav_stroke", label: "한자 필순", color: "#f97316" },
  { href: "/pages/hanja.html", key: "nav_hanjagongfu", label: "한자공부", color: "#a855f7" },
  { href: "/pages/speaking.html", key: "nav_speaking", label: "회화", color: "#ef4444" },
];

function isIndexPage() {
  return location.pathname.endsWith("index.html") || location.pathname === "/";
}

function forceHomeRouter() {
  if (!isIndexPage()) return;

  if (location.hash === "#home") {
    location.hash = "#_";
    setTimeout(() => {
      location.hash = "#home";
    }, 0);
  } else {
    location.hash = "#home";
  }
}

export function mountNavBar(rootEl) {
  if (!rootEl) return;

  rootEl.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <a href="/index.html#home">Joy Chinese</a>
      </div>
      <nav class="site-nav"></nav>
    </div>
  `;

  const nav = rootEl.querySelector(".site-nav");

  NAV_ITEMS_FULL.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;
    a.textContent = it.label;

    if (it.href.includes("#home")) {
      a.addEventListener("click", (e) => {
        if (isIndexPage()) {
          e.preventDefault();
          forceHomeRouter();
        }
      });
    }

    nav.appendChild(a);
  });
}
