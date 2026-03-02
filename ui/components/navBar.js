// /ui/components/navBar.js
// ✅ MIXED MODE NAVBAR
// - Works with MPA pages (/pages/*.html)
// - Works with index.html hash router
// - Clicking "홈" inside index forces router rerender
// - Active highlight support
// - Language switch support

import { i18n } from "../i18n.js";
import { navigateTo } from "../router.js";

const NAV_ITEMS_FULL = [
  { href: "/index.html#home",     key: "nav_home",        label: "홈",        color: "#3b82f6" },

  { href: "/pages/hsk.html",      key: "nav_hsk",         label: "HSK 학습",  color: "#22c55e" },
  { href: "/pages/stroke.html",   key: "nav_stroke",      label: "한자 필순", color: "#f97316" },
  { href: "/pages/hanja.html",    key: "nav_hanjagongfu", label: "한자공부",  color: "#a855f7" },
  { href: "/pages/speaking.html", key: "nav_speaking",    label: "회화",      color: "#ef4444" },
  { href: "/pages/travel.html",   key: "nav_travel",      label: "여행중국어", color: "#06b6d4" },
  { href: "/pages/culture.html",  key: "nav_culture",     label: "문화",      color: "#eab308" },
  { href: "/pages/review.html",   key: "nav_review",      label: "복습",      color: "#8b5cf6" },
  { href: "/pages/resources.html",key: "nav_resources",   label: "자료",      color: "#10b981" },
  { href: "/pages/teacher.html",  key: "nav_teacher",     label: "교사专区",  color: "#f43f5e" },
  { href: "/pages/my.html",       key: "nav_my",          label: "내 학습",   color: "#64748b" },
];

function normalizePath(p) {
  const raw = (p || "").trim();
  if (!raw) return "/index.html";
  return raw.split("#")[0].split("?")[0];
}

function isIndexPage() {
  const p = normalizePath(location.pathname);
  return p === "/" || p.endsWith("/index.html");
}

function setActive(rootEl) {
  if (!rootEl) return;

  const curPath = normalizePath(location.pathname);
  const curHash = location.hash;

  rootEl.querySelectorAll('a[data-nav="1"]').forEach((a) => {
    const href = a.getAttribute("href") || "";
    const [toPath, toHash] = href.split("#");
    const navPath = normalizePath(toPath || "/index.html");

    let active = false;

    if (navPath.endsWith("/index.html") &&
        (curPath === "/" || curPath.endsWith("/index.html"))) {
      active = (!toHash && !curHash) || (`#${toHash}` === curHash);
    } else {
      active = navPath === curPath;
    }

    a.classList.toggle("active", active);
  });
}

function syncLangButtons(rootEl) {
  const btnKR = rootEl.querySelector("#btnKR");
  const btnCN = rootEl.querySelector("#btnCN");
  const lang = (i18n?.getLang?.() || "kr").toLowerCase();

  btnKR?.classList.toggle("active", lang === "kr");
  btnCN?.classList.toggle("active", lang === "cn");

  document.documentElement.lang = lang === "kr" ? "ko" : "zh-CN";
}

function applyI18n(rootEl) {
  try { i18n?.apply?.(rootEl); } catch {}
  syncLangButtons(rootEl);
  setActive(rootEl);
}

let globalBound = false;
let lastRootEl = null;

function bindGlobalOnce() {
  if (globalBound) return;
  globalBound = true;

  window.addEventListener("popstate", () => {
    if (lastRootEl) setActive(lastRootEl);
  });

  window.addEventListener("hashchange", () => {
    if (lastRootEl) setActive(lastRootEl);
  });

  try {
    i18n?.on?.("change", () => {
      if (lastRootEl) applyI18n(lastRootEl);
    });
  } catch {}
}

export function mountNavBar(rootEl) {
  if (!rootEl) return;

  bindGlobalOnce();
  lastRootEl = rootEl;

  if (rootEl.dataset.mounted === "1") {
    applyI18n(rootEl);
    return;
  }

  rootEl.dataset.mounted = "1";

  rootEl.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <a href="/index.html#home">Joy Chinese</a>
        <small>AI 한자 · 중국어 학습 플랫폼</small>
      </div>

      <div class="lang">
        <button id="btnKR" type="button">KR</button>
        <button id="btnCN" type="button">CN</button>
      </div>
    </div>

    <nav class="site-nav dopamine"></nav>
  `;

  const nav = rootEl.querySelector("nav.site-nav");

  NAV_ITEMS_FULL.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;
    a.setAttribute("data-nav", "1");
    a.setAttribute("data-i18n", it.key);
    a.style.setProperty("--navc", it.color);
    a.textContent = it.label;

    // ✅ 핵심: 홈 클릭 시 index 안에서는 router 강제 실행
    if (it.href.startsWith("/index.html#home")) {
      a.addEventListener("click", (e) => {

        if (isIndexPage()) {
          e.preventDefault();

          // 강제 rerender
          navigateTo("#home", { force: true });

          setActive(rootEl);
        }
      });
    }

    nav.appendChild(a);
  });

  const btnKR = rootEl.querySelector("#btnKR");
  const btnCN = rootEl.querySelector("#btnCN");

  btnKR?.addEventListener("click", () => {
    try { i18n?.setLang?.("kr"); } catch {}
    applyI18n(rootEl);
  });

  btnCN?.addEventListener("click", () => {
    try { i18n?.setLang?.("cn"); } catch {}
    applyI18n(rootEl);
  });

  applyI18n(rootEl);
}
