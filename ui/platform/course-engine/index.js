/**
 * Global Course Engine v1 - 统一导出
 */

import * as GLOBAL_COURSE_ENGINE from "./globalCourseEngine.js";

export { GLOBAL_COURSE_ENGINE };
export * from "./globalCourseEngine.js";
export * from "./courseRegistry.js";
export * from "./courseResolver.js";
export * from "./courseLoader.js";
export * from "./courseNormalizer.js";
export * from "./courseCapabilities.js";
export * from "./courseSelectors.js";
export * from "./lessonExperienceContext.js";
export * from "./lessonExperienceAdapters.js";
export { resolveClassroomPageLessonExperience } from "./lessonExperienceResolver.js";

if (typeof window !== "undefined") {
  window.GLOBAL_COURSE_ENGINE = GLOBAL_COURSE_ENGINE;
}
