// /ui/components/navBar.js  ✅FINAL (dopamine nav)
import { i18n } from "../i18n.js";

const NAV_ITEMS = [
  { href: "#home",      key: "nav_home",        label: "홈",        color: "#3b82f6" },
  { href: "#hsk",       key: "nav_hsk",         label: "HSK 학습",  color: "#22c55e" },
  { href: "#stroke",    key: "nav_stroke",      label: "한자 필순", color: "#f97316" },
  { href: "#hanja",     key: "nav_hanjagongfu", label: "한자공부",  color: "#a855f7" },
  { href: "#speaking",  key: "nav_speaking",    label: "회화",      color: "#ef4444" },
  { href: "#travel",    key: "nav_travel",      label: "여행중국어", color: "#06b6d4" },
  { href: "#culture",   key: "nav_culture",     label: "문화",      color: "#eab308" },
  { href: "#review",    key: "nav_review",      label: "복습",      color: "#8b5cf6" },
  { href: "#resources", key: "nav_resources",   label: "자료",      color: "#10b981" },
  { href: "#teacher",   key: "nav_teacher",     label: "교사专区",  color: "#f43f5e" },
  { href: "#my",        key: "nav_my",          label: "내 학습",   color: "#64748b" },
];

function normalizeHash(h) {
  const raw = (h || "").trim();
  if (!raw) return "#home";
  if (raw.startsWith("#/")) return `#${raw.slice(2)}`;
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    return v && String(v).trim() ? v : fallback;
  } catch {
    return fallback;
  }
}

function setActive(rootEl) {
  if (!rootEl) return;
  const current = normalizeHash(location.hash);
  rootEl.querySelectorAll('a[data-nav="1"]').forEach((a) => {
    a.classList.toggle("active", normalizeHash(a.getAttribute("href")) === current);
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

  window.addEventListener("hashchange", () => {
    if (lastRootEl) setActive(lastRootEl);
  });

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

  if (!location.hash) location.hash = "#home";

  rootEl.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <a href="#home" data-i18n="brand">Joy Chinese</a>
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

  nav.addEventListener("click", (e) => {
    const a = e.target.closest('a[data-nav="1"]');
    if (!a) return;
    setTimeout(() => setActive(rootEl), 0);
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
