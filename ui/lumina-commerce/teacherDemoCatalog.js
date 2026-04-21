/**
 * 教师端教材 / 课程演示关系（仅展示与导航，不接后端）。
 * 与 commerce store 中的 listing.source_kind / source_id 演示字段对齐。
 */

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
