/**
 * 「我的教材」列表数据源：演示 profile 走本地种子，其余在接 API 前返回空数组。
 * 后续在此接入 GET /api/teacher/materials 与缓存，不改变页面直接 import catalog 的习惯。
 */

import { getDemoMaterialsForProfile } from "./teacherDemoCatalog.js";

/**
 * 与当前演示行字段一致；正式接口可扩展后在此做 DTO → 列表行映射。
 * @typedef {{ id: string, updated_at: string, usedByCourseIds: string[], listingPrepKey: string, materialCategoryKey: string, titleOverride?: string }} TeacherMaterialListRow
 */

/** 与 `teacher.materials_page.category.*` 一致 */
export const TEACHER_MATERIAL_CATEGORY_KEYS = /** @type {const} */ (["ppt", "handout", "picture_book", "pdf", "other"]);

/** @type {Map<string, Set<string>>} profileId → 已移除的演示教材 id */
const deletedDemoMaterialIdsByProfile = new Map();

/** @type {Map<string, Map<string, { titleOverride?: string, materialCategoryKey?: string }>>} */
const demoMaterialPatchesByProfile = new Map();

/** @param {string|null|undefined} pid */
function normProfileId(pid) {
  return String(pid ?? "");
}

/** @param {string|null|undefined} pid */
function patchMapForProfile(pid) {
  const k = normProfileId(pid);
  let m = demoMaterialPatchesByProfile.get(k);
  if (!m) {
    m = new Map();
    demoMaterialPatchesByProfile.set(k, m);
  }
  return m;
}

/**
 * @param {string|null|undefined} teacherProfileId
 * @param {import("./teacherDemoCatalog.js").TeacherDemoMaterial[]} rows
 * @returns {TeacherMaterialListRow[]}
 */
function applyDemoRowMutations(teacherProfileId, rows) {
  const pk = normProfileId(teacherProfileId);
  const deleted = deletedDemoMaterialIdsByProfile.get(pk) || new Set();
  const patches = demoMaterialPatchesByProfile.get(pk) || new Map();
  return rows
    .filter((m) => !deleted.has(m.id))
    .map((m) => {
      const p = patches.get(m.id);
      if (!p) return { ...m };
      return {
        ...m,
        ...(p.titleOverride !== undefined ? { titleOverride: p.titleOverride } : {}),
        ...(p.materialCategoryKey !== undefined ? { materialCategoryKey: p.materialCategoryKey } : {}),
      };
    });
}

/** @param {string|null|undefined} key */
export function isAllowedMaterialCategoryKey(key) {
  const k = String(key || "").trim();
  return /** @type {readonly string[]} */ (TEACHER_MATERIAL_CATEGORY_KEYS).includes(k);
}

/** 本地上传：单文件上限（骨架阶段，与正式版对齐前可再调） */
export const LOCAL_MATERIAL_MAX_BYTES = 100 * 1024 * 1024;

/** @param {File|null|undefined} file */
export function validateLocalMaterialFile(file) {
  if (!file || !(file instanceof File)) {
    return /** @type {const} */ ({ ok: false, reason: "no_file" });
  }
  if (file.size > LOCAL_MATERIAL_MAX_BYTES) {
    return /** @type {const} */ ({ ok: false, reason: "size" });
  }
  const name = String(file.name || "");
  if (!/\.(pdf|ppt|pptx|doc|docx|png|jpg|jpeg|webp)$/i.test(name)) {
    return /** @type {const} */ ({ ok: false, reason: "type" });
  }
  return /** @type {const} */ ({ ok: true });
}

/**
 * 演示用：模拟网络延迟，不写入列表。
 * @param {{ teacherProfileId: string, file: File, title: string }} payload
 * @returns {Promise<{ ok: boolean, mock?: boolean }>}
 */
export async function mockSubmitLocalMaterialUpload(payload) {
  void payload.teacherProfileId;
  void payload.title;
  void payload.file?.size;
  await new Promise((r) => setTimeout(r, 750));
  return { ok: true, mock: true };
}

/**
 * @param {string|null|undefined} teacherProfileId
 * @returns {Promise<TeacherMaterialListRow[]>}
 */
export async function listMaterialsForTeacherProfile(teacherProfileId) {
  const demoRows = getDemoMaterialsForProfile(teacherProfileId);
  if (demoRows.length > 0) {
    return applyDemoRowMutations(teacherProfileId, demoRows);
  }
  // TODO(MAT-008): const r = await fetch(`/api/teacher/materials?profileId=${encodeURIComponent(String(teacherProfileId))}`);
  return [];
}

/**
 * 演示用：改名（内存 patch，合并进列表）。
 * @param {string|null|undefined} profileId
 * @param {string} materialId
 * @param {string} title
 * @returns {Promise<{ ok: true } | { ok: false, reason: "not_found" | "empty" }>}
 */
export async function mockRenameTeacherMaterial(profileId, materialId, title) {
  const rows = getDemoMaterialsForProfile(profileId);
  if (!rows.some((m) => m.id === materialId)) {
    return { ok: false, reason: "not_found" };
  }
  const trimmed = String(title || "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty" };
  }
  await new Promise((r) => setTimeout(r, 200));
  const map = patchMapForProfile(profileId);
  const cur = map.get(materialId) || {};
  map.set(materialId, { ...cur, titleOverride: trimmed });
  return { ok: true };
}

/**
 * 演示用：修改分类键。
 * @param {string|null|undefined} profileId
 * @param {string} materialId
 * @param {string} categoryKey
 * @returns {Promise<{ ok: true } | { ok: false, reason: "not_found" | "bad_category" }>}
 */
export async function mockSetTeacherMaterialCategory(profileId, materialId, categoryKey) {
  const rows = getDemoMaterialsForProfile(profileId);
  if (!rows.some((m) => m.id === materialId)) {
    return { ok: false, reason: "not_found" };
  }
  const k = String(categoryKey || "").trim();
  if (!isAllowedMaterialCategoryKey(k)) {
    return { ok: false, reason: "bad_category" };
  }
  await new Promise((r) => setTimeout(r, 200));
  const map = patchMapForProfile(profileId);
  const cur = map.get(materialId) || {};
  map.set(materialId, { ...cur, materialCategoryKey: k });
  return { ok: true };
}

/**
 * 演示用：从列表移除一行（内存；刷新页面后恢复，除非后续接持久化）。
 * 若演示行仍关联课程（`usedByCourseIds` 非空），禁止删除以贴近正式规则。
 * @param {string|null|undefined} profileId
 * @param {string} materialId
 * @returns {Promise<{ ok: true } | { ok: false, reason: "not_found" | "in_use" }>}
 */
export async function mockDeleteTeacherMaterial(profileId, materialId) {
  const rows = getDemoMaterialsForProfile(profileId);
  const row = rows.find((m) => m.id === materialId);
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (Array.isArray(row.usedByCourseIds) && row.usedByCourseIds.length > 0) {
    return { ok: false, reason: "in_use" };
  }
  await new Promise((r) => setTimeout(r, 200));
  const pk = normProfileId(profileId);
  let s = deletedDemoMaterialIdsByProfile.get(pk);
  if (!s) {
    s = new Set();
    deletedDemoMaterialIdsByProfile.set(pk, s);
  }
  s.add(materialId);
  demoMaterialPatchesByProfile.get(pk)?.delete(materialId);
  return { ok: true };
}
