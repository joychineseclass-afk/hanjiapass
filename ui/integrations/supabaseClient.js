/**
 * Supabase 单例。环境变量未配置时返回 null，由调用方回退到 demo auth。
 * 支持：Vite `import.meta.env`、Node `process.env`、浏览器 `globalThis.__LUMINA_ENV__`（静态 HTML 可在 app 前注入）。
 */
import { createClient } from "@supabase/supabase-js";

let _warnedMissing = false;
let _client = /** @type {import("@supabase/supabase-js").SupabaseClient | null} */ (null);
let _resolvedNull = false;
let _prodDemoFlagWarned = false;
let _prodMissingSupaWarned = false;

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
