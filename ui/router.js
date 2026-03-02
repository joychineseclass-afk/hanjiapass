// /ui/router.js
// ✅ STABLE ROUTER (hash-based)
// - registerRoute(hash, loader)
// - startRouter({ defaultHash, appId, scrollTop })
// - supports mount()/unmount() in page modules
// - concurrent-safe (latest navigation wins)
// - emits i18n "route" event for navbar highlight
// ✅ Enhanced:
// - pass ctx to page: { root, hash, route }
// - supports mount/init/default/render exports
// - better hash normalize: "#home?x=1" "#home/abc" -> "#home"
// - error UI shows stack/message
// ✅ Debug logs included (safe)

const ROUTES = new Map();

let started = false;
let currentHash = "";
let currentModule = null;
let navToken = 0;

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

  // only keep first segment: "#home/xx" -> "#home"
  const slash = withHash.indexOf("/", 1);
  const pure = slash > 0 ? withHash.slice(0, slash) : withHash;

  return pure;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
    console.log("[router] unmount start");
    await Promise.race([
      Promise.resolve(mod.unmount()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("unmount timeout (600ms)")), 600)
      )
    ]);
    console.log("[router] unmount done");
  } catch (e) {
    console.warn("[router] unmount error:", e);
  }
}

function emitRouteEvent() {
  try {
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

export function navigateTo(hash, opts = {}) {
  const h = normalizeHash(hash);
  if (!h) return;

  const { force = false } = opts;
  if (!force && normalizeHash(location.hash) === h) return;

  location.hash = h;

  // ✅ 关键：如果 hash 没变化（例如 force），手动触发一次路由处理
  if (force) {
    // 让 hashchange 有机会触发；如果浏览器不触发，我们也能靠下面的回调跑一次
    queueMicrotask(() => {
      // startRouter 里会绑定 listener，因此这里只改 hash 即可
    });
  }
}

export function startRouter(opts = {}) {
  if (started) return;
  started = true;

  const {
    defaultHash = "#home",
    appId = "app",
    scrollTop = true,
  } = opts;

  const appEl = $(appId);
  if (!appEl) {
    console.error(`[router] missing app container #${appId}`);
    return;
  }

  if (!location.hash) location.hash = defaultHash;

  window.addEventListener("hashchange", () => {
    console.log("[router] hashchange:", location.hash);
    handleRouteChange({ appEl, defaultHash, scrollTop });
  });

  // ✅ 首次进入也跑一次
  console.log("[router] start:", location.hash);
  handleRouteChange({ appEl, defaultHash, scrollTop });
}

export const initRouter = startRouter;

async function handleRouteChange({ appEl, defaultHash, scrollTop }) {
  console.log("[router] enter:", location.hash);

  const token = ++navToken;

  let hash = normalizeHash(location.hash);
  if (!hash) {
    location.hash = defaultHash;
    hash = normalizeHash(defaultHash);
  }

  // 同路由不重复处理（但仍 emit）
  if (hash === currentHash) {
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

    if (typeof mod?.mount === "function") {
      await mod.mount(ctx);
    } else if (typeof mod?.init === "function") {
      await mod.init(ctx);
    } else if (typeof mod?.default === "function") {
      await mod.default(ctx);
    } else if (typeof mod?.render === "function") {
      await mod.render(ctx);
    } else {
      throw new Error(
        `Page module "${hash}" must export mount/init/default/render. ` +
        `Exports: ${Object.keys(mod || {}).join(", ")}`
      );
    }

    emitRouteEvent();
  } catch (e) {
    console.error("[router] page load error:", e);
    if (token !== navToken) return;

    const msg = e?.stack || e?.message || String(e);
    setErrorUI(appEl, "페이지 로드 실패", msg);
  }
}
