/**
 * Progress Engine v1 - 本地存储
 * 负责 localStorage 读写、初始化、版本兼容
 */

const STORAGE_KEY = "lumina_progress_v1";

function getEmptyProgress() {
  return {
    version: 1,
    updatedAt: 0,
    courses: {},
    wrongQuestions: [],
  };
}

/**
 * 加载进度数据
 * @returns {object}
 */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getEmptyProgress();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return getEmptyProgress();
    if (data.version !== 1) return migrateOrReset(data);
    data.courses = data.courses && typeof data.courses === "object" ? data.courses : {};
    if (!Array.isArray(data.wrongQuestions)) data.wrongQuestions = [];
    return data;
  } catch {
    return getEmptyProgress();
  }
}

/**
 * 保存进度数据
 * @param {object} data
 */
export function saveProgress(data) {
  if (!data || typeof data !== "object") return;
  try {
    data.updatedAt = Date.now();
    data.version = 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[Progress] save failed:", e?.message);
  }
}

/**
 * 版本迁移或重置
 */
function migrateOrReset(data) {
  if (data?.version === 1) return data;
  return getEmptyProgress();
}

/**
 * 重置指定课程或全部
 * @param {string} [courseId] - 不传则重置全部
 */
export function resetProgress(courseId) {
  const data = loadProgress();
  if (!courseId) {
    saveProgress(getEmptyProgress());
    return;
  }
  if (data.courses[courseId]) {
    delete data.courses[courseId];
    saveProgress(data);
  }
}

export { getEmptyProgress };
