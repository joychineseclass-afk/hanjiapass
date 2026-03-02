// /ui/router.js
// ✅ STABLE HASH ROUTER
// - registerRoute(hash, loader)
// - startRouter({ defaultHash, appId, scrollTop })
// - supports page exports: mount/init/default/render
// ✅ Extra:
// - navigateTo(hash, { force:true }) will re-render even if hash unchanged
// - mount timeout protection (optional)
// - emits i18n "route" event for navbar highlight

const ROUTES = new Map();

let started = false;
let currentHash = "";
let currentModule = null;
let navToken = 0;

// keep last start context so we can force rerender
let _appEl = null;
let _defaultHash = "#home";
let _scrollTop = true;

function $(id) {
  return document.getElementById(id);
}

function normalizeHash(h) {
  if (!h) return "";
  const s = String(h).trim();

  // remove query
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
  try { window.i18n?.emit?.("route"); } catch {}
}

function scrollToTopSafe() {
  try { window.scrollTo({ top: 0, behavior: "smooth" }); }
  catch { window.scrollTo(0, 0); }
}

function setLoadingUI(appEl, text = "Loading...") {
  if (!appEl) return;
  appEl.innerHTML = `
    <div class="card">
      <div class="hero">
        <div class="title">⏳ ${escapeHtml(text)}</div>
        <p class="desc">페이지를 불러오는 중입니다.</p>
      </div>
    </div>
  `;
}

function setErrorUI(appEl, title, detail) {
  if (!appEl) return;

  const detailText = detail ? String(detail) : "";
  appEl.innerHTML = `
    <div class="card">
      <div class="hero">
        <div class="title">⚠️ ${escapeHtml(title || "오류")}</div>
        <p class="desc" style="white-space:pre-wrap">${escapeHtml(detailText)}</p>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <button id="rtRetry" type="button" class="badge">다시 시도</button>
          <button id="rtHome" type="button" class="badge">홈으로</button>
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
  setErrorUI(
    appEl,
    "페이지가 없어요",
    `등록되지 않은 경로입니다: ${hash}\n(메뉴에서 다시 선택해 주세요.)`
  );
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

// ✅ IMPORTANT: force rerender even when hash is same
export function navigateTo(hash, opts = {}) {
  const h = normalizeHash(hash);
  if (!h) return;

  const { force = false } = opts;
  const cur = normalizeHash(location.hash);

  // same hash
  if (cur === h) {
    if (force && started && _appEl) {
      // do not rely on hashchange, call handler directly
      handleRouteChange({ appEl: _appEl, defaultHash: _defaultHash, scrollTop: _scrollTop, force: true });
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

  if (!location.hash) location.hash = _defaultHash;

  window.addEventListener("hashchange", () => {
    handleRouteChange({ appEl: _appEl, defaultHash: _defaultHash, scrollTop: _scrollTop });
  });

  handleRouteChange({ appEl: _appEl, defaultHash: _defaultHash, scrollTop: _scrollTop });
}

export const initRouter = startRouter;

async function handleRouteChange({ appEl, defaultHash, scrollTop, force = false }) {
  const token = ++navToken;

  let hash = normalizeHash(location.hash);
  if (!hash) {
    location.hash = defaultHash;
    hash = normalizeHash(defaultHash);
  }

  // ✅ same route: only skip when not forced
  if (!force && hash === currentHash) {
    emitRouteEvent();
    return;
  }

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

  try {
    const mod = await loader();
    if (token !== navToken) return;

    currentModule = mod || null;

    const ctx = {
      root: appEl,
      hash,
      route: hash.replace(/^#/, ""),
      token,
    };

    const run = async () => {
      if (typeof mod?.mount === "function") return mod.mount(ctx);
      if (typeof mod?.init === "function") return mod.init(ctx);
      if (typeof mod?.default === "function") return mod.default(ctx);
      if (typeof mod?.render === "function") return mod.render(ctx);
      throw new Error(`Page module "${hash}" must export mount/init/default/render`);
    };

    // optional: timeout to avoid infinite loading
    const MOUNT_TIMEOUT_MS = 8000;

await Promise.race([
  Promise.resolve(run()),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`mount timeout (${MOUNT_TIMEOUT_MS}ms)`)), MOUNT_TIMEOUT_MS)
  )
]);

    emitRouteEvent();
  } catch (e) {
    console.error("[router] page load error:", e);
    if (token !== navToken) return;
    setErrorUI(appEl, "페이지 로드 실패", e?.stack || e?.message || String(e));
  }
}
