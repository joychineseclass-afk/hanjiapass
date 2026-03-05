// ui/platform/index.js
// Platform 统一导出入口

export { CONTENT } from "./content/contentLoader.js";
export { AI_SERVICE } from "./capabilities/ai/aiService.js";
export { PromptBuilder } from "./capabilities/ai/promptBuilder.js";
export { SchemaValidator } from "./capabilities/ai/schemaValidator.js";
export { LearnerModel } from "./capabilities/ai/learnerModel.js";
export { loadCourse } from "./courses/courseEngine.js";
export {
  getCourseRouteState,
  getStrokeRouteState,
  getHanjaRouteState,
  getClassroomRouteState,
  parseHashQuery,
} from "./courses/courseRouterHook.js";
