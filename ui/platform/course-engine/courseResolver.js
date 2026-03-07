/**
 * Global Course Engine v1 - 课程路径解析
 * 统一路径规则，页面层不拼路径
 */

import { getCourseConfig } from "./courseRegistry.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function getBase() {
  try {
    const base = window.DATA_PATHS?.getBase?.();
    if (base && str(base) && base !== ".") return String(base).replace(/\/+$/, "") + "/";
  } catch {}
  return "/";
}

function withBase(path) {
  const p = String(path).replace(/^\/+/, "");
  return getBase() + p;
}

/**
 * 解析课程路径
 * @param {{ courseType: string, version?: string, level: string, lessonId?: string, lessonNo?: number, file?: string }} input
 * @returns {{ manifestUrl: string, lessonUrl: string, courseId: string, lessonId: string, pathVersion: string, pathLevel: string }}
 */
export function resolveCoursePath(input = {}) {
  const courseType = str(input.courseType || "hsk");
  const version = str(input.version || "");
  const level = str(input.level || "hsk1");
  const lessonNo = Number(input.lessonNo ?? 1) || 1;
  const file = str(input.file || "");
  const lessonId = str(input.lessonId || "");

  const cfg = getCourseConfig(courseType);
  const pathVersionAsDir = cfg?.pathVersionAsDir ?? (courseType === "hsk");

  let pathVersion, pathLevel;

  if (courseType === "hsk") {
    // HSK: data/courses/hsk2.0/hsk1/ 或 data/courses/hsk3.0/hsk1/
    pathVersion = version || "hsk2.0";
    pathLevel = /^hsk\d+$/i.test(level) ? level.toLowerCase() : `hsk${level.replace(/\D/g, "") || "1"}`;
  } else {
    // kids / travel / business / culture: data/courses/kids/kids1/
    pathVersion = version || courseType;
    pathLevel = level || `${courseType}1`;
  }

  const basePath = `data/courses/${pathVersion}/${pathLevel}`;
  const manifestUrl = withBase(`${basePath}/lessons.json`);

  let lessonFile = file;
  if (!lessonFile) {
    lessonFile = `lesson${lessonNo}.json`;
  } else if (!lessonFile.endsWith(".json")) {
    lessonFile = `lesson${lessonNo}.json`;
  }
  // 保留 hsk1_lesson21.json 等完整文件名，不转换为 lesson21.json

  const lessonUrl = withBase(`${basePath}/${lessonFile}`);

  // HSK 保持 courseId = "hsk2.0_hsk1" 以兼容 Progress
  const courseId = courseType === "hsk"
    ? `${pathVersion}_${pathLevel}`
    : `${courseType}_${pathVersion}_${pathLevel}`;
  const resolvedLessonId = lessonId || `${courseId}_lesson${lessonNo}`;

  return {
    manifestUrl,
    lessonUrl,
    courseId,
    lessonId: resolvedLessonId,
    pathVersion,
    pathLevel,
    lessonFile,
  };
}
