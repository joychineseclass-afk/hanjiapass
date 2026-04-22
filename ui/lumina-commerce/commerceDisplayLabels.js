/**
 * 教师商业化 / Stage 0 显示层：枚举与字段名 → 当前系统语言文案。
 * 禁止将 i18n key 路径或内部 code 原样展示给用户（缺失时用 commerce.ui.* 保护层）。
 */

import { i18n } from "../i18n.js";

/** @param {string} path @param {object} [params] */
function rawT(path, params) {
  if (params && typeof params === "object") {
    return String(i18n.t(path, params) ?? "").trim();
  }
  return String(i18n.t(path) ?? "").trim();
}

/**
 * 疑似未翻译的 key 路径（全 ASCII 点分片段），避免直出到 UI。
 * @param {string} s
 */
function looksLikeUntranslatedKey(s) {
  if (!s || !s.includes(".")) return false;
  const parts = s.split(".");
  if (parts.length < 2) return false;
  return parts.every((p) => /^[a-z][a-z0-9_]*$/i.test(p));
}

/**
 * 任意 UI 文案安全取值（教师页 / 课堂页可复用）。
 * @param {string} path
 * @param {object} [params]
 */
export function safeUiText(path, params) {
  const s = rawT(path, params);
  if (!s || s === path || looksLikeUntranslatedKey(s)) {
    const fb = rawT("commerce.ui.text_pending");
    return fb && fb !== "commerce.ui.text_pending" && !looksLikeUntranslatedKey(fb) ? fb : "…";
  }
  return s;
}

/**
 * @param {string} path 已带点路径
 * @param {object} [params]
 */
export function commerceT(path, params) {
  return safeUiText(path, params);
}

/** @param {string} path */
function enumOrUnknown(path) {
  const v = rawT(path);
  if (v && v !== path && !looksLikeUntranslatedKey(v)) return v;
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
  const v = rawT(path);
  if (!v || v === path || looksLikeUntranslatedKey(v)) return commerceT("commerce.ui.fallback_label");
  return v;
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
    const label = rawT(key);
    if (label && label !== key && !looksLikeUntranslatedKey(label)) return label;
  }
  return fallbackName ? String(fallbackName) : userId;
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
  const v = rawT(path);
  if (!v || v === path || looksLikeUntranslatedKey(v)) return commerceT("commerce.err.unknown");
  return v;
}

/** @param {string|null|undefined} id @param {string} [fallback] */
export function formatDemoTeacherProfileDisplayName(id, fallback) {
  if (!id) return commerceT("commerce.table.empty_cell");
  const path = `commerce.demo.profile_names.${id}`;
  const v = rawT(path);
  if (v && v !== path && !looksLikeUntranslatedKey(v)) return v;
  return fallback ? String(fallback) : String(id);
}

/** @param {string} key thead 短键，如 record_id、listing */
export function formatCommerceTableHead(key) {
  const path = `commerce.table.head.${key}`;
  const v = rawT(path);
  if (!v || v === path || looksLikeUntranslatedKey(v)) return commerceT("commerce.ui.fallback_label");
  return v;
}

/**
 * 教师首页 / 课堂：课程内部 code → 当前语言展示名（teacher.course.<code>）。
 * @param {string} courseId 如 kids、hsk
 */
export function formatTeacherHubCourseDisplay(courseId) {
  const id = String(courseId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (!id) return safeUiText("commerce.ui.text_pending");
  return safeUiText(`teacher.course.${id}`);
}

/**
 * Stage 0 下拉：演示上架内容的 UI 主标签（内容标题仅作 title 提示，不充当界面主文案）。
 * @param {{ id?: string, title?: string }} listing
 */
export function formatDemoListingSelectLabel(listing) {
  if (!listing?.id) return commerceT("commerce.table.empty_cell");
  const path = `commerce.demo.listing_labels.${listing.id}`;
  let v = rawT(path);
  if (!v || v === path || looksLikeUntranslatedKey(v)) {
    v = rawT("commerce.demo.listing_generic");
  }
  if (!v || v === "commerce.demo.listing_generic" || looksLikeUntranslatedKey(v)) {
    return commerceT("commerce.demo.listing_generic");
  }
  return v;
}

/** 选项 title 属性：保留 mock 内容原文供悬停查看 */
export function formatDemoListingContentTitleAttr(listing) {
  const t = listing?.title != null ? String(listing.title).trim() : "";
  return t || "";
}

/**
 * Listing 管理表主列：优先演示文案映射，否则用草稿 title，再回退通用占位。
 * @param {{ id?: string, title?: string }} listing
 */
export function formatListingManagePrimaryLabel(listing) {
  if (!listing?.id) return commerceT("commerce.table.empty_cell");
  const path = `commerce.demo.listing_labels.${listing.id}`;
  const v = rawT(path);
  if (v && v !== path && !looksLikeUntranslatedKey(v)) return v;
  const t = listing.title != null ? String(listing.title).trim() : "";
  if (t) return t;
  return commerceT("commerce.demo.listing_generic");
}

/**
 * Listing 演示来源（source_kind / source_id），仅本地演示数据。
 * @param {{ source_kind?: string|null, source_id?: string|null }} listing
 */
export function formatListingDemoSourceLine(listing) {
  const kind = listing?.source_kind != null ? String(listing.source_kind).trim() : "";
  if (!kind) {
    return commerceT("commerce.stage0.source.not_set");
  }
  const kindPath = `commerce.stage0.source.kind_${kind}`;
  let kindLabel = rawT(kindPath);
  if (!kindLabel || kindLabel === kindPath || looksLikeUntranslatedKey(kindLabel)) {
    kindLabel = commerceT("commerce.stage0.source.kind_unknown");
  }
  let detail = "";
  if (kind === "platform") {
    detail = commerceT("commerce.stage0.source.detail_platform");
  } else if (kind === "course" && listing.source_id) {
    const p = `teacher.demo.course.${listing.source_id}.title`;
    const v = rawT(p);
    detail = v && v !== p && !looksLikeUntranslatedKey(v) ? v : commerceT("commerce.table.empty_cell");
  } else if (kind === "material" && listing.source_id) {
    const p = `teacher.demo.material.${listing.source_id}.title`;
    const v = rawT(p);
    detail = v && v !== p && !looksLikeUntranslatedKey(v) ? v : commerceT("commerce.table.empty_cell");
  } else if (kind === "classroom_asset" && listing.source_id) {
    // 不拉 teacherAssetsStore，避免与 defaultTitle 路径循环依赖；bridge 建 listing 时已写入 title
    const t0 =
      listing.title != null && String(listing.title).trim() ? String(listing.title).trim() : String(listing.source_id);
    detail = t0;
  } else {
    detail = commerceT("commerce.table.empty_cell");
  }
  const line = commerceT("commerce.stage0.source.line", { kind: kindLabel, detail });
  if (line && line !== "commerce.stage0.source.line" && !looksLikeUntranslatedKey(line)) return line;
  return `${kindLabel}：${detail}`;
}
