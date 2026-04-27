/**
 * 学生端「继续学习」最小本地记录（无后端），供 #my-learning 与埋点用。
 */
import { LUMINA_DEFAULT_LEARNING_ENTRY_HASH } from "../auth/postAuthRedirect.js";

export { LUMINA_DEFAULT_LEARNING_ENTRY_HASH } from "../auth/postAuthRedirect.js";

const STORAGE_KEY = "lumina_learner_resume_v1";

/**
 * @typedef {{
 *  courseType: string,
 *  level: string,
 *  lessonId: string,
 *  lessonTitle: string,
 *  lastVisitedAt: string,
 *  entryHash: string,
 * }} LearnerResume
 */

/**
 * 从 HSK 当前状态构建与默认格式一致的回跳 hash
 */
export function buildLearnerResumeEntryHash({ version, lv, lessonNo, file }) {
  const p = new URLSearchParams();
  p.set("tab", "hsk");
  p.set("ver", String(version || "hsk2.0"));
  p.set("lv", String(lv != null && !Number.isNaN(Number(lv)) ? Number(lv) : 1));
  p.set("lesson", String(lessonNo != null && !Number.isNaN(Number(lessonNo)) ? Number(lessonNo) : 1));
  const f = String(file || "").trim();
  if (f) p.set("file", f);
  return `#exam?${p.toString()}`;
}

/**
 * @param {Omit<LearnerResume, never>} data
 */
export function recordLearnerResume(data) {
  try {
    if (!data || !data.entryHash) return;
    const payload = {
      courseType: String(data.courseType || "hsk"),
      level: String(data.level || "1"),
      lessonId: String(data.lessonId || ""),
      lessonTitle: String(data.lessonTitle || "").slice(0, 200),
      lastVisitedAt: String(data.lastVisitedAt || new Date().toISOString()),
      entryHash: String(data.entryHash).slice(0, 1024),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* */
  }
}

/** @returns {LearnerResume | null} */
export function readLearnerResume() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    if (!o.entryHash) return null;
    return o;
  } catch {
    return null;
  }
}

export function hasMeaningfulLearnerResume() {
  return !!readLearnerResume()?.lastVisitedAt;
}
