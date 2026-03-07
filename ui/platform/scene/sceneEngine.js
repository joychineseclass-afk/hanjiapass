/**
 * Scene Engine v1 - 统一 scene 接口
 * 不写死 HSK，可复用到 kids / travel / business / culture
 */

import { normalizeScene } from "./sceneNormalizer.js";
import { resolveFrameDialogue, getSceneFocusWords } from "./sceneUtils.js";

/**
 * 从 lesson 获取标准化 scene
 */
export function getSceneFromLesson(lesson) {
  if (!lesson?.scene) return null;
  return normalizeScene(lesson.scene);
}

/**
 * lesson 是否包含 scene
 */
export function hasScene(lesson) {
  return !!(lesson?.scene && typeof lesson.scene === "object");
}

/**
 * 获取场景学习目标
 */
export function getSceneGoals(scene) {
  if (!scene?.goal) return [];
  return Array.isArray(scene.goal) ? scene.goal : [];
}

/**
 * 获取场景角色列表
 */
export function getSceneCharacters(scene) {
  if (!scene?.characters) return [];
  return Array.isArray(scene.characters) ? scene.characters : [];
}

/**
 * 获取场景分镜列表
 */
export function getSceneFrames(scene) {
  if (!scene?.frames) return [];
  return Array.isArray(scene.frames) ? scene.frames : [];
}

/**
 * 获取 frame -> dialogue 映射（用于分镜版对话展示）
 */
export function getSceneDialogueMap(scene, lesson) {
  const frames = getSceneFrames(scene);
  const map = new Map();
  frames.forEach((frame) => {
    const line = resolveFrameDialogue(frame, lesson);
    if (line) map.set(frame.id, { frame, line });
  });
  return map;
}

/**
 * 预留：获取 scene 相关的练习提示（供 Practice Engine 扩展）
 */
export function getScenePracticeHints(scene) {
  if (!scene?.frames) return [];
  const hints = [];
  scene.frames.forEach((f) => {
    const words = getSceneFocusWords(f);
    if (words.length) hints.push({ frameId: f.id, focusWords: words });
  });
  return hints;
}
