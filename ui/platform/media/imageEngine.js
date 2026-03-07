/**
 * Image Engine v1 - 平台级统一图片接口
 * 内部委托 imageResolver；未来接 CDN / AI API 只改此处
 */

import * as ImageResolver from "./imageResolver.js";

/**
 * 获取词汇图片 URL
 * @param {object} word - { hanzi, id, ... }
 * @param {object} opts - { id }
 * @returns {string} 图片路径，无则空字符串
 */
export function getWordImage(word, opts = {}) {
  try {
    return ImageResolver.resolveWordImage(word, opts) || "";
  } catch {
    return "";
  }
}

/**
 * 获取课程封面图 URL
 * @param {object} lesson - { courseId, lessonNo, ... } 或从 loadLessonDetail 返回
 * @param {object} opts - { courseType, level }
 * @returns {string} 图片路径，无则空字符串
 */
export function getLessonImage(lesson, opts = {}) {
  try {
    const meta = {
      courseType: opts.courseType ?? lesson?.version ?? "hsk2.0",
      level: opts.level ?? (lesson?.courseId ? lesson.courseId.split("_").pop() : "hsk1"),
      lessonNo: lesson?.lessonNo ?? lesson?.lesson ?? lesson?.no ?? 0,
    };
    return ImageResolver.resolveLessonImage(meta) || "";
  } catch {
    return "";
  }
}

/**
 * 获取对话场景图 URL
 * @param {object} lesson - 课程对象
 * @param {object} scene - { sceneId, ... } 或 dialogue 行
 * @param {object} opts - { courseType, level, sceneId }
 * @returns {string} 图片路径，无则空字符串
 */
export function getDialogueImage(lesson, scene, opts = {}) {
  try {
    const meta = {
      courseType: opts.courseType ?? lesson?.version ?? "hsk2.0",
      level: opts.level ?? (lesson?.courseId ? lesson.courseId.split("_").pop() : "hsk1"),
      lessonNo: lesson?.lessonNo ?? lesson?.lesson ?? lesson?.no ?? 0,
      sceneId: opts.sceneId ?? scene?.sceneId ?? scene?.scene ?? String(scene?.index ?? 0),
    };
    return ImageResolver.resolveDialogueImage(meta) || "";
  } catch {
    return "";
  }
}
