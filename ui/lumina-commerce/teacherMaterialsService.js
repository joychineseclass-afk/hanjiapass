/**
 * 「我的教材」列表数据源：演示 profile 走本地种子，其余在接 API 前返回空数组。
 * 后续在此接入 GET /api/teacher/materials 与缓存，不改变页面直接 import catalog 的习惯。
 */

import { getDemoMaterialsForProfile } from "./teacherDemoCatalog.js";

/**
 * 与当前演示行字段一致；正式接口可扩展后在此做 DTO → 列表行映射。
 * `localSourceFileName`：本地上传（内存行）用于推断「类型」列展示，不含文件内容。
 * @typedef {{ id: string, updated_at: string, usedByCourseIds: string[], listingPrepKey: string, materialCategoryKey: string, titleOverride?: string, localSourceFileName?: string }} TeacherMaterialListRow
 */

const LOCAL_MATERIAL_ID_PREFIX = "lmu_";

/** @type {Map<string, TeacherMaterialListRow[]>} profileId → 本地上传内存行（未接存储，刷新即清空） */
const localUploadedMaterialsByProfile = new Map();

/** @param {string|null|undefined} id */
export function isLocalMockMaterialId(id) {
  return String(id || "").startsWith(LOCAL_MATERIAL_ID_PREFIX);
}

/** @param {string|null|undefined} pid */
function localMaterialListForProfile(pid) {
  const k = normProfileId(pid);
  let arr = localUploadedMaterialsByProfile.get(k);
  if (!arr) {
    arr = [];
    localUploadedMaterialsByProfile.set(k, arr);
  }
  return arr;
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

/** @returns {string} */
function newLocalMaterialId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${LOCAL_MATERIAL_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${LOCAL_MATERIAL_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

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
 * 演示用：校验通过后追加到当前教师 profile 的**内存列表**（浏览器会话内有效，刷新即无）。
 * 正式版：客户端直传对象存储（S3/R2 等）或经后端预签名 URL，再把 `file_key`、标题等写入数据库。
 * @param {{ teacherProfileId: string, file: File, title: string }} payload
 * @returns {Promise<{ ok: true, mock: true } | { ok: false, reason: "no_file"|"size"|"type", mock: true }>}
 */
export async function mockSubmitLocalMaterialUpload(payload) {
  const v = validateLocalMaterialFile(payload.file);
  if (!v.ok) {
    return /** @type {const} */ ({ ok: false, reason: v.reason, mock: true });
  }
  await new Promise((r) => setTimeout(r, 750));
  const file = /** @type {File} */ (payload.file);
  const title = String(payload.title || "").trim() || file.name;
  /** @type {TeacherMaterialListRow} */
  const row = {
    id: newLocalMaterialId(),
    updated_at: new Date().toISOString(),
    usedByCourseIds: [],
    listingPrepKey: "not_yet_ready",
    materialCategoryKey: inferCategoryKeyFromFileName(file.name),
    titleOverride: title,
    localSourceFileName: file.name,
  };
  localMaterialListForProfile(payload.teacherProfileId).push(row);
  return { ok: true, mock: true };
}

/**
 * @param {string|null|undefined} teacherProfileId
 * @returns {Promise<TeacherMaterialListRow[]>}
 */
export async function listMaterialsForTeacherProfile(teacherProfileId) {
  const demoRows = getDemoMaterialsForProfile(teacherProfileId);
  const locals = localMaterialListForProfile(teacherProfileId);
  const out = [];
  if (demoRows.length > 0) {
    out.push(...applyDemoRowMutations(teacherProfileId, demoRows));
  }
  out.push(...locals);
  if (out.length === 0) {
    // TODO(MAT-008): const r = await fetch(`/api/teacher/materials?profileId=...`);
  }
  return out;
}

/**
 * 演示用：改名（内存 patch，合并进列表）。
 * @param {string|null|undefined} profileId
 * @param {string} materialId
 * @param {string} title
 * @returns {Promise<{ ok: true } | { ok: false, reason: "not_found" | "empty" }>}
 */
export async function mockRenameTeacherMaterial(profileId, materialId, title) {
  const trimmed = String(title || "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty" };
  }
  if (isLocalMockMaterialId(materialId)) {
    const list = localMaterialListForProfile(profileId);
    const row = list.find((m) => m.id === materialId);
    if (!row) {
      return { ok: false, reason: "not_found" };
    }
    await new Promise((r) => setTimeout(r, 200));
    row.titleOverride = trimmed;
    row.updated_at = new Date().toISOString();
    return { ok: true };
  }
  const rows = getDemoMaterialsForProfile(profileId);
  if (!rows.some((m) => m.id === materialId)) {
    return { ok: false, reason: "not_found" };
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
  const k = String(categoryKey || "").trim();
  if (!isAllowedMaterialCategoryKey(k)) {
    return { ok: false, reason: "bad_category" };
  }
  if (isLocalMockMaterialId(materialId)) {
    const list = localMaterialListForProfile(profileId);
    const row = list.find((m) => m.id === materialId);
    if (!row) {
      return { ok: false, reason: "not_found" };
    }
    await new Promise((r) => setTimeout(r, 200));
    row.materialCategoryKey = k;
    row.updated_at = new Date().toISOString();
    return { ok: true };
  }
  const rows = getDemoMaterialsForProfile(profileId);
  if (!rows.some((m) => m.id === materialId)) {
    return { ok: false, reason: "not_found" };
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
  if (isLocalMockMaterialId(materialId)) {
    const list = localMaterialListForProfile(profileId);
    const idx = list.findIndex((m) => m.id === materialId);
    if (idx < 0) {
      return { ok: false, reason: "not_found" };
    }
    await new Promise((r) => setTimeout(r, 200));
    list.splice(idx, 1);
    return { ok: true };
  }
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
