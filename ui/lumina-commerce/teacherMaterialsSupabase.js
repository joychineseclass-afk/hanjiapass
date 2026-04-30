/**
 * Supabase：教师教材列表 + Storage 上传（与 demo 内存路径互斥，由 teacherMaterialsService 分流）。
 */

import { getActiveProvider } from "../auth/authStore.js";
import { getSupabaseClientReady, isAuthDemoForced } from "../integrations/supabaseClient.js";
import { getCurrentUser } from "./currentUser.js";

export const TEACHER_MATERIALS_BUCKET = "teacher-materials";

/** @returns {string} */
function randomUuidV4() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** @param {string} name */
export function safeStorageFileSegment(name) {
  const base = String(name || "file").split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  return cleaned || "file";
}

/** @param {string} name */
function inferCategoryKeyFromFileName(name) {
  const n = String(name || "").toLowerCase();
  if (/\.pdf$/i.test(n)) return "pdf";
  if (/\.(ppt|pptx)$/i.test(n)) return "ppt";
  if (/\.(doc|docx)$/i.test(n)) return "handout";
  if (/\.(png|jpg|jpeg|webp)$/i.test(n)) return "other";
  return "other";
}

/**
 * 当前会话是否应走 Supabase（真实账号 + 已配置 Client + 未强制 demo）。
 */
export async function shouldUseSupabaseMaterials() {
  if (isAuthDemoForced()) return false;
  if (getActiveProvider().type !== "supabase") return false;
  const u = getCurrentUser();
  if (!u?.id || u.isGuest || u.id === "u_guest") return false;
  const client = await getSupabaseClientReady();
  return Boolean(client);
}

/**
 * @param {Record<string, unknown>} row
 */
function mapDbRowToListRow(row) {
  return {
    id: String(row.id),
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
    usedByCourseIds: [],
    listingPrepKey: "not_yet_ready",
    materialCategoryKey: String(row.material_category_key || "other"),
    titleOverride: String(row.title || ""),
    localSourceFileName: String(row.original_filename || ""),
    cloudSource: true,
    storageBucket: String(row.storage_bucket || TEACHER_MATERIALS_BUCKET),
    storagePath: String(row.storage_path || ""),
  };
}

/**
 * @param {string|null|undefined} teacherProfileId
 */
export async function listTeacherMaterialsFromSupabase(teacherProfileId) {
  const client = await getSupabaseClientReady();
  if (!client) return [];
  const { data, error } = await client
    .from("teacher_materials")
    .select(
      "id, title, material_category_key, original_filename, storage_bucket, storage_path, updated_at, created_at",
    )
    .eq("teacher_profile_id", String(teacherProfileId))
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[Lumina] teacher_materials list:", error.message);
    return [];
  }
  return (data || []).map((row) => mapDbRowToListRow(/** @type {Record<string, unknown>} */ (row)));
}

/**
 * @param {{ teacherProfileId: string, file: File, title: string }} payload
 * @returns {Promise<{ ok: true } | { ok: false, reason: "auth"|"storage"|"db", message?: string }>}
 */
export async function submitTeacherMaterialUploadSupabase(payload) {
  const client = await getSupabaseClientReady();
  if (!client) {
    return { ok: false, reason: "auth", message: "no_client" };
  }
  const { data: authData, error: authErr } = await client.auth.getUser();
  const user = authData?.user;
  if (authErr || !user) {
    return { ok: false, reason: "auth", message: authErr?.message };
  }
  const file = /** @type {File} */ (payload.file);
  const title = String(payload.title || "").trim() || file.name;
  const materialId = randomUuidV4();
  const path = `${user.id}/${materialId}/${safeStorageFileSegment(file.name)}`;
  const bucket = TEACHER_MATERIALS_BUCKET;

  const { error: upErr } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) {
    console.warn("[Lumina] teacher_materials storage upload:", upErr.message);
    return { ok: false, reason: "storage", message: upErr.message };
  }

  const { error: insErr } = await client.from("teacher_materials").insert({
    id: materialId,
    owner_user_id: user.id,
    teacher_profile_id: String(payload.teacherProfileId),
    title,
    material_category_key: inferCategoryKeyFromFileName(file.name),
    storage_bucket: bucket,
    storage_path: path,
    original_filename: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
  });

  if (insErr) {
    console.warn("[Lumina] teacher_materials insert:", insErr.message);
    await client.storage.from(bucket).remove([path]);
    return { ok: false, reason: "db", message: insErr.message };
  }

  return { ok: true };
}

/**
 * @param {string} materialId
 * @param {string} title
 * @returns {Promise<{ ok: true } | { ok: false, reason: "empty"|"not_found" }>}
 */
export async function renameTeacherMaterialSupabase(materialId, title) {
  const trimmed = String(title || "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty" };
  }
  const client = await getSupabaseClientReady();
  if (!client) return { ok: false, reason: "not_found" };
  const { data, error } = await client
    .from("teacher_materials")
    .update({ title: trimmed })
    .eq("id", materialId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true };
}

/**
 * @param {string} materialId
 * @param {string} categoryKey
 * @returns {Promise<{ ok: true } | { ok: false, reason: "bad_category"|"not_found" }>}
 */
export async function setTeacherMaterialCategorySupabase(materialId, categoryKey) {
  const k = String(categoryKey || "").trim();
  const allowed = ["ppt", "handout", "picture_book", "pdf", "other"];
  if (!allowed.includes(k)) {
    return { ok: false, reason: "bad_category" };
  }
  const client = await getSupabaseClientReady();
  if (!client) return { ok: false, reason: "not_found" };
  const { data, error } = await client
    .from("teacher_materials")
    .update({ material_category_key: k })
    .eq("id", materialId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true };
}

/**
 * @param {string} materialId
 * @returns {Promise<{ ok: true } | { ok: false, reason: "not_found"|"storage"|"db" }>}
 */
export async function deleteTeacherMaterialSupabase(materialId) {
  const client = await getSupabaseClientReady();
  if (!client) return { ok: false, reason: "not_found" };
  const { data: row, error: selErr } = await client
    .from("teacher_materials")
    .select("storage_bucket, storage_path")
    .eq("id", materialId)
    .maybeSingle();
  if (selErr || !row) {
    return { ok: false, reason: "not_found" };
  }
  const bucket = String(row.storage_bucket || TEACHER_MATERIALS_BUCKET);
  const storagePath = String(row.storage_path || "");
  if (storagePath) {
    const { error: rmErr } = await client.storage.from(bucket).remove([storagePath]);
    if (rmErr) {
      console.warn("[Lumina] teacher_materials storage remove:", rmErr.message);
      return { ok: false, reason: "storage" };
    }
  }
  const { error: delErr } = await client.from("teacher_materials").delete().eq("id", materialId);
  if (delErr) {
    return { ok: false, reason: "db" };
  }
  return { ok: true };
}
