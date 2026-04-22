/**
 * 课堂资产：面向页面的 selector，避免页面直接操作 store 细节。
 */
import { getCurrentUser } from "./currentUser.js";
import { ensureCurrentUserMatchesCommerceTeacher } from "./teacherProfileStore.js";
import { initCommerceStore } from "./store.js";
import {
  createTeacherAssetFromLesson,
  findAssetById,
  getEffectiveTeacherNote,
  listAssetsByProfileId,
  updateTeacherAsset,
  ASSET_STATUS,
  ASSET_TYPE,
} from "./teacherAssetsStore.js";
import { formatTeacherHubCourseDisplay } from "./commerceDisplayLabels.js";
import { findListingByAssetId } from "./teacherListingBridge.js";

export { findListingByAssetId };

/**
 * @param {string|null|undefined} profileId
 * @returns {number}
 */
export function getTeacherClassroomAssetCountForProfile(profileId) {
  if (!profileId) return 0;
  return listAssetsByProfileId(String(profileId)).length;
}

/**
 * @param {string|null|undefined} profileId
 * @param {number} [limit]
 * @returns {import('./teacherAssetsStore.js').TeacherClassroomAsset[]}
 */
export function getRecentAssetsForProfile(profileId, limit = 5) {
  const list = listAssetsByProfileId(profileId);
  return list.slice(0, Math.max(0, limit));
}

/**
 * 使用当前 i18n 函数生成创建时的显示标题（可选在页面再包一层 tx）。
 * @param {(k: string, p?: object) => string} t safeUiText
 * @param {string} course
 * @param {string} level
 * @param {string} lesson
 */
export function buildLocalizedDefaultAssetTitle(t, course, level, lesson) {
  return t("teacher.assets.default_title", {
    course: formatTeacherHubCourseDisplay(String(course)),
    level: String(level),
    lesson: String(lesson),
  });
}

/**
 * 创建并返回资产（会写入 store）。需调用方已确认老师已批准。
 * @param {object} opts
 * @param {string} opts.teacherProfileId
 * @param {string} opts.ownerUserId
 * @param {string} opts.course
 * @param {string} opts.level
 * @param {string} opts.lesson
 * @param {(k: string, p?: object) => string} [opts.t] 提供则使用本地化标题
 */
export function createClassroomAssetForLesson(opts) {
  const title =
    typeof opts.t === "function" ? buildLocalizedDefaultAssetTitle(opts.t, opts.course, opts.level, opts.lesson) : undefined;
  return createTeacherAssetFromLesson({
    teacherProfileId: opts.teacherProfileId,
    ownerUserId: opts.ownerUserId,
    course: opts.course,
    level: opts.level,
    lesson: opts.lesson,
    ...(title ? { title } : {}),
    asset_type: opts.asset_type,
  });
}

/**
 * 课堂 / 列表外层：老师课件型资产展示用元数据
 * @param {import('./teacherAssetsStore.js').TeacherClassroomAsset} asset
 */
export function getClassroomAssetPresentationContext(asset) {
  const note = getEffectiveTeacherNote(asset);
  const isDraft = String(asset?.asset_type) === String(ASSET_TYPE.lesson_slide_draft);
  return {
    asset_presentation_kind: isDraft ? "lesson_slide_draft" : "other",
    is_lesson_slide_draft: isDraft,
    has_teacher_note: note.length > 0,
  };
}

/**
 * 课堂页：按 assetId 解析；校验 profile 与当前用户（最小校验，防串改占位）。
 * @param {string|null|undefined} assetId
 * @returns {
 *   | { ok: true, asset: import('./teacherAssetsStore.js').TeacherClassroomAsset, courseId: string, level: string, lessonNo: string, presentation: ReturnType<typeof getClassroomAssetPresentationContext> }
 *   | { ok: false, error: 'not_found'|'forbidden' }
 * }
 */
export async function selectClassroomContextFromAssetId(assetId) {
  if (!assetId) return { ok: false, error: "not_found" };
  try {
    await initCommerceStore();
    await ensureCurrentUserMatchesCommerceTeacher();
  } catch {
    /* 课堂入口在无 commerce 时仍尝试弱校验 */
  }
  const asset = findAssetById(String(assetId));
  if (!asset) return { ok: false, error: "not_found" };

  const u = getCurrentUser();
  const sameProfile =
    u.teacherProfileId && asset.teacher_profile_id && String(asset.teacher_profile_id) === String(u.teacherProfileId);
  const sameOwner = u.id && asset.owner_user_id && String(asset.owner_user_id) === String(u.id);
  if (sameProfile) {
    // 资产归属当前老师 profile（含迁移后旧 owner_user_id 未改全的兼容器路径）
  } else if (sameOwner) {
    // 无 profile 时仅靠 owner
  } else {
    return { ok: false, error: "forbidden" };
  }

  const s = asset.source;
  return {
    ok: true,
    asset,
    courseId: String(s.course || "kids"),
    level: String(s.level || "1"),
    lessonNo: String(s.lesson || "1"),
    presentation: getClassroomAssetPresentationContext(asset),
  };
}

/**
 * 归档
 * @param {string} assetId
 * @returns {import('./teacherAssetsStore.js').TeacherClassroomAsset|null}
 */
export function archiveAssetById(assetId) {
  return updateTeacherAsset({ id: assetId, status: ASSET_STATUS.archived });
}

export { findAssetById, getEffectiveTeacherNote, listAssetsByProfileId, ASSET_STATUS, ASSET_TYPE };
