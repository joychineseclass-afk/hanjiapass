// /ui/router.js
// ✅ Production-grade hash router
// ✅ Loading/error UI 使用 i18n（需在 app 中先 init i18n）
// - registerRoute(hash, loader)
// - startRouter({ defaultHash, appId, scrollTop })
// - page module exports: mount/init/default/render (any one)
// - navigateTo(hash, { force:true }) to re-render even if hash unchanged
// ✅ Production fixes:
// - NO hard Promise.race reject for mount (prevents "need refresh" / stuck loading)
// - Soft timeout: show "slow loading" hint but keep awaiting
// - Concurrent-safe: latest navigation wins
// - Robust initial render: always renders once on start (no reliance on hashchange)

const ROUTES = new Map();

let started = false;
let currentHash = "";
let currentModule = null;
let navToken = 0;

// keep last start context so we can force re-render without hashchange
let _appEl = null;
let _defaultHash = "#home";
let _scrollTop = true;
let _hashDebounceTimer = null;

function $(id) {
  return document.getElementById(id);
}

function normalizeHash(h) {
  if (!h) return "";
  const s = String(h).trim();

  // remove query: "#home?a=1" -> "#home"
  const q = s.indexOf("?");
  const noQuery = q >= 0 ? s.slice(0, q) : s;

  // ensure starts with #
  const withHash = noQuery.startsWith("#") ? noQuery : `#${noQuery}`;

  // keep only first segment: "#home/xx" -> "#home"
  const slash = withHash.indexOf("/", 1);
  return slash > 0 ? withHash.slice(0, slash) : withHash;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function emitRouteEvent() {
  try {
    // navBar.js can listen to this to update active state
    window.i18n?.emit?.("route");
  } catch {}
}

function scrollToTopSafe() {
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }
}

function setLoadingUI(appEl, text) {
  if (!appEl) return;
  const loadingText = text || (typeof window?.i18n?.t === "function" ? window.i18n.t("common.loading") : null) || "Loading...";
  const descText = (typeof window?.i18n?.t === "function" ? window.i18n.t("router.loading_desc") : null) || "Loading page...";
  const slowHint = (typeof window?.i18n?.t === "function" ? window.i18n.t("router.slow_hint") : null) || "Network or first load may take a moment...";
  appEl.innerHTML = `
    <div class="card">
      <div class="hero">
        <div class="title">⏳ ${escapeHtml(loadingText)}</div>
        <p class="desc">${escapeHtml(descText)}</p>
        <p id="rtSlowHint" class="desc" style="display:none; margin-top:8px;">
          ${escapeHtml(slowHint)}
        </p>
      </div>
    </div>
  `;
}

function showSlowHint(appEl) {
  try {
    appEl?.querySelector?.("#rtSlowHint")?.style?.setProperty("display", "block");
  } catch {}
}

function setErrorUI(appEl, title, detail) {
  if (!appEl) return;

  const i18n = window.i18n;
  const titleText = title || (i18n?.t?.("router.error_title")) || "Error";
  const retryText = (i18n?.t?.("router.retry")) || "Retry";
  const homeText = (i18n?.t?.("router.home")) || "Home";

  const detailText = detail ? String(detail) : "";
  appEl.innerHTML = `
    <div class="card">
      <div class="hero">
        <div class="title">⚠️ ${escapeHtml(titleText)}</div>
        <p class="desc" style="white-space:pre-wrap">${escapeHtml(detailText)}</p>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <button id="rtRetry" type="button" class="badge">${escapeHtml(retryText)}</button>
          <button id="rtHome" type="button" class="badge">${escapeHtml(homeText)}</button>
        </div>
      </div>
    </div>
  `;

  appEl.querySelector("#rtRetry")?.addEventListener("click", () => {
    navigateTo(location.hash || "#home", { force: true });
  });
  appEl.querySelector("#rtHome")?.addEventListener("click", () => {
    navigateTo("#home", { force: true });
  });
}

function setNotFoundUI(appEl, hash) {
  const i18n = window.i18n;
  const titleText = (i18n?.t?.("router.not_found_title")) || "Page not found";
  const descText = (i18n?.t?.("router.not_found_desc")) || "This route is not registered.";
  setErrorUI(appEl, titleText, `${descText}: ${hash}`);
}

async function safeUnmountCurrent() {
  const mod = currentModule;
  currentModule = null;
  if (!mod?.unmount) return;

  try {
    await Promise.resolve(mod.unmount());
  } catch (e) {
    console.warn("[router] unmount error:", e);
  }
}

export function registerRoute(hash, loader) {
  const h = normalizeHash(hash);
  if (!h) throw new Error("registerRoute: hash is required");
  if (typeof loader !== "function") throw new Error("registerRoute: loader must be a function");
  ROUTES.set(h, loader);
}

export function hasRoute(hash) {
  return ROUTES.has(normalizeHash(hash));
}

export function getCurrentRoute() {
  return currentHash || normalizeHash(location.hash) || "";
}

// ✅ force rerender even when hash is same
export function navigateTo(hash, opts = {}) {
  const h = normalizeHash(hash);
  if (!h) return;

  const { force = false } = opts;
  const cur = normalizeHash(location.hash);

  if (cur === h) {
    if (force && started && _appEl) {
      // call handler directly (do not rely on hashchange)
      handleRouteChange({
        appEl: _appEl,
        defaultHash: _defaultHash,
        scrollTop: _scrollTop,
        force: true,
      });
    }
    return;
  }

  location.hash = h;
}

export function startRouter(opts = {}) {
  if (started) return;
  started = true;

  const { defaultHash = "#home", appId = "app", scrollTop = true } = opts;

  const appEl = $(appId);
  if (!appEl) {
    console.error(`[router] missing app container #${appId}`);
    return;
  }

  _appEl = appEl;
  _defaultHash = normalizeHash(defaultHash) || "#home";
  _scrollTop = !!scrollTop;

  window.addEventListener("hashchange", () => {
    clearTimeout(_hashDebounceTimer);
    _hashDebounceTimer = setTimeout(() => {
      handleRouteChange({
        appEl: _appEl,
        defaultHash: _defaultHash,
        scrollTop: _scrollTop,
      });
    }, 50);
  });

  if (!location.hash) location.hash = _defaultHash;

  // ✅ Always render once on start (do not rely on hashchange)
  queueMicrotask(() => {
    handleRouteChange({
      appEl: _appEl,
      defaultHash: _defaultHash,
      scrollTop: _scrollTop,
      force: true, // initial render should run even if currentHash matches (e.g., hot reload)
    });
  });
}

export const initRouter = startRouter;

async function handleRouteChange({ appEl, defaultHash, scrollTop, force = false }) {
  let hash = normalizeHash(location.hash);
  if (!hash) {
    location.hash = defaultHash;
    hash = normalizeHash(defaultHash);
  }

  // Same route: skip when page already rendered (avoid first-load stuck + duplicate render from hashchange + microtask)
  const html = appEl?.innerHTML || "";
  const isLoading = html.includes("불러오는 중") || html.includes("Loading");
  const isEmpty = html.trim().length === 0;
  if (hash === currentHash && !isLoading && !isEmpty) {
    if (!force) {
      emitRouteEvent();
      return;
    }
    // force: true but already rendered same route → skip to avoid double mount (e.g. startRouter microtask after hashchange)
    emitRouteEvent();
    return;
  }

  const token = ++navToken;

  currentHash = hash;
  emitRouteEvent();

  const loader = ROUTES.get(hash);
  if (!loader) {
    await safeUnmountCurrent();
    setNotFoundUI(appEl, hash);
    if (scrollTop) scrollToTopSafe();
    return;
  }

  setLoadingUI(appEl, "불러오는 중...");
  if (scrollTop) scrollToTopSafe();

  await safeUnmountCurrent();
  if (token !== navToken) return;

  // ✅ soft timeout (no reject!)
  const SLOW_HINT_MS = 1200;
  let slowTimer = setTimeout(() => {
    // only show hint if still on same navigation
    if (token === navToken) showSlowHint(appEl);
  }, SLOW_HINT_MS);

  try {
    // 1) load module
    const mod = await Promise.resolve(loader());
    if (token !== navToken) return;

    currentModule = mod || null;

    const ctx = {
      root: appEl,
      hash,
      route: hash.replace(/^#/, ""),
      token,
    };

    // 2) run page
    const run = () => {
      if (typeof mod?.mount === "function") return mod.mount(ctx);
      if (typeof mod?.init === "function") return mod.init(ctx);
      if (typeof mod?.default === "function") return mod.default(ctx);
      if (typeof mod?.render === "function") return mod.render(ctx);
      throw new Error(`Page module "${hash}" must export mount/init/default/render`);
    };

    await Promise.resolve(run());

    // 3) final
    if (token !== navToken) return;
    emitRouteEvent();
  } catch (e) {
    console.error("[router] page load error:", e);
    if (token !== navToken) return;
    setErrorUI(appEl, "페이지 로드 실패", e?.stack || e?.message || String(e));
  } finally {
    clearTimeout(slowTimer);
  }
}
