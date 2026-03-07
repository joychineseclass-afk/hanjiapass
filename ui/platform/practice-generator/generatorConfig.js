/**
 * Practice Generator v2 - 题量配置
 * 按等级控制每课目标题量
 */

export const PRACTICE_COUNT_BY_LEVEL = {
  hsk1: 5,
  hsk2: 5,
  hsk3: 10,
  hsk4: 10,
  hsk5: 15,
  hsk6: 15,
  lv7: 20,
  lv8: 20,
  lv9: 20,
};

/** 题型数量分配（按等级） */
export const QUOTA_BY_LEVEL = {
  hsk1: { vocab: 2, dialogue: 1, grammar: 1, extension: 1 },
  hsk2: { vocab: 2, dialogue: 1, grammar: 1, extension: 1 },
  hsk3: { vocab: 4, dialogue: 2, grammar: 2, extension: 2 },
  hsk4: { vocab: 4, dialogue: 2, grammar: 2, extension: 2 },
  hsk5: { vocab: 5, dialogue: 4, grammar: 3, extension: 3 },
  hsk6: { vocab: 5, dialogue: 4, grammar: 3, extension: 3 },
  lv7: { vocab: 6, dialogue: 5, grammar: 4, extension: 5 },
  lv8: { vocab: 6, dialogue: 5, grammar: 4, extension: 5 },
  lv9: { vocab: 6, dialogue: 5, grammar: 4, extension: 5 },
};

/**
 * 获取目标题量
 * @param {{ course?: string, level?: string }} opts
 * @returns {number}
 */
export function getTargetPracticeCount({ course, level } = {}) {
  const lv = parseInt(String(level || "").replace(/\D/g, ""), 10) || 1;
  if (lv <= 2) return PRACTICE_COUNT_BY_LEVEL.hsk2;
  if (lv <= 4) return PRACTICE_COUNT_BY_LEVEL.hsk4;
  if (lv <= 6) return PRACTICE_COUNT_BY_LEVEL.hsk6;
  return PRACTICE_COUNT_BY_LEVEL.lv7;
}

/**
 * 获取题型配额
 * @param {number} levelNum - 1-9
 * @returns {object}
 */
export function getQuotaByLevelNum(levelNum) {
  const lv = Math.min(9, Math.max(1, levelNum));
  if (lv <= 2) return QUOTA_BY_LEVEL.hsk2;
  if (lv <= 4) return QUOTA_BY_LEVEL.hsk4;
  if (lv <= 6) return QUOTA_BY_LEVEL.hsk6;
  return QUOTA_BY_LEVEL.lv7;
}
