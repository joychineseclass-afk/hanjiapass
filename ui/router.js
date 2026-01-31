// /ui/router.js
// - hash -> page module
// - 保证：重复切换不报错、不重复绑定
// - 支持：页面模块的 mount/unmount（以后扩展不返工）

const routes = new Map(); // hash -> loader()

let current = {
  hash: "",
  unmount: null,
};

function normalizeHash(h) {
  if (!h) return "#home";
  return h.startsWith("#") ? h : `#${h}`;
}

export function registerRoute(hash, loader) {
  routes.set(normalizeHash(hash), loader);
}

export async function navigate(hash) {
  const h = normalizeHash(hash);

  // 同一个 hash 不重复处理
  if (current.hash === h) return;

  // 先卸载旧页面（如果提供）
  try {
    if (typeof current.unmount === "function") current.unmount();
  } catch (e) {
    console.warn("unmount failed:", e);
  }

  current.hash = h;
  current.unmount = null;

  const loader = routes.get(h) || routes.get("#home");
  if (!loader) return;

  try {
    const mod = await loader(); // { mount, unmount }
    if (typeof mod?.mount === "function") {
      const maybeUnmount = await mod.mount();
      // mount 可以 return unmount
      if (typeof maybeUnmount === "function") current.unmount = maybeUnmount;
      else if (typeof mod?.unmount === "function") current.unmount = mod.unmount;
    }
  } catch (e) {
    console.error("Route load failed:", e);
    // 兜底：回到 home
    if (h !== "#home") {
      location.hash = "#home";
    }
  }
}

export function startRouter() {
  window.addEventListener("hashchange", () => navigate(location.hash));
  // 初次进入
  if (!location.hash) location.hash = "#home";
  navigate(location.hash);
}
