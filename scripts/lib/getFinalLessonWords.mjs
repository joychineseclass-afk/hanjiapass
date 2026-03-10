/**
 * getFinalLessonWords - 与页面单词 tab 一致的最终词汇
 *
 * 规则：mergeLessonVocabulary(lesson) = coreWords + extraWords（去重）
 * 来源：vocab-map core/extra → distributeVocabularyByMap → applyVocabDistribution
 *
 * 供 Node 脚本使用，不依赖浏览器。
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

function wordKey(w) {
  if (!w || typeof w !== "object") return "";
  return String(w.hanzi ?? w.word ?? w.zh ?? "").trim();
}

function findWordInVocabList(term, vocabList) {
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
  return null;
}

/**
 * 加载 vocab-map
 */
export function loadVocabMap(levelKey) {
  const path = join(ROOT, `data/pedagogy/${levelKey}-vocab-map.json`);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, "utf-8"));
  return data && typeof data === "object" ? data : null;
}

/**
 * 加载 vocab 总表（hsk1.json 等）
 */
export function loadVocabList(lv, version = "hsk2.0") {
  const path = join(ROOT, `data/vocab/${version}/hsk${lv}.json`);
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf-8"));
  return Array.isArray(data) ? data : [];
}

/**
 * 获取单课最终词汇（与页面 mergeLessonVocabulary 一致）
 * @param {number} lessonNo
 * @param {string} levelKey - "hsk1"
 * @param {Object} vocabMap - vocab-map
 * @param {Array} vocabList - 总词库
 * @returns {string[]} 汉字数组
 */
export function getFinalLessonWords(lessonNo, levelKey, vocabMap, vocabList) {
  if (!vocabMap || !vocabList?.length) return [];

  const key = String(lessonNo);
  const mapItem = vocabMap[key];
  if (!mapItem || Array.isArray(mapItem?.reviewOf)) return [];

  const core = Array.isArray(mapItem?.core) ? mapItem.core : [];
  const extra = Array.isArray(mapItem?.extra) ? mapItem.extra : [];

  const result = [];
  const seen = new Set();

  for (const term of [...core, ...extra]) {
    const t = String(term ?? "").trim();
    if (!t || seen.has(t)) continue;
    const w = findWordInVocabList(t, vocabList);
    const k = w ? wordKey(w) : t;
    if (k && !seen.has(k)) {
      seen.add(k);
      result.push(k);
    }
  }

  return result;
}

/**
 * 批量获取所有课的最终词汇
 */
export function getAllFinalLessonWords(levelKey, vocabMap, vocabList) {
  const keys = Object.keys(vocabMap || {})
    .filter((k) => /^\d+$/.test(k) && !Array.isArray(vocabMap[k]?.reviewOf))
    .sort((a, b) => Number(a) - Number(b));

  const out = {};
  for (const k of keys) {
    out[k] = getFinalLessonWords(Number(k), levelKey, vocabMap, vocabList);
  }
  return out;
}

/**
 * 为 buildGeneratorInput 构建 opts（currentWords / previousWords / forbiddenWords）
 * 与页面单词 tab 完全一致
 */
export function buildVocabMapOpts(lessonNo, levelKey, vocabMap, vocabList) {
  const all = getAllFinalLessonWords(levelKey, vocabMap, vocabList);
  const keys = Object.keys(all).map(Number).sort((a, b) => a - b);

  const currentWords = all[String(lessonNo)] || [];
  const previousWords = [];
  for (const k of keys) {
    if (k < lessonNo) previousWords.push(...(all[String(k)] || []));
  }
  const forbiddenWords = [];
  for (const k of keys) {
    if (k > lessonNo) forbiddenWords.push(...(all[String(k)] || []));
  }

  return {
    currentWords,
    previousWords: [...new Set(previousWords)],
    forbiddenWords: [...new Set(forbiddenWords)],
  };
}
