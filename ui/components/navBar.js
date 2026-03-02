// /ui/components/navBar.js ✅ FINAL (MIXED: MPA + index#home router)
// - Other sections: /pages/*.html (MPA)
// - Home: /index.html#home (index uses hash router)
// - Fix: clicking "홈" on index will force router re-render (no refresh needed)

import { i18n } from "../i18n.js";

// ⚠️ 只有在 index.html 才会用到 router（强制重渲染）
let navigateTo = null;
try {
  // 这里用动态 import，避免在纯 MPA 页面上引入 router 造成你不需要的依赖
  //（但就算引入也没问题，这样更稳）
} catch {}

const NAV_ITEMS_FULL = [
  { href: "/index.html#home",      key: "nav_home",        label: "홈",        color: "#3b82f6" },

  { href: "/pages/hsk.html",       key: "nav_hsk",         label: "HSK 학습",  color: "#22c55e" },
  { href: "/pages/stroke.html",    key: "nav_stroke",      label: "한자 필순", color: "#f97316" },
  { href: "/pages/hanja.html",     key: "nav_hanjagongfu", label: "한자공부",  color: "#a855f7" },
  { href: "/pages/speaking.html",  key: "nav_speaking",    label: "회화",      color: "#ef4444" },
  { href: "/pages/travel.html",    key: "nav_travel",      label: "여행중국어", color: "#06b6d4" },
  { href: "/pages/culture.html",   key: "nav_culture",     label: "문화",      color: "#eab308" },
  { href: "/pages/review.html",    key: "nav_review",      label: "복습",      color: "#8b5cf6" },
  { href: "/pages/resources.html", key: "nav_resources",   label: "자료",      color: "#10b981" },
  { href: "/pages/teacher.html",   key: "nav_teacher",     label: "교사专区",  color: "#f43f5e" },
  { href: "/pages/my.html",        key: "nav_my",          label: "내 학습",   color: "#64748b" },
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

    // ✅ 首页：path 匹配 + hash 匹配
    if (navPath.endsWith("/index.html") && (curPath === "/" || curPath.endsWith("/index.html"))) {
      const wantHash = toHash ? `#${toHash}` : "";
      active = wantHash ? (curHash === wantHash) : true;
    } else {
      // ✅ 其它页面：只看 pathname
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

// ✅ 核心：在 index.html 内点击 홈，要强制 router 重新渲染
async function forceHomeOnIndex() {
  if (!isIndexPage()) {
    // 不是首页：直接去 /index.html#home，让浏览器整页跳转即可（最稳）
    location.href = "/index.html#home";
    return;
  }

  // 是首页：用 router 的 navigateTo 强制渲染（不靠刷新）
  try {
    if (!navigateTo) {
      const mod = await import("../router.js");
      navigateTo = mod?.navigateTo;
    }
    if (typeof navigateTo === "function") {
      navigateTo("#home", { force: true });
      return;
    }
  } catch (e) {
    console.warn("[navBar] router import failed, fallback to hash", e);
  }

  // fallback：如果 router 没拿到，还是回到 #home（至少能回去）
  location.hash = "#home";
}

export function mountNavBar(rootEl) {
  if (!rootEl) return;

  bindGlobalOnce();
  lastRootEl = rootEl;

  // ✅ 防重复挂载
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

    // ✅ 홈：任何页面点都回主页；index 内强制 rerender
    if (it.href.startsWith("/index.html#home")) {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        forceHomeOnIndex();
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
