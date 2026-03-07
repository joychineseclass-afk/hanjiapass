/**
 * Global Course Engine v1 - 统一对外接口
 * 支持 HSK / Kids / Travel / Business / Culture
 */

import { COURSE_REGISTRY, getCourseConfig } from "./courseRegistry.js";
import { resolveCoursePath } from "./courseResolver.js";
import { loadCourseManifest, loadLesson as loadLessonRaw } from "./courseLoader.js";
import { normalizeLesson } from "./courseNormalizer.js";
import { getCourseCapabilities as getCapabilities } from "./courseCapabilities.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * 将 legacy 输入转为标准输入
 * page.hsk 传入 courseType: "hsk2.0" 时，转为 courseType: "hsk", version: "hsk2.0"
 */
function normalizeInput(input = {}) {
  const ct = str(input.courseType || "");
  const version = str(input.version || "");
  const level = str(input.level || "hsk1");

  if (/^hsk[23]\.0$/i.test(ct)) {
    return {
      courseType: "hsk",
      version: ct,
      level: level || "hsk1",
      lessonNo: input.lessonNo,
      lessonId: input.lessonId,
      file: input.file,
    };
  }
  return {
    courseType: ct || "hsk",
    version: version || (ct === "hsk" ? "hsk2.0" : ct),
    level,
    lessonNo: input.lessonNo,
    lessonId: input.lessonId,
    file: input.file,
  };
}

/**
 * 获取课程注册表
 */
export function getCourseRegistry() {
  return { ...COURSE_REGISTRY };
}

/**
 * 解析课程路径
 */
export function resolveCourse(input) {
  const norm = normalizeInput(input);
  return resolveCoursePath(norm);
}

/**
 * 加载课程目录
 */
export async function loadCourse(input) {
  const norm = normalizeInput(input);
  return loadCourseManifest(norm);
}

/**
 * 加载单课（原始 + 归一化）
 * @returns {Promise<{ raw, lesson, resolved }>}
 */
export async function loadLesson(input) {
  const norm = normalizeInput(input);
  const { raw, resolved } = await loadLessonRaw(norm);
  const context = {
    courseType: norm.courseType,
    version: resolved.pathVersion,
    level: resolved.pathLevel,
    lessonNo: Number(norm.lessonNo ?? 1) || 1,
    file: resolved.lessonFile,
    lessonId: resolved.lessonId,
    courseId: resolved.courseId,
  };
  const lesson = normalizeLesson(raw, context);
  return { raw, lesson, resolved };
}

/**
 * 标准化 lesson（对外别名）
 */
export function normalizeLessonForEngine(rawLesson, context) {
  return normalizeLesson(rawLesson, context);
}

/**
 * 获取课程能力
 */
export function getCourseCapabilities(courseType) {
  const ct = str(courseType || "");
  if (/^hsk[23]\.0$/i.test(ct)) return getCapabilities("hsk");
  return getCapabilities(ct || "hsk");
}
