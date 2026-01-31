// /ui/components/navBar.js  ✅FINAL — 稳健不返工版
// - 负责渲染：topbar(brand+lang) + nav links（一次性挂载）
// - hash 自动高亮
// - i18n change 自动刷新文案 + 同步按钮状态
// - 事件绑定全局只做一次（不重复）
// - 兼容：没有 i18n key 时 fallback label（韩语中心也OK）

import { i18n } from "../i18n.js";

const NAV_ITEMS = [
  { href: "#home",      key: "nav_home",        label: "홈" },
  { href: "#hsk",       key: "nav_hsk",         label: "HSK 학습" },
  { href: "#stroke",    key: "nav_stroke",      label: "한자 필순" },
  { href: "#hanja",     key: "nav_hanjagongfu", label: "한자공부" },
  { href: "#speaking",  key: "nav_speaking",    label: "회화" },
  { href: "#travel",    key: "nav_travel",      label: "여행중국어" },
  { href: "#culture",   key: "nav_culture",     label: "문화" },
  { href: "#review",    key: "nav_review",      label: "복습" },
  { href: "#resources", key: "nav_resources",   label: "자료" },
  { href: "#teacher",   key: "nav_teacher",     label: "교사专区" },
  { href: "#my",        key: "nav_my",          label: "내 학습" },
];

// ---------- helpers ----------
function normalizeHash(h) {
  const raw = (h || "").trim();
  if (!raw) return "#home";
  if (raw.startsWith("#/")) return `#${raw.slice(2)}`; // "#/home" -> "#home"
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

  const lang = (i18n?.getLang?.() || "kr").toLowerCase(); // "kr" | "cn"
  btnKR?.classList.toggle("active", lang === "kr");
  btnCN?.classList.toggle("active", lang === "cn");

  // 접근성
  document.documentElement.lang = lang === "kr" ? "ko" : "zh-CN";
}

function applyI18n(rootEl) {
  if (!rootEl) return;
  try {
    // rootEl 범위만 apply (안정 + 성능)
    i18n?.apply?.(rootEl);
  } catch {}
  syncLangButtons(rootEl);
  setActive(rootEl);
}

// ---------- global single-bind (중복 방지) ----------
let globalBound = false;
let lastRootEl = null;

function bindGlobalOnce() {
  if (globalBound) return;
  globalBound = true;

  // hash 변경 시: 마지막으로 mount 된 rootEl 에 active 적용
  window.addEventListener("hashchange", () => {
    if (lastRootEl) setActive(lastRootEl);
  });

  // i18n 변경 시: 마지막으로 mount 된 rootEl 에 apply
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

// ---------- mount ----------
export function mountNavBar(rootEl) {
  if (!rootEl) return;

  // 전역 이벤트는 한 번만
  bindGlobalOnce();

  // 기록: hash/i18n 이벤트는 항상 최신 rootEl에 적용
  lastRootEl = rootEl;

  // ✅ 防重复挂载
  if (rootEl.dataset.mounted === "1") {
    applyI18n(rootEl);
    return;
  }
  rootEl.dataset.mounted = "1";

  // ✅ 首次默认路由
  if (!location.hash) location.hash = "#home";

  // ✅ 渲染壳：topbar + nav 容器
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

    <!-- ✅ 关键：class="site-nav" 让 base.css 生效 -->
    <nav class="site-nav" aria-label="Primary"></nav>
  `;

  // ✅ 渲染导航链接
  const nav = rootEl.querySelector("nav.site-nav");
  NAV_ITEMS.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;
    a.setAttribute("data-nav", "1");
    a.setAttribute("data-i18n", it.key);
    a.textContent = t(it.key, it.label);
    nav.appendChild(a);
  });

  // ✅ 点击导航：更快刷新 active（hashchange 也会触发，这里是即时体验）
  nav.addEventListener("click", (e) => {
    const a = e.target.closest('a[data-nav="1"]');
    if (!a) return;
    setTimeout(() => setActive(rootEl), 0);
  });

  // ✅ 语言按钮
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

  // ✅ 首次应用
  applyI18n(rootEl);
}
