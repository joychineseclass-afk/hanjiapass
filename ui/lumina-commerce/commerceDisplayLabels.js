/**
 * 教师商业化 / Stage 0 显示层：枚举与字段名 → 当前系统语言文案。
 * 仅调用全局 i18n，不维护平行文案表。
 */

import { i18n } from "../i18n.js";

/**
 * @param {string} path 已带点路径，如 commerce.enum.seller_type.platform
 * @param {object} [params]
 */
export function commerceT(path, params) {
  if (params && typeof params === "object") {
    return String(i18n.t(path, params) || "").trim();
  }
  return String(i18n.t(path) || "").trim();
}

/** @param {string} path */
function enumOrUnknown(path) {
  const v = commerceT(path);
  if (v && v !== path) return v;
  return commerceT("commerce.enum.unknown");
}

/** @param {string} group 如 seller_type、listing_status */
/** @param {string|null|undefined} value */
export function formatCommerceEnum(group, value) {
  const r = value == null ? "" : String(value);
  if (!r) return commerceT("commerce.table.empty_cell");
  return enumOrUnknown(`commerce.enum.${group}.${r}`);
}

/** @param {string} fieldKey 如 user_id、listing_id */
export function formatCommerceFieldLabel(fieldKey) {
  const path = `commerce.field.${fieldKey}`;
  const v = commerceT(path);
  return v && v !== path ? v : fieldKey;
}

/** @param {boolean} v */
export function formatCommerceBool(v) {
  return v ? commerceT("commerce.bool.yes") : commerceT("commerce.bool.no");
}

/** @param {string} userId */
export function formatDemoUserDisplay(userId, fallbackName) {
  const map = {
    u_student_demo_001: "commerce.demo.user_student",
    u_teacher_demo_001: "commerce.demo.user_teacher",
    u_reviewer_demo_001: "commerce.demo.user_reviewer",
    u_admin_demo_001: "commerce.demo.user_admin",
  };
  const key = map[userId];
  if (key) {
    const label = commerceT(key);
    if (label && label !== key) return label;
  }
  return fallbackName || userId;
}

/** 小游戏 type 标签（非中文教学内容，仅为 UI 模式说明） */
export function formatGameModeType(type) {
  const t = String(type || "").trim();
  if (!t) return commerceT("commerce.table.empty_cell");
  return enumOrUnknown(`commerce.enum.game_mode.${t}`);
}

/** @param {string} code assertCanSubmitListingForReview 返回的 code */
export function formatCommerceErrorCode(code) {
  if (!code) return commerceT("commerce.err.unknown");
  const path = `commerce.err.${code}`;
  const v = commerceT(path);
  return v && v !== path ? v : code;
}

/** @param {string|null|undefined} id @param {string} [fallback] */
export function formatDemoTeacherProfileDisplayName(id, fallback) {
  if (!id) return commerceT("commerce.table.empty_cell");
  const path = `commerce.demo.profile_names.${id}`;
  const v = commerceT(path);
  if (v && v !== path) return v;
  return fallback || id;
}

/** @param {string} key thead 短键，如 record_id、listing */
export function formatCommerceTableHead(key) {
  const path = `commerce.table.head.${key}`;
  const v = commerceT(path);
  return v && v !== path ? v : key;
}
