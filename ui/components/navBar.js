// /ui/components/navBar.js  ✅ MIXED (MPA pages + index.html hash-router)
import { i18n } from "../i18n.js";

// If on index, we can force rerender via router.navigateTo
async function forceHomeOnIndex() {
  // lazy import to avoid breaking other pages
  try {
    const { navigateTo } = await import("../router.js");
    navigateTo("#home", { force: true });
    return;
  } catch (e) {
    // fallback: hash toggle
    if (location.hash === "#home") {
      location.hash = "#_";
      requestAnimationFrame(() => (location.hash = "#home"));
    } else {
      location.hash = "#home";
    }
  }
}

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

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    return v && String(v).trim() ? v : fallback;
  } catch {
    return fallback;
  }
}

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
  const curHash = (location.hash || "").trim();

  rootEl.querySelectorAll('a[data-nav="1"]').forEach((a) => {
    const href = a.getAttribute("href") || "";
    const [toPath, toHash] = href.split("#");
    const navPath = normalizePath(toPath || "/index.html");

    let active = false;

    if (navPath.endsWith("/index.html") && (curPath === "/" || curPath.endsWith("/index.html"))) {
      const wantHash = toHash ? `#${toHash}` : "";
      active = wantHash ? (curHash === wantHash) : true;
    } else {
      active = navPath === curPath;
    }

    a.classList.toggle("active", !!active);
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

  window.addEventListener("popstate", () => { if (lastRootEl) setActive(lastRootEl); });
  window.addEventListener("hashchange", () => { if (lastRootEl) setActive(lastRootEl); });

  try { i18n?.on?.("change", () => { if (lastRootEl) applyI18n(lastRootEl); }); } catch {}
  try { i18n?.onChange?.(() => { if (lastRootEl) applyI18n(lastRootEl); }); } catch {}
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

  const mini = (rootEl.dataset.mode || "").toLowerCase() === "mini";
  const items = mini ? [NAV_ITEMS_FULL[0]] : NAV_ITEMS_FULL;

  rootEl.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <a href="/index.html#home" data-i18n="brand">Joy Chinese</a>
        <small data-i18n="subtitle">AI 한자 · 중국어 학습 플랫폼</small>
      </div>

      <div class="lang" aria-label="Language switcher">
        <button id="btnKR" type="button">KR</button>
        <button id="btnCN" type="button">CN</button>
      </div>
    </div>

    <nav class="site-nav dopamine ${mini ? "mini" : ""}" aria-label="Primary"></nav>
  `;

  const nav = rootEl.querySelector("nav.site-nav");

  items.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;
    a.setAttribute("data-nav", "1");
    a.setAttribute("data-i18n", it.key);
    a.style.setProperty("--navc", it.color);
    a.textContent = t(it.key, it.label);

    // ✅ Home: on index page -> force rerender (NO refresh needed)
    if (it.href.startsWith("/index.html#home")) {
      a.addEventListener("click", (e) => {
        if (isIndexPage()) {
          e.preventDefault();
          forceHomeOnIndex();
          setActive(rootEl);
        }
        // not on index: allow normal navigation to /index.html#home
      });
    }

    nav.appendChild(a);
  });

  const btnKR = rootEl.querySelector("#btnKR");
  const btnCN = rootEl.querySelector("#btnCN");

  btnKR?.addEventListener("click", () => {
    try { i18n?.setLang?.("kr"); } catch {}
    applyI18n(rootEl);
    window.dispatchEvent(new CustomEvent("joy:langchanged"));
  });

  btnCN?.addEventListener("click", () => {
    try { i18n?.setLang?.("cn"); } catch {}
    applyI18n(rootEl);
    window.dispatchEvent(new CustomEvent("joy:langchanged"));
  });

  applyI18n(rootEl);
}
