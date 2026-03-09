/**
 * Practice Generator v2 - 题量配置
 * HSK1~4 学生端：choice 为主，fill/match/order 少量
 * 老师端可 override 题量与题型
 */

export const PRACTICE_COUNT_BY_LEVEL = {
  hsk1: 5,
  hsk2: 5,
  hsk3: 8,
  hsk4: 10,
  hsk5: 15,
  hsk6: 15,
  lv7: 20,
  lv8: 20,
  lv9: 20,
};

/**
 * 题型数量分配（按等级）
 * HSK1/2: vocab + meaning_to_vocab + dialogue_response + grammar_fill + extension/dialogue_detail
 * HSK3/4: 3 vocab, 2 dialogue, 2 grammar, 2 sentence_order, 1 extension
 * HSK5/6: 5 vocab, 4 dialogue, 3 grammar, 3 extension/order
 * HSK7~9: 6 vocab, 5 dialogue, 4 grammar, 5 extension
 */
export const QUOTA_BY_LEVEL = {
  hsk1: { vocab: 2, dialogue: 1, grammar: 1, extension: 1 },
  hsk2: { vocab: 2, dialogue: 1, grammar: 1, extension: 1 },
  hsk3: { vocab: 3, dialogue: 2, grammar: 2, sentenceOrder: 2, extension: 1 },
  hsk4: { vocab: 3, dialogue: 2, grammar: 2, sentenceOrder: 2, extension: 1 },
  hsk5: { vocab: 5, dialogue: 4, grammar: 3, extension: 3 },
  hsk6: { vocab: 5, dialogue: 4, grammar: 3, extension: 3 },
  lv7: { vocab: 6, dialogue: 5, grammar: 4, extension: 5 },
  lv8: { vocab: 6, dialogue: 5, grammar: 4, extension: 5 },
  lv9: { vocab: 6, dialogue: 5, grammar: 4, extension: 5 },
};

export function getTargetPracticeCount({ course, level } = {}) {
  const lv = parseInt(String(level || "").replace(/\D/g, ""), 10) || 1;
  if (lv <= 2) return PRACTICE_COUNT_BY_LEVEL.hsk2;
  if (lv <= 4) return PRACTICE_COUNT_BY_LEVEL.hsk4;
  if (lv <= 6) return PRACTICE_COUNT_BY_LEVEL.hsk6;
  return PRACTICE_COUNT_BY_LEVEL.lv7;
}

export function getQuotaByLevelNum(levelNum) {
  const lv = Math.min(9, Math.max(1, levelNum));
  if (lv <= 2) return QUOTA_BY_LEVEL.hsk2;
  if (lv <= 4) return QUOTA_BY_LEVEL.hsk4;
  if (lv <= 6) return QUOTA_BY_LEVEL.hsk6;
  return QUOTA_BY_LEVEL.lv7;
}
