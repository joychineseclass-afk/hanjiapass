/**
 * Global Course Engine v1 - 课程选择器
 * 辅助获取课程列表、当前课程等
 */

import { COURSE_REGISTRY } from "./courseRegistry.js";

/**
 * 获取所有已注册课程类型
 */
export function getAllCourseTypes() {
  return Object.keys(COURSE_REGISTRY);
}

/**
 * 获取课程类型的版本列表
 */
export function getVersionsForCourseType(courseType) {
  const cfg = COURSE_REGISTRY[courseType];
  return cfg?.versions ?? [];
}

/**
 * 获取课程类型的等级列表
 */
export function getLevelsForCourseType(courseType) {
  const cfg = COURSE_REGISTRY[courseType];
  return cfg?.supportedLevels ?? [];
}
