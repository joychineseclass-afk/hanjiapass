/**
 * Lumina Vocabulary Distribution Engine
 * 支持：1) 课程映射分配（vocab-map core/extra） 2) 顺序切片分配（兜底）
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
 * @param {Object} opts - { silent: true } 不输出 warn
 * @returns {Object|null} 匹配到的 word object，未找到返回 null
 */
export function findWordInVocabList(term, vocabList, opts = {}) {
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
  if (!opts.silent && typeof console !== "undefined" && console.warn) {
    console.warn("[VocabMap] missing vocab term:", t);
  }
  return null;
}

/**
 * 从 word object 取唯一 key（hanzi / word / zh）
 */
function wordKey(w) {
  if (!w || typeof w !== "object") return "";
  return String(w.hanzi ?? w.word ?? w.zh ?? "").trim();
}

/**
 * 审计词汇覆盖率
 * @param {Object} vocabMap - 课程词汇映射
 * @param {Array} vocabList - 总词库
 * @returns {Object} { total, coreMapped, extraMapped, uniqueMapped, unmappedCount, unmappedTerms }
 */
export function auditVocabularyCoverage(vocabMap, vocabList) {
  const list = Array.isArray(vocabList) ? vocabList : [];
  const total = list.length;
  const vocabKeys = new Set(list.map((w) => wordKey(w)).filter(Boolean));

  const coreTerms = new Set();
  const extraTerms = new Set();

  if (!vocabMap || typeof vocabMap !== "object") {
    const out = { total, coreMapped: 0, extraMapped: 0, uniqueMapped: 0, unmappedCount: total, unmappedTerms: list.map((w) => wordKey(w)).filter(Boolean) };
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[VocabAudit] total:", total);
      console.debug("[VocabAudit] no vocab map");
    }
    return out;
  }

  const keys = Object.keys(vocabMap).filter((k) => k !== "description" && k !== "version" && /^\d+$/.test(k));

  for (const key of keys) {
    const mapItem = vocabMap[key];
    if (isReviewMapItem(mapItem)) continue;

    const core = Array.isArray(mapItem?.core) ? mapItem.core : [];
    const extra = Array.isArray(mapItem?.extra) ? mapItem.extra : [];
    for (const t of core) {
      if (t && String(t).trim()) coreTerms.add(String(t).trim());
    }
    for (const t of extra) {
      if (t && String(t).trim()) extraTerms.add(String(t).trim());
    }
  }

  const uniqueMapped = new Set([...coreTerms, ...extraTerms]);
  const mappedInVocab = new Set();
  for (const t of uniqueMapped) {
    const w = findWordInVocabList(t, list, { silent: true });
    if (w) mappedInVocab.add(wordKey(w));
  }

  const coreMapped = [...coreTerms].filter((t) => findWordInVocabList(t, list, { silent: true })).length;
  const extraMapped = [...extraTerms].filter((t) => findWordInVocabList(t, list, { silent: true })).length;
  const unmappedTerms = [...vocabKeys].filter((k) => !mappedInVocab.has(k));
  const unmappedCount = unmappedTerms.length;

  if (typeof console !== "undefined" && console.debug) {
    console.debug("[VocabAudit] total:", total);
    console.debug("[VocabAudit] core mapped:", coreMapped);
    console.debug("[VocabAudit] extra mapped:", extraMapped);
    console.debug("[VocabAudit] unique mapped:", uniqueMapped.size);
    console.debug("[VocabAudit] unmapped:", unmappedCount);
  }

  return {
    total,
    coreMapped,
    extraMapped,
    uniqueMapped: uniqueMapped.size,
    unmappedCount,
    unmappedTerms,
  };
}

/**
 * 返回按数字顺序排序的 lesson key 数组
 */
export function getLessonKeysForDistribution(blueprint) {
  if (!blueprint || typeof blueprint !== "object") return [];
  const keys = Object.keys(blueprint).filter((k) => /^\d+$/.test(k));
  return keys.sort((a, b) => Number(a) - Number(b));
}

const WORDS_PER_LESSON = 7;

/**
 * 顺序切片分配（兜底）
 */
export function distributeVocabulary(level, blueprint, vocabList) {
  const result = { core: {}, extra: {} };
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
      result.core[key] = [];
      result.extra[key] = [];
      if (typeof console !== "undefined" && console.debug) {
        console.debug("[VocabDistributor] lesson", key, "review lesson, assigned 0 words");
      }
      continue;
    }

    const take = WORDS_PER_LESSON;
    const slice = list.slice(cursor, cursor + take);
    cursor += slice.length;
    result.core[key] = slice;
    result.extra[key] = [];

    if (typeof console !== "undefined" && console.debug) {
      console.debug("[VocabDistributor] lesson", key, "assigned", slice.length, "words");
    }
  }

  return result;
}

/**
 * 解析 mapItem 的 core/extra（兼容旧数组格式）
 */
function getCoreExtraTerms(mapItem) {
  if (isReviewMapItem(mapItem)) return { core: [], extra: [] };
  if (Array.isArray(mapItem)) return { core: mapItem, extra: [] };
  const core = Array.isArray(mapItem?.core) ? mapItem.core : [];
  const extra = Array.isArray(mapItem?.extra) ? mapItem.extra : [];
  return { core, extra };
}

/**
 * 根据 vocab-map 分配词汇（core/extra 结构）
 * @returns {Object} { core: { "1": [...] }, extra: { "1": [...] } }
 */
export function distributeVocabularyByMap(level, vocabMap, vocabList) {
  const result = { core: {}, extra: {} };
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
        const srcCore = result.core[String(srcKey)];
        if (Array.isArray(srcCore)) {
          for (const w of srcCore) {
            const k = wordKey(w);
            if (k && !seen.has(k)) {
              seen.add(k);
              aggregated.push(w);
            }
          }
        }
      }

      result.core[key] = aggregated;
      result.extra[key] = [];
      if (typeof console !== "undefined" && console.debug) {
        const range = reviewOf.length >= 2 ? `${reviewOf[0]}-${reviewOf[reviewOf.length - 1]}` : reviewOf.join(",");
        console.debug("[VocabMap] lesson", key, "review of lessons", range + ", total", aggregated.length, "words");
      }
      continue;
    }

    const { core: coreTerms, extra: extraTerms } = getCoreExtraTerms(mapItem);
    const coreWords = [];
    const extraWords = [];
    for (const term of coreTerms) {
      const w = findWordInVocabList(term, list);
      if (w) coreWords.push(w);
    }
    for (const term of extraTerms) {
      const w = findWordInVocabList(term, list);
      if (w) extraWords.push(w);
    }
    result.core[key] = coreWords;
    result.extra[key] = extraWords;

    if (typeof console !== "undefined" && console.debug) {
      console.debug("[VocabMap] lesson", key, "mapped core:", coreWords.length, "extra:", extraWords.length);
    }
  }

  return result;
}
