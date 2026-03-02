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

const ROUTES = new Map();

let started = false;
let currentHash = "";
let currentModule = null; // 当前页面模块（用于 unmount）
let navToken = 0;         // 并发保护：只渲染最后一次导航

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
    // 强制重新导航当前 hash
    navigateTo(location.hash || "#home", { force: true });
  });

  appEl.querySelector("#rtHome")?.addEventListener("click", () => {
    location.hash = "#home";
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
  currentModule = null; // ✅ 先断开引用，避免重复 unmount

  if (!mod?.unmount) return;

  try {
    // ✅ 超时保护：最多等 600ms，防止卡死在 loading
    await Promise.race([
      Promise.resolve(mod.unmount()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("unmount timeout (600ms)")), 600)
      )
    ]);
  } catch (e) {
    console.warn("[router] unmount error:", e);
  }
}

function emitRouteEvent() {
  try {
    // navBar.js 用 i18n.on("route") 来高亮
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
}

// 主启动
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

  // 初次没有 hash → 默认
  if (!location.hash) location.hash = defaultHash;

  // 绑定 hashchange
  window.addEventListener("hashchange", () => {
  console.log("[router] hashchange:", location.hash);
  handleRouteChange({ appEl, defaultHash, scrollTop });
});
  
// 兼容旧写法：initRouter()
export const initRouter = startRouter;

async function handleRouteChange({ appEl, defaultHash, scrollTop }) {
  console.log("[router] handleRouteChange enter:", location.hash);
  const token = ++navToken;

  let hash = normalizeHash(location.hash);
  if (!hash) {
    location.hash = defaultHash;
    hash = normalizeHash(defaultHash);
  }

  // 同路由不重复处理（但仍 emit，确保 navbar 高亮）
  if (hash === currentHash) {
    emitRouteEvent();
    return;
  }

  currentHash = hash;
  emitRouteEvent();

  const loader = ROUTES.get(hash);

  // 404
  if (!loader) {
    await safeUnmountCurrent();
    setNotFoundUI(appEl, hash);
    if (scrollTop) scrollToTopSafe();
    return;
  }

  // loading
  setLoadingUI(appEl, "불러오는 중...");

console.log("[router] unmount start:", currentHash);
await safeUnmountCurrent();
console.log("[router] unmount done");

  // 并发保护：如果用户切换很快，只渲染最后一次
  if (token !== navToken) return;

  try {
    const mod = await loader();

    // 又切路由了 → 放弃这次渲染
    if (token !== navToken) return;

    currentModule = mod || null;

    // ✅ 给页面统一的 ctx
    const ctx = {
      root: appEl,
      hash,
      route: hash.replace(/^#/, ""),
      token,
    };

    // ✅ 支持多种导出（更不容易踩坑）
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
        `Page module "${hash}" must export mount()/init()/default()/render(). ` +
        `Exports: ${Object.keys(mod || {}).join(", ")}`
      );
    }

    // 渲染完再触发一次 route（确保 nav 高亮正确）
    emitRouteEvent();
  } catch (e) {
    console.error("[router] page load error:", e);
    if (token !== navToken) return;

    const msg = e?.stack || e?.message || String(e);
    setErrorUI(appEl, "페이지 로드 실패", msg);
  }
}
