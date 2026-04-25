/**
 * Supabase 单例。环境变量未配置时返回 null，由调用方回退到 demo auth。
 * 支持：Vite `import.meta.env`、Node `process.env`、浏览器 `globalThis.__LUMINA_ENV__`（静态 HTML 可在 app 前注入）。
 *
 * ⚠️ 纯静态部署：浏览器原生 ESM 无法解析裸模块名 `@supabase/supabase-js`，
 *   必须依赖 `index.html` 中的 `<script type="importmap">` 把它映射到 CDN。
 *   这里改成「仅在 env 完整且未强制 demo 时才动态 import」，
 *   避免 demo 路径下每次开页都白白下载 ~100KB 的 supabase-js。
 */

let _warnedMissing = false;
let _client = /** @type {import("@supabase/supabase-js").SupabaseClient | null} */ (null);
let _resolvedNull = false;
let _prodDemoFlagWarned = false;
let _prodMissingSupaWarned = false;
let _createClientLoadFailed = false;

/**
 * @param {string} key
 * @returns {string}
 */
function readEnvString(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key] != null) {
      return String(import.meta.env[key] || "").trim();
    }
  } catch {
    /* */
  }
  try {
    if (typeof process !== "undefined" && process.env && process.env[key] != null) {
      return String(process.env[key] || "").trim();
    }
  } catch {
    /* */
  }
  try {
    const g = globalThis;
    if (g && g.__LUMINA_ENV__ && typeof g.__LUMINA_ENV__ === "object" && g.__LUMINA_ENV__[key] != null) {
      return String(/** @type {Record<string, unknown>} */ (g.__LUMINA_ENV__)[key] || "").trim();
    }
  } catch {
    /* */
  }
  return "";
}

/**
 * 将 Vercel / Dashboard 里粘贴的 Project URL 规范为 `https://<ref>.supabase.co`（无尾斜杠、无意外路径），
 * 避免 `/auth/v1/token` 拼成 404 或 `//auth`。
 * @param {string} raw
 * @returns {string}
 */
function normalizeSupabaseProjectUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) {
    return "";
  }
  s = s.replace(/\/+$/g, "");
  if (!/^https?:\/\//i.test(s)) {
    s = "https://" + s.replace(/^\/+/, "");
  }
  try {
    const u = new URL(s);
    if (u.host.endsWith("supabase.co") && u.pathname && u.pathname !== "/") {
      if (u.pathname.includes("dashboard") || u.pathname.length > 1) {
        console.warn(
          "[Lumina] VITE_SUPABASE_URL has a path; using origin only. Use Settings → API → Project URL (e.g. https://<ref>.supabase.co).",
        );
      }
      return u.origin;
    }
    if (u.pathname && u.pathname !== "/") {
      console.warn(
        "[Lumina] VITE_SUPABASE_URL includes a path; if auth 404, set it to the API origin only (no /project/...).",
      );
    }
    return u.origin + (u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/+$/g, "") : "");
  } catch {
    return "";
  }
}

/**
 * 是否显式仅使用本地 demo 认证（即使已配置 Supabase URL key）。
 * `VITE_LUMINA_AUTH_USE_DEMO=1` 或 `__LUMINA_ENV__` 同 key。
 */
export function isAuthDemoForced() {
  const v = readEnvString("VITE_LUMINA_AUTH_USE_DEMO");
  return v === "1" || v === "true" || v === "yes";
}

/**
 * @returns {{ url: string, anonKey: string, isComplete: boolean }}
 */
export function getSupabaseEnv() {
  const url = normalizeSupabaseProjectUrl(readEnvString("VITE_SUPABASE_URL"));
  const anonKey = readEnvString("VITE_SUPABASE_ANON_KEY");
  return {
    url,
    anonKey,
    isComplete: Boolean(url && anonKey),
  };
}

/**
 * 在浏览器/部署中尽量识别「类生产」环境（无打包时 Vite PROD 可能为 false，故补充 Vercel 等信号）。
 * @returns {boolean}
 */
export function isLikelyProductionRuntime() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      if (import.meta.env.PROD === true) {
        return true;
      }
      if (import.meta.env.MODE === "production") {
        return true;
      }
    }
  } catch {
    /* */
  }
  if (readEnvString("VERCEL_ENV") === "production") {
    return true;
  }
  try {
    if (typeof process !== "undefined" && process.env) {
      if (process.env.NODE_ENV === "production") {
        return true;
      }
    }
  } catch {
    /* */
  }
  if (readEnvString("LUMINA_FORCE_PROD") === "1" || readEnvString("LUMINA_DEPLOYMENT_TIER") === "production") {
    return true;
  }
  return false;
}

/**
 * 当前页是否并非 localhost/127.0.0.1（典型：Vercel Preview/Production 静态托管）。
 * 与 `isLikelyProductionRuntime` 组合用于纯静态、无 Vite 注入时的风险提示。
 * @returns {boolean}
 */
export function isNonLocalhostDeployment() {
  try {
    if (typeof location === "undefined") {
      return false;
    }
    const h = String(location.hostname || "");
    if (!h) {
      return false;
    }
    if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 配置缺失时最多警告一次，便于与 demo 回退排障。
 */
export function warnIfSupabaseEnvMissing() {
  if (isAuthDemoForced()) {
    return;
  }
  const { isComplete } = getSupabaseEnv();
  if (isComplete || _warnedMissing) {
    return;
  }
  _warnedMissing = true;
  const prodish = isLikelyProductionRuntime() || isNonLocalhostDeployment();
  const prefix = prodish ? "[Lumina] DEPLOY: " : "[Lumina] ";
  console.warn(
    `${prefix}Supabase env missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Falling back to demo local auth — not for real accounts. Set env, Vercel project vars, or window.__LUMINA_ENV__ for real sign-in.`
  );
}

/**
 * @type {Promise<((url: string, anonKey: string, opts?: object) => import("@supabase/supabase-js").SupabaseClient) | null> | null}
 */
let _createClientPromise = null;

/**
 * 仅在确实需要时按需 import 真正的 supabase-js（依赖 importmap 把裸名解析到 CDN）。
 * 失败时缓存 null，避免反复网络请求。
 * @returns {Promise<((url: string, anonKey: string, opts?: object) => import("@supabase/supabase-js").SupabaseClient) | null>}
 */
function loadCreateClient() {
  if (_createClientPromise) {
    return _createClientPromise;
  }
  _createClientPromise = import("@supabase/supabase-js")
    .then((m) => {
      const fn = /** @type {any} */ (m).createClient;
      if (typeof fn !== "function") {
        _createClientLoadFailed = true;
        console.warn("[Lumina] @supabase/supabase-js loaded but createClient missing.");
        return null;
      }
      return fn;
    })
    .catch((e) => {
      _createClientLoadFailed = true;
      console.warn(
        "[Lumina] Failed to dynamically import @supabase/supabase-js (check <importmap> in index.html / network):",
        e?.message || e,
      );
      return null;
    });
  return _createClientPromise;
}

export async function prepareSupabaseClient() {
  if (isAuthDemoForced()) {
    return null;
  }
  if (_client) {
    return _client;
  }
  if (_resolvedNull) {
    return null;
  }
  const { url, anonKey, isComplete } = getSupabaseEnv();
  if (!isComplete) {
    _resolvedNull = true;
    warnIfSupabaseEnvMissing();
    return null;
  }
  const create = await loadCreateClient();
  if (!create) {
    _resolvedNull = true;
    return null;
  }
  if (_client) {
    return _client;
  }
  _client = create(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

/**
 * 等待 Client 创建完成（signUp / ensure 前务必使用，避免同步 getSupabase() 仍 null）。
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient | null>}
 */
export async function getSupabaseClientReady() {
  await prepareSupabaseClient();
  return getSupabase();
}

/**
 * 懒加载单例。未配置或强制 demo 时返回 null（禁止 createClient 空 URL）。
 * 注：当 env 完整但 supabase-js 尚未异步下载完时，首次同步调用会先返回 null 并触发后台加载，
 *   下一次同步调用（或调用方在 `joy:authChanged` 等事件后重试）即可拿到真实 client。
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function getSupabase() {
  if (isAuthDemoForced()) {
    return null;
  }
  if (_client) {
    return _client;
  }
  if (_resolvedNull) {
    return null;
  }
  const { isComplete } = getSupabaseEnv();
  if (!isComplete) {
    _resolvedNull = true;
    warnIfSupabaseEnvMissing();
    return null;
  }
  if (_createClientLoadFailed) {
    return null;
  }
  void prepareSupabaseClient();
  return _client;
}

/**
 * 若已懒创建则返回，否则不强制创建（供探测）。
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function getSupabaseIfReady() {
  if (_client) return _client;
  if (_resolvedNull) return null;
  return getSupabase();
}

/**
 * 公开部署/生产下关于 demo / 未配置 Supabase 的显式风险警告（不拦截页面，仅 console）。
 * 在 authStore 与模块 init 中调用一次即可。
 */
export function warnIfProductionAuthMisconfiguration() {
  const isProdish = isLikelyProductionRuntime() || isNonLocalhostDeployment();
  if (!isProdish) {
    return;
  }
  if (isAuthDemoForced() && !_prodDemoFlagWarned) {
    _prodDemoFlagWarned = true;
    console.warn(
      "[Lumina] DEPLOY: VITE_LUMINA_AUTH_USE_DEMO is set. This forces browser-only demo auth. Do not onboard real users. Remove this flag in Vercel Production after Supabase is configured."
    );
  }
  if (!isAuthDemoForced() && !getSupabaseEnv().isComplete && !_prodMissingSupaWarned) {
    _prodMissingSupaWarned = true;
    console.warn(
      "[Lumina] DEPLOY: No Supabase URL/anon key configured. App uses localStorage demo users — not cross-device, not suitable as real account system. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (Production / Preview) or window.__LUMINA_ENV__ before GA."
    );
  }
}
