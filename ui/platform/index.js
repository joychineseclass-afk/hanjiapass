// ui/platform/index.js
// Platform 统一导出入口

export { CONTENT } from "./content/contentLoader.js";
export * as LESSON_ENGINE from "./engine/index.js";
export * as LESSON_RENDERER from "./renderers/lessonRenderer.js";
export * as STEP_RENDERERS from "./renderers/stepRenderers.js";
export * as PRACTICE from "./practice/practiceEngine.js";
export { mountPractice } from "./practice/practiceRenderer.js";
export * as IMAGE_ENGINE from "./media/imageEngine.js";
import * as SCENE_ENGINE from "./scene/sceneEngine.js";
export { SCENE_ENGINE };
if (typeof window !== "undefined") window.SCENE_ENGINE = SCENE_ENGINE;
export * as AI_CAPABILITY from "./capabilities/ai/index.js";
export { AI_SERVICE } from "./capabilities/ai/aiService.js";
export { PromptBuilder } from "./capabilities/ai/promptBuilder.js";
export { SchemaValidator } from "./capabilities/ai/schemaValidator.js";
export { LearnerModel } from "./capabilities/ai/learnerModel.js";
import { loadCourse } from "./courses/courseEngine.js";
export { loadCourse };
export const COURSES = { loadCourse };
export {
  getCourseRouteState,
  getStrokeRouteState,
  getHanjaRouteState,
  getClassroomRouteState,
  parseHashQuery,
} from "./courses/courseRouterHook.js";
