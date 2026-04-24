/**
 * 统一学习承载层 — 解析器（第一批：课堂 #classroom）
 * 从 hash/query 与商务资产，产出 course context + 归一化课 payload 引用，供页面与 initClassroomEngine 使用。
 */

import { selectClassroomContextFromAssetId } from "../../lumina-commerce/teacherAssetsSelectors.js";
import { loadLesson } from "./globalCourseEngine.js";
import { hashHasQueryString, parseHashQueryString } from "./lessonExperienceContext.js";
import {
  buildClassroomEngineInit,
  buildClassroomLessonContext,
  buildClassroomRoutingFromQueryAndAsset,
  classroomGceInputFromRouting,
} from "./lessonExperienceAdapters.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * 统一课次承载体：与 GCE `loadLesson` 一致，供后续 HSK 页等复用同一形状
 * @typedef {Object} NormalizedLessonPayload
 * @property {object} raw
 * @property {object} lesson
 * @property {object} resolved
 */

/**
 * @typedef {Object} ClassroomPageLessonResolution
 * @property {import('./lessonExperienceContext.js').LessonExperienceContext} context
 * @property {{ courseId: string, level: string, lessonId: string }} routing
 * @property {Record<string, string>} query
 * @property {ReturnType<buildClassroomEngineInit>} engineInit
 * @property {import('../../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset | null} activeAsset
 * @property {null | 'not_found' | 'forbidden'} assetError
 * @property {null | { is_lesson_slide_draft: boolean, has_teacher_note: boolean, asset_presentation_kind: string }} assetPresentation
 * @property {NormalizedLessonPayload | null} loadedLesson
 * @property {boolean} hasUrlParams
 */

/**
 * 解析 #classroom 当前 URL，给出统一 context + 引擎入参 + GCE 归一化课（与 classroom 舞台同源）
 * @param {{ hash?: string }} [opts]
 * @returns {Promise<ClassroomPageLessonResolution>}
 */
export async function resolveClassroomPageLessonExperience(opts = {}) {
  const hash = opts.hash != null ? String(opts.hash) : typeof location !== "undefined" ? String(location.hash || "") : "";
  const q = parseHashQueryString(hash);
  const assetIdRaw = str(q.assetId || q.assetid || "");
  const assetId = String(assetIdRaw).trim();

  let activeAsset = /** @type {import('../../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset | null} */ (null);
  let assetError = /** @type {null | 'not_found' | 'forbidden'} */ (null);
  let assetPresentation = /** @type {ClassroomPageLessonResolution['assetPresentation']} */ (null);

  /** @type {null | { courseId: string, level: string, lessonNo: string }} */
  let assetRouting = null;

  if (assetId) {
    const res = await selectClassroomContextFromAssetId(assetId);
    if (res.ok) {
      activeAsset = res.asset;
      assetRouting = { courseId: res.courseId, level: res.level, lessonNo: res.lessonNo };
      assetPresentation = res.presentation;
    } else {
      assetError = res.error;
    }
  }

  const routing = buildClassroomRoutingFromQueryAndAsset(q, assetRouting);
  const gce = classroomGceInputFromRouting(routing.courseId, routing.level, routing.lessonId);

  const withAsset = Boolean(assetId);
  const sourceType =
    withAsset && activeAsset ? /** @type {const} */ ("classroom_asset") : /** @type {const} */ ("teacher_course");

  const hasUrlParams = hashHasQueryString(hash);

  const context = buildClassroomLessonContext({
    sourceType,
    mode: "teacher",
    courseId: routing.courseId,
    level: routing.level,
    lessonId: routing.lessonId,
    assetId: withAsset && activeAsset ? assetId : undefined,
    gcePathVersion: gce?.gcePathVersion,
    gcePathLevel: gce?.gcePathLevel,
  });

  /** @type {NormalizedLessonPayload | null} */
  let loadedLesson = null;
  try {
    const out = await loadLesson(gce.input);
    loadedLesson = { raw: out.raw, lesson: out.lesson, resolved: out.resolved };
  } catch (e) {
    console.warn("[lessonExperienceResolver] loadLesson (classroom):", e?.message || e);
    loadedLesson = null;
  }

  const apKind = activeAsset && assetPresentation ? String(assetPresentation.asset_presentation_kind || "") : "";
  const apSlide = apKind === "lesson_slide_draft" ? "1" : "0";
  const coursewareAsset = apSlide === "1" && activeAsset && !assetError ? activeAsset : null;

  const preloaded = loadedLesson
    ? { raw: loadedLesson.raw, lesson: loadedLesson.lesson }
    : undefined;

  const engineInit = buildClassroomEngineInit({
    courseId: routing.courseId,
    lessonId: routing.lessonId,
    level: routing.level,
    coursewareAsset,
    preloadedLesson: preloaded,
  });

  return {
    context,
    routing,
    query: q,
    engineInit,
    activeAsset,
    assetError,
    assetPresentation,
    loadedLesson,
    hasUrlParams,
  };
}
