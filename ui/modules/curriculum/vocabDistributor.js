/**
 * Lumina Vocabulary Distribution Engine
 * 支持：1) 课程映射分配（vocab-map） 2) 顺序切片分配（兜底）
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
 * 判断 mapItem 是否为复习课映射（reviewOf 数组）
 * @param {Object|Array} mapItem - vocab-map 中单课条目
 * @returns {boolean}
 */
export function isReviewMapItem(mapItem) {
  return Array.isArray(mapItem?.reviewOf);
}

/**
 * 在 vocabList 中查找词条，优先匹配 zh / word / hanzi / simplified / text
 * @param {string} term - 要查找的词（如 "你好"）
 * @param {Array} vocabList - 总词库
 * @returns {Object|null} 匹配到的 word object，未找到返回 null
 */
export function findWordInVocabList(term, vocabList) {
  if (!term || typeof term !== "string") return null;
  const t = String(term).trim();
  if (!t) return null;
  const list = Array.isArray(vocabList) ? vocabList : [];
  const fields = ["zh", "word", "hanzi", "simplified", "text"];
  for (const w of list) {
    if (!w || typeof w !== "object") continue;
    for (const f of fields) {
      const v = w[f];
      if (v != null && String(v).trim() === t) return w;
    }
  }
  if (typeof console !== "undefined" && console.warn) {
    console.warn("[VocabMap] missing vocab term:", t);
  }
  return null;
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
 * 顺序切片分配（兜底）：将总词库按 blueprint 顺序机械分配到各课
 * @param {string} level - "hsk1" | "hsk2"
 * @param {Object} blueprint - 已加载的课程蓝图
 * @param {Array} vocabList - HSK 总词库数组
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

/**
 * 根据 vocab-map 分配词汇（课程映射分配）
 * @param {string} level - "hsk1" | "hsk2"
 * @param {Object} vocabMap - 课程词汇映射（hsk1-vocab-map.json）
 * @param {Array} vocabList - HSK 总词库数组
 * @returns {Object} { "1": [...], "2": [...], ... }
 */
export function distributeVocabularyByMap(level, vocabMap, vocabList) {
  const result = {};
  const list = Array.isArray(vocabList) ? vocabList : [];
  if (!vocabMap || typeof vocabMap !== "object") return result;

  const keys = Object.keys(vocabMap)
    .filter((k) => k !== "description" && k !== "version" && /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));

  for (const key of keys) {
    const mapItem = vocabMap[key];

    if (isReviewMapItem(mapItem)) {
      const reviewOf = mapItem.reviewOf;
      const aggregated = [];
      const seen = new Set();

      for (const srcKey of reviewOf) {
        const srcWords = result[String(srcKey)];
        if (Array.isArray(srcWords)) {
          for (const w of srcWords) {
            const k = (w && (w.hanzi || w.word || w.zh)) || "";
            if (k && !seen.has(k)) {
              seen.add(k);
              aggregated.push(w);
            }
          }
        }
      }

      result[key] = aggregated;
      if (typeof console !== "undefined" && console.debug) {
        const range = reviewOf.length >= 2 ? `${reviewOf[0]}-${reviewOf[reviewOf.length - 1]}` : reviewOf.join(",");
        console.debug("[VocabMap] lesson", key, "review of lessons", range + ", total", aggregated.length, "words");
      }
      continue;
    }

    const terms = Array.isArray(mapItem) ? mapItem : [];
    const words = [];
    for (const term of terms) {
      const w = findWordInVocabList(term, list);
      if (w) words.push(w);
    }
    result[key] = words;

    if (typeof console !== "undefined" && console.debug) {
      console.debug("[VocabMap] lesson", key, "mapped", words.length, "words");
    }
  }

  return result;
}
