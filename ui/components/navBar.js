// /ui/components/navBar.js  ✅融合升级不返工版（修复重复+更稳）
// - 渲染：topbar(brand+lang) + nav links（一次性挂载）
// - hash 自动高亮
// - i18n change 自动刷新文案 + 同步按钮状态
// - 兼容：拆分 HTML 之后的结构（rootEl 内部自己生成 topbar+nav）
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
  if (!h) return "#home";
  return h.startsWith("#") ? h : `#${h}`;
}

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    return (v && String(v).trim()) ? v : fallback;
  } catch {
    return fallback;
  }
}

function setActive(rootEl) {
  const current = normalizeHash(location.hash);
  rootEl.querySelectorAll('a[data-nav="1"]').forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === current);
  });
}

function syncLangButtons(rootEl) {
  const btnKR = rootEl.querySelector("#btnKR");
  const btnCN = rootEl.querySelector("#btnCN");

  const lang = (i18n?.getLang?.() || "kr").toLowerCase(); // "kr" | "cn"
  btnKR?.classList.toggle("active", lang === "kr");
  btnCN?.classList.toggle("active", lang === "cn");

  // <html lang="ko"> 같은 기본 접근성
  document.documentElement.lang = (lang === "kr") ? "ko" : "zh-CN";
}

function applyI18n(rootEl) {
  // 只对 rootEl apply，避免全站重复刷新（更稳）
  try { i18n?.apply?.(rootEl); } catch {}
  syncLangButtons(rootEl);
  setActive(rootEl);
}

function bindI18nChange(rootEl) {
  // ✅ 只绑定一次
  if (rootEl.dataset.i18nBound === "1") return;
  rootEl.dataset.i18nBound = "1";

  // ✅ 兼容两种：on("change") 或 onChange
  try { i18n?.on?.("change", () => applyI18n(rootEl)); } catch {}
  try { i18n?.onChange?.(() => applyI18n(rootEl)); } catch {}
}

function bindHashChange(rootEl) {
  // ✅ 只绑定一次
  if (rootEl.dataset.hashBound === "1") return;
  rootEl.dataset.hashBound = "1";

  window.addEventListener("hashchange", () => setActive(rootEl));
}

// ---------- mount ----------
export function mountNavBar(rootEl) {
  if (!rootEl) return;

  // ✅ 防重复挂载（避免刷新/多页重复 mount）
  if (rootEl.dataset.mounted === "1") {
    applyI18n(rootEl);
    return;
  }
  rootEl.dataset.mounted = "1";

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

    <nav class="site-nav" aria-label="Primary"></nav>
  `;

  // ✅ 渲染导航链接
  const nav = rootEl.querySelector("nav.site-nav");
  NAV_ITEMS.forEach((it) => {
    const a = document.createElement("a");
    a.href = it.href;                 // ✅ 用 hash 路由
    a.setAttribute("data-nav", "1");
    a.setAttribute("data-i18n", it.key);
    a.textContent = t(it.key, it.label); // ✅ i18n 优先，没 key 用 label
    nav.appendChild(a);
  });

  // ✅ 点击导航后：立刻刷新 active（hashchange 也会触发，但这里更快）
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

  // ✅ 首次默认路由
  if (!location.hash) location.hash = "#home";

  // ✅ 监听绑定（只绑定一次）
  bindHashChange(rootEl);
  bindI18nChange(rootEl);

  // ✅ 首次应用
  applyI18n(rootEl);
}
