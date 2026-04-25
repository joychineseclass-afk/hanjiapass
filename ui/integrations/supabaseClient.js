/**
 * Supabase 单例。环境变量未配置时返回 null，由调用方回退到 demo auth。
 * 支持：Vite `import.meta.env`、Node `process.env`、浏览器 `globalThis.__LUMINA_ENV__`（静态 HTML 可在 app 前注入）。
 */
import { createClient } from "@supabase/supabase-js";

let _warnedMissing = false;
let _client = /** @type {import("@supabase/supabase-js").SupabaseClient | null} */ (null);
let _resolvedNull = false;

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
  const url = readEnvString("VITE_SUPABASE_URL");
  const anonKey = readEnvString("VITE_SUPABASE_ANON_KEY");
  return {
    url,
    anonKey,
    isComplete: Boolean(url && anonKey),
  };
}

/**
 * 配置缺失时最多警告一次，便于与 demo 回退排障。
 */
export function warnIfSupabaseEnvMissing() {
  if (isAuthDemoForced()) return;
  const { isComplete } = getSupabaseEnv();
  if (isComplete || _warnedMissing) return;
  _warnedMissing = true;
  console.warn(
    "[Lumina] Supabase: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. Using demo local auth. Set env or window.__LUMINA_ENV__ to enable cross-device sign-in."
  );
}

/**
 * 懒加载单例。未配置或强制 demo 时返回 null（禁止 createClient 空 URL）。
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
  const { url, anonKey, isComplete } = getSupabaseEnv();
  if (!isComplete) {
    _resolvedNull = true;
    warnIfSupabaseEnvMissing();
    return null;
  }
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
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
