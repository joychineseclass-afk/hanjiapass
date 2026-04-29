/**
 * 「我的教材」列表数据源：演示 profile 走本地种子，其余在接 API 前返回空数组。
 * 后续在此接入 GET /api/teacher/materials 与缓存，不改变页面直接 import catalog 的习惯。
 */

import { getDemoMaterialsForProfile } from "./teacherDemoCatalog.js";

/**
 * 与当前演示行字段一致；正式接口可扩展后在此做 DTO → 列表行映射。
 * @typedef {{ id: string, updated_at: string, usedByCourseIds: string[], listingPrepKey: string, materialCategoryKey: string }} TeacherMaterialListRow
 */

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
    return demoRows;
  }
  // TODO(MAT-008): const r = await fetch(`/api/teacher/materials?profileId=${encodeURIComponent(String(teacherProfileId))}`);
  return [];
}
