/**
 * 「我的教材」列表数据源：演示 profile 走本地种子，其余在接 API 前返回空数组。
 * 后续在此接入 GET /api/teacher/materials 与缓存，不改变页面直接 import catalog 的习惯。
 */

import { getDemoMaterialsForProfile } from "./teacherDemoCatalog.js";

/**
 * 与当前演示行字段一致；正式接口可扩展后在此做 DTO → 列表行映射。
 * @typedef {{ id: string, updated_at: string, usedByCourseIds: string[], listingPrepKey: string, materialCategoryKey: string }} TeacherMaterialListRow
 */

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
