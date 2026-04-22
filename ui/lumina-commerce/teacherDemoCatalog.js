/**
 * 教师端教材 / 课程演示关系（仅展示与导航，不接后端）。
 * 与 commerce store 中的 listing.source_kind / source_id 演示字段对齐。
 */

import { DEFAULT_DEMO_TEACHER_PROFILE_ID } from "./currentUser.js";

/** @typedef {{ id: string, updated_at: string, usedByCourseIds: string[], listingPrepKey: string }} TeacherDemoMaterial */
/** @typedef {{ id: string, updated_at: string, materialIds: string[], listingReadinessKey: string, listingId: string|null }} TeacherDemoCourse */

/** @type {TeacherDemoMaterial[]} */
export const TEACHER_DEMO_MATERIALS = [
  {
    id: "tdm_animals_ppt",
    updated_at: "2026-04-12T09:30:00.000Z",
    usedByCourseIds: ["tdc_kids_draft_a"],
    listingPrepKey: "ready_pack",
  },
  {
    id: "tdm_politeness_handout",
    updated_at: "2026-04-11T14:00:00.000Z",
    usedByCourseIds: ["tdc_kids_draft_a"],
    listingPrepKey: "internal_only",
  },
  {
    id: "tdm_color_chain_cards",
    updated_at: "2026-04-09T11:15:00.000Z",
    usedByCourseIds: [],
    listingPrepKey: "not_yet_ready",
  },
];

/**
 * 演示课程 id → 创建课堂资产时的默认课次（用于「从课程生成」最小闭环，非细粒度课表系统）。
 * @type {Record<string, { course: string, level: string, lesson: string }>}
 */
export const DEMO_COURSE_DEFAULT_LESSON_SOURCE = {
  tdc_kids_draft_a: { course: "kids", level: "1", lesson: "1" },
  tdc_hsk_oral_draft_b: { course: "hsk", level: "1", lesson: "3" },
};

/** @type {TeacherDemoCourse[]} */
export const TEACHER_DEMO_COURSES = [
  {
    id: "tdc_kids_draft_a",
    updated_at: "2026-04-14T08:00:00.000Z",
    materialIds: ["tdm_animals_ppt", "tdm_politeness_handout"],
    listingReadinessKey: "has_listing",
    listingId: "lst_demo_kids_course_001",
  },
  {
    id: "tdc_hsk_oral_draft_b",
    updated_at: "2026-04-08T16:20:00.000Z",
    materialIds: [],
    listingReadinessKey: "in_progress",
    listingId: null,
  },
];

/**
 * 仅当当前老师 profile 为演示绑定 id 时返回演示教材；否则空（避免非该老师看到他人演示行）。
 * @param {string|null|undefined} profileId
 * @returns {TeacherDemoMaterial[]}
 */
export function getDemoMaterialsForProfile(profileId) {
  if (!profileId || String(profileId) !== DEFAULT_DEMO_TEACHER_PROFILE_ID) return [];
  return TEACHER_DEMO_MATERIALS;
}

/**
 * @param {string|null|undefined} profileId
 * @returns {TeacherDemoCourse[]}
 */
export function getDemoCoursesForProfile(profileId) {
  if (!profileId || String(profileId) !== DEFAULT_DEMO_TEACHER_PROFILE_ID) return [];
  return TEACHER_DEMO_COURSES;
}

/** @param {string} id */
export function getDemoMaterialById(id) {
  return TEACHER_DEMO_MATERIALS.find((m) => m.id === id) || null;
}

/** @param {string} id */
export function getDemoCourseById(id) {
  return TEACHER_DEMO_COURSES.find((c) => c.id === id) || null;
}

/**
 * @param {(path: string, params?: object) => string} tx
 * @param {TeacherDemoMaterial} m
 */
export function formatDemoMaterialCoursesLine(m, tx) {
  if (!m.usedByCourseIds.length) return tx("teacher.demo.material.not_in_courses");
  return m.usedByCourseIds.map((cid) => tx(`teacher.demo.course.${cid}.title`)).join(tx("teacher.demo.enum.sep"));
}

/**
 * @param {(path: string, params?: object) => string} tx
 * @param {TeacherDemoCourse} c
 */
export function formatDemoCourseMaterialsLine(c, tx) {
  if (!c.materialIds.length) return tx("teacher.demo.course.no_materials");
  return c.materialIds.map((mid) => tx(`teacher.demo.material.${mid}.title`)).join(tx("teacher.demo.enum.sep"));
}

/**
 * @param {(path: string, params?: object) => string} tx
 * @param {TeacherDemoCourse} c
 */
export function formatDemoCourseListingHint(c, tx) {
  if (c.listingReadinessKey === "has_listing" && c.listingId) {
    const listingName = tx(`commerce.demo.listing_labels.${c.listingId}`);
    return tx("teacher.demo.course.has_listing", { name: listingName });
  }
  if (c.listingReadinessKey === "ready") return tx("teacher.demo.course.ready_for_listing");
  if (c.listingReadinessKey === "in_progress") return tx("teacher.demo.course.in_progress");
  return tx("teacher.demo.course.no_listing");
}

/**
 * @param {(path: string, params?: object) => string} tx
 * @param {TeacherDemoMaterial} m
 */
export function formatDemoMaterialListingPrep(m, tx) {
  return tx(`teacher.demo.material.listing_prep.${m.listingPrepKey}`);
}

/**
 * @param {string} iso
 */
export function formatDemoShortUpdated(iso) {
  if (!iso) return "—";
  const s = String(iso);
  return s.includes("T") ? s.replace("T", " ").slice(0, 16) : s.slice(0, 16);
}

/**
 * 教材「准备阶段」口径（演示）：与课程 / 上架语感统一。
 * @param {TeacherDemoMaterial} m
 * @returns {string} i18n key suffix teacher.demo.material.phase.<key>
 */
export function getDemoMaterialPhaseKey(m) {
  const inCourse = m.usedByCourseIds.length > 0;
  if (m.listingPrepKey === "not_yet_ready") return "not_ready";
  if (inCourse && m.listingPrepKey === "ready_pack") return "in_course_can_list";
  if (inCourse && m.listingPrepKey === "internal_only") return "in_course_internal";
  if (!inCourse && m.listingPrepKey === "ready_pack") return "can_list_only";
  return "not_ready";
}

/**
 * 课程「准备进度」口径（演示）。
 * @param {TeacherDemoCourse} c
 * @returns {string} teacher.demo.course.progress.<key>
 */
export function getDemoCourseProgressKey(c) {
  if (c.listingReadinessKey === "has_listing" && c.listingId) return "linked_listing";
  if (c.listingReadinessKey === "ready") return "ready_for_listing";
  if (c.materialIds.length > 0) return "has_materials_building";
  return "organizing";
}

/**
 * @param {TeacherDemoMaterial} m
 * @param {(path: string, params?: object) => string} tx
 */
export function formatDemoMaterialUsageChipLabel(m, tx) {
  const n = m.usedByCourseIds.length;
  if (n === 0) return tx("teacher.demo.material.usage.none");
  return tx("teacher.demo.material.usage.in_n_courses", { count: String(n) });
}

/**
 * @param {TeacherDemoCourse} c
 * @param {(path: string, params?: object) => string} tx
 */
export function formatDemoCourseMaterialsChipLabel(c, tx) {
  const n = c.materialIds.length;
  if (n === 0) return tx("teacher.demo.course.materials.none");
  return tx("teacher.demo.course.materials.linked_n", { count: String(n) });
}

/**
 * @param {string} phaseKey getDemoMaterialPhaseKey
 * @param {(path: string, params?: object) => string} tx
 */
export function formatDemoMaterialPhasePill(phaseKey, tx) {
  return tx(`teacher.demo.material.phase.${phaseKey}`);
}

/**
 * @param {string} progressKey getDemoCourseProgressKey
 * @param {(path: string, params?: object) => string} tx
 */
export function formatDemoCourseProgressPill(progressKey, tx) {
  return tx(`teacher.demo.course.progress.${progressKey}`);
}

/**
 * 已关联 listing 时的短标题（演示）。
 * @param {TeacherDemoCourse} c
 * @param {(path: string, params?: object) => string} tx
 */
export function formatDemoCourseLinkedListingLine(c, tx) {
  if (c.listingReadinessKey !== "has_listing" || !c.listingId) return "";
  const name = tx(`commerce.demo.listing_labels.${c.listingId}`);
  return tx("teacher.demo.course.linked_listing_short", { name });
}

/**
 * @param {Array<{ status?: string, teacher_id?: string|null, seller_type?: string }>|null|undefined} listings
 * @param {string|null|undefined} profileId 当前老师 profileId；未通过审核或空则不含演示教材/课程计数、且 listing 按该 id 过滤
 */
export function getTeacherWorkspaceDemoSummary(listings, profileId) {
  const mats = getDemoMaterialsForProfile(profileId);
  const crs = getDemoCoursesForProfile(profileId);
  const materialsCount = mats.length;
  const coursesCount = crs.length;
  const materialsInUseCount = mats.filter((m) => m.usedByCourseIds.length > 0).length;
  const coursesWithListing = crs.filter((c) => c.listingReadinessKey === "has_listing").length;

  const pid = profileId != null && String(profileId).trim() !== "" ? String(profileId) : null;
  let listingTotal = 0;
  let pendingReview = 0;
  let draft = 0;
  let approved = 0;
  if (Array.isArray(listings) && pid) {
    for (const L of listings) {
      if (!L || String(L.seller_type) !== "teacher" || String(L.teacher_id || "") !== pid) continue;
      listingTotal += 1;
      const st = String(L?.status || "");
      if (st === "pending_review") pendingReview += 1;
      if (st === "draft") draft += 1;
      if (st === "approved") approved += 1;
    }
  }

  return {
    materialsCount,
    coursesCount,
    materialsInUseCount,
    coursesWithListing,
    listingTotal,
    pendingReview,
    draft,
    approved,
    /** 由 page 层以 teacherAssets 实际数量覆盖；默认 0 */
    classroomAssetCount: 0,
  };
}

/** @type {Record<string, string>} */
const LISTING_SOURCE_STAGE_PATH = {
  "platform|approved": "teacher.demo.listing.source_stage.platform.approved",
  "material|pending_review": "teacher.demo.listing.source_stage.material.pending_review",
  "material|draft": "teacher.demo.listing.source_stage.material.draft",
  "course|draft": "teacher.demo.listing.source_stage.course.draft",
  "course|pending_review": "teacher.demo.listing.source_stage.course.pending_review",
  "course|approved": "teacher.demo.listing.source_stage.course.approved",
};

/**
 * Listing 来源与上架阶段衔接说明（仅展示，不读状态机）。
 * @param {{ source_kind?: string|null, status?: string|null }} listing
 * @param {(path: string, params?: object) => string} tx
 */
export function formatListingDemoSourceStageNote(listing, tx) {
  const sk = listing?.source_kind != null ? String(listing.source_kind).trim() : "";
  const st = listing?.status != null ? String(listing.status).trim() : "";
  if (!sk) return tx("teacher.demo.listing.source_stage.unset");
  const pathKey = `${sk}|${st}`;
  const i18nPath = LISTING_SOURCE_STAGE_PATH[pathKey];
  if (i18nPath) return tx(i18nPath);
  return tx("teacher.demo.listing.source_stage.fallback");
}
