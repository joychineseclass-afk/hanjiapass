/**
 * Lumina Vocabulary Distribution Engine
 * 根据 blueprint + 总词库自动分配每课词汇，不依赖手动硬写单词列表
 */

/**
 * 判断是否为复习课（不分配新词）
 * @param {Object} blueprintItem - blueprint 中单课条目
 * @returns {boolean}
 */
export function isReviewLesson(blueprintItem) {
  return blueprintItem?.scene === "review";
}

/**
 * 返回按数字顺序排序的 lesson key 数组
 * @param {Object} blueprint - 课程蓝图
 * @returns {string[]} 例如 ["1","2","3",...,"22"]
 */
export function getLessonKeysForDistribution(blueprint) {
  if (!blueprint || typeof blueprint !== "object") return [];
  const keys = Object.keys(blueprint).filter((k) => /^\d+$/.test(k));
  return keys.sort((a, b) => Number(a) - Number(b));
}

const WORDS_PER_LESSON = 7;

/**
 * 将总词库按 blueprint 顺序分配到各课
 * @param {string} level - "hsk1" | "hsk2"
 * @param {Object} blueprint - 已加载的课程蓝图
 * @param {Array} vocabList - HSK 总词库数组（word objects）
 * @returns {Object} { "1": [...], "2": [...], ... }
 */
export function distributeVocabulary(level, blueprint, vocabList) {
  const result = {};
  const list = Array.isArray(vocabList) ? vocabList : [];
  const keys = getLessonKeysForDistribution(blueprint);

  if (typeof console !== "undefined" && console.debug) {
    console.debug("[VocabDistributor] level:", level);
    console.debug("[VocabDistributor] total vocab count:", list.length);
    console.debug("[VocabDistributor] lesson keys:", keys);
  }

  let cursor = 0;

  for (const key of keys) {
    const entry = blueprint[key];
    if (isReviewLesson(entry)) {
      result[key] = [];
      if (typeof console !== "undefined" && console.debug) {
        console.debug("[VocabDistributor] lesson", key, "review lesson, assigned 0 words");
      }
      continue;
    }

    const take = WORDS_PER_LESSON;
    const slice = list.slice(cursor, cursor + take);
    cursor += slice.length;
    result[key] = slice;

    if (typeof console !== "undefined" && console.debug) {
      console.debug("[VocabDistributor] lesson", key, "assigned", slice.length, "words");
    }
  }

  return result;
}
