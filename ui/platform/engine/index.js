/**
 * 平台级 Lesson Engine 统一入口
 */

export { loadCourseIndex, loadLessonDetail, getStepList, startLesson } from "./lessonEngine.js";
export { STEP_KEYS, normalizeStepKey, getDefaultStepsByLesson, normalizeSteps } from "./stepRegistry.js";
