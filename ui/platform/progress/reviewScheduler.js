/**
 * Progress Engine v1 - 复习调度规则
 * 简单可运行的复习算法，非完整 SM-2
 */

const MS_DAY = 24 * 60 * 60 * 1000;

/** 答对后的间隔天数：第1次=1天，第2次=3天，第3次=7天，第4次及以上=15天 */
const CORRECT_INTERVALS = [1, 3, 7, 15];

/**
 * 计算下次复习时间
 * @param {{ status: string, correctCount: number, isCorrect: boolean }} opts
 * @param {number} [now]
 * @returns {number} timestamp
 */
export function getNextReviewAt({ status, correctCount, isCorrect }, now = Date.now()) {
  if (!isCorrect) return now;
  const idx = Math.min(correctCount, CORRECT_INTERVALS.length - 1);
  const days = CORRECT_INTERVALS[idx];
  return now + days * MS_DAY;
}

/**
 * 计算下次状态
 * @param {{ status: string, correctCount: number, isCorrect: boolean }} opts
 * @returns {string} new | learning | review | mastered
 */
export function getNextStatus({ status, correctCount, isCorrect }) {
  if (!isCorrect) return "learning";
  if (correctCount >= 4) return "mastered";
  if (status === "new" || status === "learning") return "learning";
  return status;
}

/**
 * 是否到期复习
 * @param {{ nextReviewAt?: number, status?: string }} item
 * @param {number} [now]
 */
export function isDueReview(item, now = Date.now()) {
  if (!item) return false;
  if (item.status === "mastered") return false;
  const next = Number(item.nextReviewAt ?? 0);
  return next <= now || next === 0;
}
