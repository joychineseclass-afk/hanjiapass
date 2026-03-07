/**
 * 平台级统一 Lesson Engine v1
 * 不写死 HSK，支持多种课程类型
 */

import * as CourseLoader from "../content/courseLoader.js";
import { normalizeSteps } from "./stepRegistry.js";

/**
 * 加载课程目录
 * @param {{ courseType: string, level: string }} opts
 * @returns {Promise<{ courseId, courseType, level, title, lessons }>}
 */
export async function loadCourseIndex(opts) {
  return CourseLoader.loadCourseIndex(opts);
}

/**
 * 加载单课详情（自动归一化）
 * @param {{ courseType, level, file, lessonId, lessonNo }} opts
 * @returns {Promise<{ raw, lesson }>}
 */
export async function loadLessonDetail(opts) {
  return CourseLoader.loadLessonDetail(opts);
}

/**
 * 获取标准 steps
 * @param {object} lesson - 归一化后的 lesson
 * @returns {Array<{ key, label }>}
 */
export function getStepList(lesson) {
  return normalizeSteps(lesson?.steps, lesson);
}

/**
 * 启动课程，输出标准 lesson state
 * @param {{ lesson: object }} opts
 * @returns {{ lesson, steps, currentStep, lessonWords }}
 */
export function startLesson({ lesson } = {}) {
  if (!lesson) return { lesson: null, steps: [], currentStep: null, lessonWords: [] };

  const steps = getStepList(lesson);
  const lessonWords = Array.isArray(lesson.vocab) ? lesson.vocab : [];

  return {
    lesson,
    steps,
    currentStep: steps[0] ?? null,
    lessonWords,
  };
}
