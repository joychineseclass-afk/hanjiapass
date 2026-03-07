/**
 * Global Course Engine v1 - 课程注册表
 * 配置式注册，支持 HSK / Kids / Travel / Business / Culture
 */

export const COURSE_REGISTRY = {
  hsk: {
    label: "HSK",
    versions: ["hsk2.0", "hsk3.0"],
    supportedLevels: ["hsk1", "hsk2", "hsk3", "hsk4", "hsk5", "hsk6", "hsk7", "hsk8", "hsk9"],
    lessonSchema: "lumina-lesson-schema-v1",
    /** HSK 路径使用 version 作为目录名 */
    pathVersionAsDir: true,
  },

  kids: {
    label: "Kids Chinese",
    versions: ["kids"],
    supportedLevels: ["kids1", "kids2", "kids3"],
    lessonSchema: "lumina-lesson-schema-v1",
    pathVersionAsDir: false,
  },

  travel: {
    label: "Travel Chinese",
    versions: ["travel"],
    supportedLevels: ["travel1", "travel2"],
    lessonSchema: "lumina-lesson-schema-v1",
    pathVersionAsDir: false,
  },

  business: {
    label: "Business Chinese",
    versions: ["business"],
    supportedLevels: ["business1", "business2"],
    lessonSchema: "lumina-lesson-schema-v1",
    pathVersionAsDir: false,
  },

  culture: {
    label: "Culture Chinese",
    versions: ["culture"],
    supportedLevels: ["culture1", "culture2"],
    lessonSchema: "lumina-lesson-schema-v1",
    pathVersionAsDir: false,
  },
};

/**
 * 获取课程类型配置
 */
export function getCourseConfig(courseType) {
  return COURSE_REGISTRY[courseType] ?? null;
}

/**
 * 检查课程类型是否支持指定 version
 */
export function isVersionSupported(courseType, version) {
  const cfg = getCourseConfig(courseType);
  if (!cfg) return false;
  return (cfg.versions || []).includes(version);
}

/**
 * 检查课程类型是否支持指定 level
 */
export function isLevelSupported(courseType, level) {
  const cfg = getCourseConfig(courseType);
  if (!cfg) return false;
  return (cfg.supportedLevels || []).includes(level);
}
