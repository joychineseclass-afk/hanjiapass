/**
 * Supabase public.profiles + public.user_roles 读取与 ensure（方案 B：登录后创建）。
 * demo provider 不会调用本模块。
 */
import { getSupabase, prepareSupabaseClient } from "../integrations/supabaseClient.js";
import { getActiveProvider } from "./authStore.js";
import { applyProfileBundleToLuminaCache } from "./providers/supabaseAuthProvider.js";

/**
 * @typedef {import('./providers/authTypes.js').LuminaPlatformRole} LuminaPlatformRole
 */

/** @typedef {import('./providers/authTypes.js').LuminaProfileRow} LuminaProfileRow */

/**
 * @typedef {Object} LuminaStandardUser
 * @property {string} id
 * @property {string} email
 * @property {string} displayName
 * @property {string} [avatarUrl]
 * @property {string} [locale]
 * @property {LuminaPlatformRole[]} roles
 * @property {string} defaultRole
 * @property {'supabase'} provider
 */

/**
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient | null>}
 */
async function clientOrNull() {
  await prepareSupabaseClient();
  return getSupabase();
}

/**
 * @returns {Promise<LuminaProfileRow | null>}
 */
export async function getCurrentProfile() {
  if (getActiveProvider().type !== "supabase") {
    return null;
  }
  const client = await clientOrNull();
  if (!client) {
    return null;
  }
  const { data: uData, error: uErr } = await client.auth.getUser();
  if (uErr || !uData?.user) {
    return null;
  }
  const uid = uData.user.id;
  const { data, error } = await client.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) {
    console.warn("[Lumina] getCurrentProfile:", error.message);
    return null;
  }
  return /** @type {LuminaProfileRow | null} */ (data);
}

/**
 * 确保 public.profiles 与至少 student 的 user_roles 存在；不写入 admin / super_admin。
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>}
 */
export async function ensureCurrentUserProfile() {
  if (getActiveProvider().type !== "supabase") {
    return { ok: false, code: "not_supabase" };
  }
  const client = await clientOrNull();
  if (!client) {
    return { ok: false, code: "no_client" };
  }
  const { data: uData, error: uErr } = await client.auth.getUser();
  if (uErr || !uData?.user) {
    return { ok: false, code: "not_authenticated" };
  }
  const user = uData.user;
  const meta = /** @type {Record<string, unknown>} */ (user.user_metadata || {});
  const displayName =
    String(meta.display_name || meta.displayName || meta.name || "").trim() ||
    (user.email && String(user.email).includes("@") ? String(user.email).split("@")[0] : "User");

  const { data: existing, error: selErr } = await client.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (selErr) {
    console.warn("[Lumina] ensureCurrentUserProfile select:", selErr.message);
    return { ok: false, code: "db_error" };
  }
  if (!existing) {
    const ins = await client.from("profiles").insert({
      id: user.id,
      email: user.email != null ? String(user.email) : null,
      display_name: displayName,
      locale: "kr",
      default_role: "student",
    });
    if (ins.error) {
      console.warn("[Lumina] ensureCurrentUserProfile insert profile:", ins.error.message);
      return { ok: false, code: "db_error" };
    }
  }

  const { data: existingRoles, error: rErr } = await client.from("user_roles").select("role").eq("user_id", user.id);
  if (rErr) {
    console.warn("[Lumina] ensureCurrentUserProfile select roles:", rErr.message);
    return { ok: false, code: "db_error" };
  }
  const hasStudent = (existingRoles || []).some((/** @type {{ role: string }} */ r) => r.role === "student");
  if (!hasStudent) {
    const insR = await client.from("user_roles").insert({ user_id: user.id, role: "student" });
    if (insR.error) {
      console.warn("[Lumina] ensureCurrentUserProfile insert role:", insR.error.message);
      return { ok: false, code: "db_error" };
    }
  }

  return { ok: true };
}

/**
 * 仅允许安全字段；不得改 default_role / app 角色（由后端或审核流处理）。
 * @param {Partial<{ displayName: string, avatarUrl: string, locale: string }>} patch
 */
export async function updateCurrentProfile(patch) {
  if (getActiveProvider().type !== "supabase") {
    return { ok: false, code: "not_supabase" };
  }
  const client = await clientOrNull();
  if (!client) {
    return { ok: false, code: "no_client" };
  }
  const { data: uData, error: uErr } = await client.auth.getUser();
  if (uErr || !uData?.user) {
    return { ok: false, code: "not_authenticated" };
  }
  const row = /** @type {Record<string, unknown>} */ ({});
  if (patch.displayName != null) {
    row.display_name = String(patch.displayName);
  }
  if (patch.avatarUrl != null) {
    row.avatar_url = String(patch.avatarUrl);
  }
  if (patch.locale != null) {
    row.locale = String(patch.locale);
  }
  if (Object.keys(row).length === 0) {
    return { ok: true, profile: await getCurrentProfile() };
  }
  const { data, error } = await client.from("profiles").update(row).eq("id", uData.user.id).select().maybeSingle();
  if (error) {
    console.warn("[Lumina] updateCurrentProfile:", error.message);
    return { ok: false, code: "db_error" };
  }
  await ensureLuminaProfileAndMerge();
  return { ok: true, profile: /** @type {LuminaProfileRow | null} */ (data) };
}

/**
 * @returns {Promise<LuminaPlatformRole[]>}
 */
export async function getCurrentUserRoles() {
  if (getActiveProvider().type !== "supabase") {
    return [];
  }
  const client = await clientOrNull();
  if (!client) {
    return [];
  }
  const { data: uData, error: uErr } = await client.auth.getUser();
  if (uErr || !uData?.user) {
    return [];
  }
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", uData.user.id);
  if (error) {
    console.warn("[Lumina] getCurrentUserRoles:", error.message);
    return [];
  }
  const list = data || [];
  return list
    .map((/** @type {{ role: string }} */ r) => String(r.role))
    .filter((r) => ["student", "teacher", "parent", "admin", "super_admin"].includes(r));
}

/**
 * @returns {Promise<{
 *   user: LuminaStandardUser,
 *   profile: LuminaProfileRow | null,
 *   roles: LuminaPlatformRole[],
 *   defaultRole: string
 * } | null>}
 */
export async function getCurrentUserProfileBundle() {
  if (getActiveProvider().type !== "supabase") {
    return null;
  }
  const client = await clientOrNull();
  if (!client) {
    return null;
  }
  const { data: uData, error: uErr } = await client.auth.getUser();
  if (uErr || !uData?.user) {
    return null;
  }
  const su = uData.user;
  const profile = await getCurrentProfile();
  const roleList = await getCurrentUserRoles();
  const defaultRole = (profile && profile.default_role) || "student";
  const displayName =
    (profile && profile.display_name) ||
    String(su.user_metadata?.display_name || su.email?.split("@")[0] || "User");
  /** @type {LuminaStandardUser} */
  const luminaUser = {
    id: su.id,
    email: su.email != null ? String(su.email) : "",
    displayName: String(displayName),
    avatarUrl: profile?.avatar_url != null ? String(profile.avatar_url) : undefined,
    locale: profile?.locale != null ? String(profile.locale) : "kr",
    roles: /** @type {LuminaPlatformRole[]} */ (roleList.length ? roleList : ["student"]),
    defaultRole: String(defaultRole),
    provider: "supabase",
  };
  return {
    user: luminaUser,
    profile,
    roles: /** @type {LuminaPlatformRole[]} */ (roleList.length ? roleList : ["student"]),
    defaultRole: String(defaultRole),
  };
}

/**
 * ensure + 合并进 supabase provider 内存缓存（供 findUserById / getCurrentSessionAuthUser）。
 * @returns {Promise<void>}
 */
export async function ensureLuminaProfileAndMerge() {
  if (getActiveProvider().type !== "supabase") {
    return;
  }
  const r = await ensureCurrentUserProfile();
  if (!r.ok) {
    return;
  }
  const bundle = await getCurrentUserProfileBundle();
  if (!bundle) {
    return;
  }
  applyProfileBundleToLuminaCache({
    profile: bundle.profile,
    roleKeys: bundle.roles,
    defaultRole: bundle.defaultRole,
  });
}
