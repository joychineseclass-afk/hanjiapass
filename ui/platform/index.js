// ui/platform/index.js
// Platform 统一导出入口

// 预加载 Global Course Engine，供 courseLoader 底层委托
import "./course-engine/index.js";

export { CONTENT } from "./content/contentLoader.js";
export * as LESSON_ENGINE from "./engine/index.js";
export * as LESSON_RENDERER from "./renderers/lessonRenderer.js";
export * as STEP_RENDERERS from "./renderers/stepRenderers.js";
export * as PRACTICE from "../modules/practice/practiceEngine.js";
export { mountPractice, rerenderPractice } from "../modules/practice/practiceRenderer.js";
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
export { PROGRESS_ENGINE, PROGRESS_SELECTORS } from "./progress/index.js";
export * as REVIEW from "./review/index.js";
export { renderReviewMode, prepareReviewSession } from "./review/index.js";
import {
  TTS_ENGINE,
  AUDIO_ENGINE,
  stopAllLearningAudio,
  stopAllPlayback,
  playSingleText,
  playSequence,
  pauseCurrentPlayback,
  resumeCurrentPlayback,
  setLoopMode,
  TTS_SCOPE,
  getPlaybackSnapshot,
} from "./audio/index.js";
export {
  TTS_ENGINE,
  AUDIO_ENGINE,
  stopAllLearningAudio,
  stopAllPlayback,
  playSingleText,
  playSequence,
  pauseCurrentPlayback,
  resumeCurrentPlayback,
  setLoopMode,
  TTS_SCOPE,
  getPlaybackSnapshot,
};
if (typeof window !== "undefined") {
  window.TTS_ENGINE = TTS_ENGINE;
  window.AUDIO_ENGINE = AUDIO_ENGINE;
}
