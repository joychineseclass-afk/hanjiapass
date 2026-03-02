// ui/router.js
const ROUTES = new Map();

/** 注册路由：hash 形如 "#home"、"#hsk" */
export function registerRoute(hash, loader) {
  if (!hash.startsWith("#")) hash = "#" + hash;
  ROUTES.set(hash, loader);
}

/** 启动路由 */
export function startRouter() {
  const onRoute = async () => {
    const root = document.getElementById("app");
    if (!root) {
      console.error("[router] #app not found");
      return;
    }

    // 兼容 "#home?x=1" / "#home/xx"：只取前段
    const raw = location.hash || "#home";
    const key = raw.split("?")[0].split("/")[0];

    const loader = ROUTES.get(key);
    if (!loader) {
      root.innerHTML = `
        <div style="padding:16px;border:1px solid #e2e8f0;background:#fff;border-radius:14px;">
          <b>404 Route</b>
          <div style="color:#475569;margin-top:8px;">
            Unknown route: <code>${escapeHtml(key)}</code>
          </div>
        </div>
      `;
      console.warn("[router] no route for", key);
      return;
    }

    // Loading UI
    root.innerHTML = `
      <div style="padding:14px;border:1px solid #e2e8f0;background:#fff;border-radius:14px;">
        ⏳ <b>불러오는 중...</b> 페이지를 불러오는 중입니다.
      </div>
    `;

    try {
      const mod = await loader(); // dynamic import
      // 兼容多种导出
      const pageFn =
        mod?.default ||
        mod?.mount ||
        mod?.render ||
        mod?.run ||
        mod?.page;

      if (typeof pageFn !== "function") {
        throw new Error(
          `[router] Page module "${key}" has no callable export. ` +
          `Need default/mount/render/run/page function. Got: ${Object.keys(mod || {}).join(", ")}`
        );
      }

      // 传入 context（你页面模块用得上）
      const ctx = { root, hash: raw, route: key };
      await pageFn(ctx);

      console.log("[router] rendered:", key);
    } catch (err) {
      console.error("[router] route error:", key, err);
      root.innerHTML = `
        <div style="padding:16px;border:1px solid #e2e8f0;background:#fff;border-radius:14px;">
          <b style="display:block;margin-bottom:8px;">페이지 로딩 오류 (${escapeHtml(key)})</b>
          <div style="color:#475569;line-height:1.6;font-size:13px;">
            아래 오류를 확인해 주세요 (Console에도 출력됨).
            <pre style="white-space:pre-wrap;margin:10px 0 0;background:#f8fafc;padding:10px;border-radius:12px;border:1px solid #e2e8f0;">
${escapeHtml(String(err?.stack || err))}
            </pre>
          </div>
        </div>
      `;
    }
  };

  window.addEventListener("hashchange", onRoute);
  onRoute(); // ✅ 매우 중요: 시작하자마자 1회 렌더
}

/* utils */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
