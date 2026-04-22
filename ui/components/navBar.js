// /ui/components/navBar.js ✅ HYBRID PROD (FINAL)
// - MPA: /pages/*.html
// - Home: /index.html#home (hash router)
// - On index: clicking Home forces router re-render (no refresh)
// - On other pages: allow normal navigation to /index.html#home
// - Adds: Login button (로그인)
// - Keeps: i18n apply + active highlight + lang buttons

import { i18n } from "../i18n.js";

// ✅ SPA 路由：全部使用 hash 路由，不再跳转 /pages/*.html
// 正式路由顺序：Home, HSK, Kids, Business, Travel, Culture, Speaking, Stroke, Hanja, Review, Resources, Teacher
const NAV_ITEMS_FULL = [
  { href: "/index.html#home",     key: "nav.home",      label: "홈",            color: "#3b82f6" },
  { href: "/index.html#hsk",     key: "nav.hsk",       label: "HSK 학습",      color: "#22c55e" },
  { href: "/index.html#kids",    key: "nav.kids",      label: "어린이",        color: "#ec4899" },
  { href: "/index.html#business", key: "nav.business", label: "비즈니스",      color: "#0ea5e9" },
  { href: "/index.html#travel",  key: "nav.travel",     label: "여행중국어",    color: "#06b6d4" },
  { href: "/index.html#culture", key: "nav.culture",   label: "문화",          color: "#eab308" },
  { href: "/index.html#speaking", key: "nav.speaking", label: "회화",          color: "#ef4444" },
  { href: "/index.html#stroke",  key: "nav.stroke",    label: "한자 필순",     color: "#f97316" },
  { href: "/index.html#hanja",   key: "nav.hanjagongfu", label: "한자공부",    color: "#a855f7" },
  { href: "/index.html#review",  key: "nav.review",    label: "복습",          color: "#8b5cf6" },
  { href: "/index.html#resources", key: "nav.resources", label: "자료",      color: "#10b981" },
  { href: "/index.html#teacher", key: "nav.teacher",   label: "교사 워크스페이스",  color: "#f43f5e" },
  { href: "/index.html#my",      key: "nav.my",        label: "내 학습",       color: "#64748b" },
  { href: "/index.html#my-content", key: "learner.nav.my_content", label: "My content", color: "#0d9488" },
  { href: "/index.html#my-orders", key: "learner.nav.my_orders", label: "My orders", color: "#14b8a6" },
];

// ✅ 로그인 링크（你可改成 /login 或 /pages/login.html）
const LOGIN_HREF = "/pages/login.html";

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

    // ✅ 首页：path 匹配 + hash 匹配（有 hash 的话）
    if (navPath.endsWith("/index.html") && (curPath === "/" || curPath.endsWith("/index.html"))) {
      const wantHash = toHash ? `#${toHash}` : "";
      const teacherHashes = new Set(["#teacher", "#teacher-materials", "#teacher-courses", "#teacher-assets", "#lumina-teacher-stage0"]);
      if (wantHash === "#teacher") {
        active = teacherHashes.has(curHash);
      } else {
        active = wantHash ? curHash === wantHash : true;
      }
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
  const btnEN = rootEl.querySelector("#btnEN");
  const btnJP = rootEl.querySelector("#btnJP");
  const lang = (i18n?.getLang?.() || "ko").toLowerCase();
  const canon = lang === "zh" || lang === "cn" ? "zh" : lang === "en" ? "en" : lang === "jp" ? "jp" : "ko";

  btnKR?.classList.toggle("active", canon === "ko" || canon === "kr");
  btnCN?.classList.toggle("active", canon === "zh");
  btnEN?.classList.toggle("active", canon === "en");
  btnJP?.classList.toggle("active", canon === "jp");

  document.documentElement.lang = canon === "ko" || canon === "kr" ? "ko" : canon === "zh" ? "zh-CN" : canon === "jp" ? "ja" : "en";
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

  // ✅ navbar highlight update hooks
  try { i18n?.on?.("change", () => { if (lastRootEl) applyI18n(lastRootEl); }); } catch {}
  try { i18n?.onChange?.(() => { if (lastRootEl) applyI18n(lastRootEl); }); } catch {}
}

/**
 * ✅ Force router rerender on index without refresh
 * - tries: import router + navigateTo('#home', {force:true})
 * - fallback: hash jitter
 */
async function forceHomeOnIndex(rootEl) {
  if (!isIndexPage()) return;

  // 1) try router.navigateTo(force)
  try {
    const r = await import("/ui/router.js");
    if (typeof r?.navigateTo === "function") {
      r.navigateTo("#home", { force: true });
      setActive(rootEl);
      return;
    }
  } catch {
    // ignore and fallback
  }

  // 2) fallback: hash jitter to trigger hashchange
  if (location.hash === "#home") {
    location.hash = "#__t";
    requestAnimationFrame(() => { location.hash = "#home"; });
  } else {
    location.hash = "#home";
  }
  setActive(rootEl);
}

function ensureNavStylesOnce() {
  if (document.getElementById("joy-navbar-style")) return;

  const style = document.createElement("style");
  style.id = "joy-navbar-style";
  style.textContent = `
    .topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 0 10px}
    .topbar .brand{display:flex;flex-direction:column;gap:2px}
    .topbar .brand a{font-weight:800;font-size:18px;letter-spacing:-.2px}
    .topbar .brand small{opacity:.7;font-size:12px}
    .topbar .right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .topbar .lang{display:flex;align-items:center;gap:6px}
    .topbar .lang button{border:1px solid rgba(148,163,184,.6);background:#fff;border-radius:12px;padding:6px 10px;cursor:pointer;font-weight:800;font-size:12px}
    .topbar .lang button.active{border-color:#2563eb;background:rgba(37,99,235,.08);color:#2563eb}
    .topbar .login a{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(148,163,184,.6);background:#fff;border-radius:12px;padding:6px 10px;font-weight:800;font-size:12px}
    .topbar .login a:hover{transform:translateY(-1px)}
    nav.site-nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    nav.site-nav a{padding:9px 12px;border-radius:999px;border:1px solid rgba(226,232,240,.9);background:#fff;font-weight:800;font-size:13px}
    nav.site-nav a.active{border-color:var(--navc,#2563eb);background:color-mix(in srgb, var(--navc,#2563eb) 12%, white)}
    nav.site-nav.mini{gap:6px}
    nav.site-nav.mini a{padding:8px 10px;font-size:12px}
  `;
  document.head.appendChild(style);
}

export function mountNavBar(rootEl) {
  if (!rootEl) return;

  ensureNavStylesOnce();
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
        <a href="/index.html#home" data-i18n="brand.name">Lumina Chinese Learning Center</a>
        <small data-i18n="brand.subtitle">AI-Powered Global Mandarin Education Platform</small>
      </div>

      <div class="right">
        <div class="lang" aria-label="Language switcher">
          <button id="btnKR" type="button" aria-label="Korean" data-lang="kr">KR</button>
          <button id="btnCN" type="button" aria-label="Chinese" data-lang="cn">CN</button>
          <button id="btnEN" type="button" aria-label="English" data-lang="en">EN</button>
          <button id="btnJP" type="button" aria-label="Japanese" data-lang="jp">JP</button>
        </div>

        <div class="login">
          <a href="${LOGIN_HREF}" data-i18n="nav_login">로그인</a>
        </div>
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

    // ✅ SPA 路由：在 index 页时，所有 hash 链接用 router 导航，避免整页刷新
    if (String(it.href || "").includes("/index.html#")) {
      a.addEventListener("click", (e) => {
        if (!isIndexPage()) return;
        const hash = (it.href || "").split("#")[1];
        if (!hash) return;
        e.preventDefault();
        import("/ui/router.js").then((r) => {
          r.navigateTo("#" + hash, { force: hash === "home" });
        }).catch(() => { location.href = it.href; });
        setActive(rootEl);
      });
    }

    nav.appendChild(a);
  });

  const langButtons = rootEl.querySelectorAll(".lang button[data-lang]");

  langButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lang = btn.getAttribute("data-lang") || "kr"; // kr | cn | en | jp
      try {
        await i18n?.setLang?.(lang);
      } catch {}
      applyI18n(rootEl);
    });
  });

  applyI18n(rootEl);
}
