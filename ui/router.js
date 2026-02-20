// /ui/router.js
// ✅ STABLE ROUTER (hash-based)
// - registerRoute(hash, loader)
// - startRouter({ defaultHash, appId, scrollTop })
// - supports mount()/unmount() in page modules
// - concurrent-safe (latest navigation wins)
// - emits i18n "route" event for navbar highlight

const ROUTES = new Map();

let started = false;
let currentHash = "";
let currentModule = null;     // 当前页面模块（用于 unmount）
let navToken = 0;             // 并发保护：只渲染最后一次导航

function $(id) {
  return document.getElementById(id);
}

function normalizeHash(h) {
  if (!h) return "";
  // 只取 #xxx 的部分，去掉后面的 query（如果未来你加 ?）
  const s = String(h).trim();
  const idx = s.indexOf("?");
  const pure = idx >= 0 ? s.slice(0, idx) : s;
  return pure.startsWith("#") ? pure : `#${pure}`;
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
  appEl.innerHTML = `
    <div class="card">
      <div class="hero">
        <div class="title">⚠️ ${escapeHtml(title || "오류")}</div>
        <p class="desc" style="white-space:pre-wrap">${escapeHtml(detail || "")}</p>
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

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function safeUnmountCurrent() {
  try {
    if (currentModule?.unmount) {
      await currentModule.unmount();
    }
  } catch (e) {
    // unmount 에러는 치명적이지 않게 무시
    console.warn("Router unmount error:", e);
  } finally {
    currentModule = null;
  }
}

function emitRouteEvent() {
  try {
    // 你之前 navBar.js 用 i18n.on("route") 来高亮
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

  if (!force && normalizeHash(location.hash) === h) {
    // 已经在这个 hash，不重复触发
    return;
  }
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
    console.error(`Router: missing app container #${appId}`);
    return;
  }

  // 初次没有 hash → 默认
  if (!location.hash) location.hash = defaultHash;

  // 绑定 hashchange
  window.addEventListener("hashchange", () => {
    handleRouteChange({ appEl, defaultHash, scrollTop });
  });

  // 首次进入也要跑一次
  handleRouteChange({ appEl, defaultHash, scrollTop });
}

// 兼容你之前写的 initRouter()
export const initRouter = startRouter;

async function handleRouteChange({ appEl, defaultHash, scrollTop }) {
  const token = ++navToken;

  let hash = normalizeHash(location.hash);
  if (!hash) {
    location.hash = defaultHash;
    hash = normalizeHash(defaultHash);
  }

  // 同路由不重复处理
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
  if (scrollTop) scrollToTopSafe();

  // 卸载旧页（先卸载，避免旧页事件残留）
  await safeUnmountCurrent();

  // 并发保护：如果用户切换很快，只渲染最后一次
  if (token !== navToken) return;

  try {
    const mod = await loader();

    // 又切路由了 → 放弃这次渲染
    if (token !== navToken) return;

    currentModule = mod || null;

    // ✅ 页面模块标准：mount() 必须存在
    if (typeof mod?.mount === "function") {
      await mod.mount();
    } else {
      // 允许旧页面模块叫 init()
      if (typeof mod?.init === "function") {
        await mod.init();
      } else {
        throw new Error("Page module must export mount() (or init())");
      }
    }

    // 渲染完再触发一次 route（确保 nav 高亮正确）
    emitRouteEvent();
  } catch (e) {
    console.error("Router page load error:", e);
    if (token !== navToken) return;
    setErrorUI(appEl, "페이지 로드 실패", e?.message || String(e));
  }
}
// -----------------------------
// hash router bindings (safe)
// -----------------------------
function getAppEl() {
  return (
    document.getElementById("app") ||
    document.querySelector("#app") ||
    document.querySelector("main") ||
    document.body
  );
}

function safeRoute() {
  try {
    const appEl = getAppEl();

    // 兼容两种签名：handleRouteChange({appEl}) 或 handleRouteChange(appEl)
    if (typeof handleRouteChange === "function") {
      // 如果你的 handleRouteChange 期望对象参数
      return handleRouteChange({ appEl, scrollTop: true });
      // 如果你确认它只要 appEl，把上面改成：
      // return handleRouteChange(appEl);
    }
  } catch (e) {
    console.error(e);
  }
}

window.addEventListener("hashchange", safeRoute);
window.addEventListener("popstate", safeRoute);

// first load
safeRoute();
