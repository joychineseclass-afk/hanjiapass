/**
 * Global Course Engine v1 - 课程能力映射
 * 定义某类课程启用哪些 tab/能力
 */

const DEFAULT = {
  vocab: true,
  dialogue: true,
  grammar: true,
  extension: true,
  practice: true,
  ai: true,
  review: true,
  scene: true,
};

/**
 * 获取课程类型的能力配置
 * @param {string} courseType - hsk | kids | travel | business | culture
 * @returns {object}
 */
export function getCourseCapabilities(courseType) {
  const t = String(courseType || "").toLowerCase();
  switch (t) {
    case "hsk":
      return {
        vocab: true,
        dialogue: true,
        grammar: true,
        extension: true,
        practice: true,
        ai: true,
        review: true,
        scene: true,
      };

    case "kids":
      return {
        vocab: true,
        dialogue: true,
        grammar: false,
        extension: true,
        practice: true,
        ai: true,
        review: true,
        scene: true,
      };

    case "travel":
      return {
        vocab: true,
        dialogue: true,
        grammar: true,
        extension: true,
        practice: true,
        ai: true,
        review: false,
        scene: true,
      };

    case "business":
      return {
        vocab: true,
        dialogue: true,
        grammar: true,
        extension: true,
        practice: true,
        ai: true,
        review: true,
        scene: true,
      };

    case "culture":
      return {
        vocab: true,
        dialogue: true,
        grammar: true,
        extension: true,
        practice: true,
        ai: true,
        review: true,
        scene: true,
      };

    default:
      return { ...DEFAULT };
  }
}
