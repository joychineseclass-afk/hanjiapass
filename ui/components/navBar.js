// /ui/components/navBar.js ✅ FINAL for Multi-Page (A方案)
import { i18n } from "../i18n.js";

const NAV_ITEMS = [
  { href: "/index.html",  key: "nav_home",        label: "홈",        color: "#3b82f6" },
  { href: "/hsk.html",    key: "nav_hsk",         label: "HSK 학습",  color: "#22c55e" },
  { href: "/stroke.html", key: "nav_stroke",      label: "한자 필순", color: "#f97316" },
  { href: "/hanja.html",  key: "nav_hanjagongfu", label: "한자공부",  color: "#a855f7" },
  { href: "/speaking.html", key: "nav_speaking",  label: "회화",      color: "#ef4444" },
  { href: "/travel.html", key: "nav_travel",      label: "여행중국어", color: "#06b6d4" },
  { href: "/culture.html", key: "nav_culture",    label: "문화",      color: "#eab308" },
  { href: "/review.html", key: "nav_review",      label: "복습",      color: "#8b5cf6" },
  { href: "/resources.html", key: "nav_resources", label: "자료",     color: "#10b981" },
  { href: "/teacher.html", key: "nav_teacher",    label: "교사专区",  color: "#f43f5e" },
  { href: "/my.html",     key: "nav_my",          label: "내 학습",   color: "#64748b" },
];

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    return v && String(v).trim() ? v : fallback;
  } catch {
    return fallback;
  }
}

function normalizePath(href) {
  try {
    return new URL(href, location.origin).pathname.replace(/\/$/, "");
  } catch {
    return String(href || "").replace(/\/$/, "");
  }
}

function currentPath() {
  // Vercel 上 "/" 也可能是首页。你如果用 /index.html，就保持一致即可。
  const p = location.pathname.replace(/\/$/, "");
  return p === "" ? "/index.html" : p;
}

function setActive(rootEl) {
  if (!rootEl) return;
  const cur = currentPath();
  rootEl.querySelectorAll('a[data-nav="1"]').forEach((a) => {
    const p = normalizePath(a.getAttribute("href"));
    a.classList.toggle("active", p === cur);
  });
}

function syncLangButtons(rootEl) {
  if (!rootEl) return;
  const btnKR = rootEl.querySelector("#btnKR");
  const btnCN = rootEl.querySelector("#btnCN");
  const lang = (i18n?.getLang?.() || "kr").toLowerCase();

  btnKR?.classList.toggle("active", lang === "kr");
  btnCN?.classList.toggle("active", lang === "cn");

  document.documentElement.lang = lang === "kr" ? "ko" : "zh-CN";
}

function applyI18n(rootEl) {
  if (!rootEl) return;
  try { i18n?.apply?.(rootEl); } catch {}
  syncLangButtons(rootEl);
  setActive(rootEl);
}

let globalBound = false;
let lastRootEl = null;

function bindGlobalOnce() {
  if (globalBound) return;
  globalBound = true;

  // 多页面：不需要 hashchange；只需要 i18n change
  try {
    i18n?.on?.("change", () => {
      if (lastRootEl) applyI18n(lastRootEl);
    });
  } catch {}

  try {
    i18n?.onChange?.(() => {
      if (lastRootEl) applyI18n(lastRootEl);
    });
  } catch {}
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

  rootEl.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <a href="/index.html" data-i18n="brand">Joy Chinese</a>
        <small data-i18n="subtitle">AI 汉字・中文学习平台</small>
      </div>

      <div class="lang" aria-label="Language switcher">
        <button id="btnKR" type="button">KR</button>
        <button id="btnCN" type="button">CN</button>
      </div>
    </div>

    <nav class="site-nav dopamine" aria-label="Primary"></nav>
  `;

  const nav = rootEl.querySelector("nav.site-nav");

  NAV_ITEMS.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;
    a.setAttribute("data-nav", "1");
    a.setAttribute("data-i18n", it.key);
    a.style.setProperty("--navc", it.color);
    a.textContent = t(it.key, it.label);
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
