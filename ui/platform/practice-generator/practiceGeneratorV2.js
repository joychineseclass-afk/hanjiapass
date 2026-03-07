/**
 * Practice Generator v2 - 主入口
 * 读取 lesson 数据，自动生成题目，输出标准化 practice 列表
 * 优先保留手写题，不足则自动补齐
 */

import { getTargetPracticeCount, getQuotaByLevelNum } from "./generatorConfig.js";
import { parseLevelNum, shuffle } from "./generatorUtils.js";
import { normalizeQuestion, normalizeQuestions } from "./questionNormalizer.js";
import { generateVocabQuestions } from "./vocabQuestionGenerator.js";
import { generateDialogueResponseChoice } from "./dialogueQuestionGenerator.js";
import { generateGrammarFillChoice } from "./grammarQuestionGenerator.js";
import {
  generateExtensionMeaningChoice,
  generateSentenceOrderChoice,
} from "./extensionQuestionGenerator.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** 标准化手写题为 v2 格式（兼容旧格式） */
function normalizeHandwrittenQuestion(q, index) {
  if (!q || !q.question) return null;
  const question = typeof q.question === "object" ? q.question : { zh: str(q.question), kr: str(q.question), en: str(q.question) };
  const options = Array.isArray(q.options) ? q.options : [];
  const answer = q.answer ?? q.correct ?? (options[0] && typeof options[0] === "object" ? options[0].key : options[0]);

  const optObjects = options.map((o, i) => {
    if (o && typeof o === "object") {
      return {
        key: str(o.key) || str(o.zh ?? o.cn ?? o.kr ?? o.en) || String(i + 1),
        zh: str(o.zh ?? o.cn ?? ""),
        pinyin: str(o.pinyin ?? o.py ?? ""),
        kr: str(o.kr ?? o.ko ?? ""),
        en: str(o.en ?? ""),
      };
    }
    const t = str(o);
    return { key: t || String(i + 1), zh: t, pinyin: "", kr: "", en: "" };
  });

  return {
    id: q.id || `q_hand_${index + 1}`,
    type: "choice",
    subtype: q.subtype ?? q.subType ?? "handwritten",
    source: "lesson.practice",
    question: {
      zh: str(question.zh ?? question.cn) || str(q.question),
      kr: str(question.kr ?? question.ko) || str(question.zh),
      en: str(question.en) || str(question.zh),
    },
    options: optObjects.length >= 2 ? optObjects : optObjects,
    answer: typeof answer === "object" ? str(answer?.key ?? answer?.zh) : str(answer),
    explanation: q.explanation
      ? typeof q.explanation === "object"
        ? { zh: str(q.explanation.zh), kr: str(q.explanation.kr), en: str(q.explanation.en) }
        : { zh: str(q.explanation), kr: str(q.explanation), en: str(q.explanation) }
      : undefined,
    score: Number(q.score) || 1,
    meta: { lessonId: "", generator: "handwritten", subtype: "handwritten" },
  };
}

/**
 * 生成练习题
 * @param {object} opts
 * @param {object} opts.lesson - 归一化后的 lesson
 * @param {string} opts.lang - ko | zh | en
 * @param {string} [opts.level] - hsk1, hsk2, ...
 * @param {string} [opts.course] - hsk2.0, hsk3.0, ...
 * @param {Array} [opts.existing] - lesson.practice 手写题
 * @returns {Array<object>} 标准化题目列表
 */
export function generate(opts = {}) {
  const { lesson, lang = "ko", level, course, existing = [] } = opts;
  if (!lesson) return [];

  const levelNum = parseLevelNum(level ?? lesson?.level ?? lesson?.courseId ?? 1);
  const targetCount = getTargetPracticeCount({ course, level: level ?? lesson?.level });
  const quota = getQuotaByLevelNum(levelNum);
  const lessonId = str(lesson?.id ?? lesson?.courseId ?? "");

  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "en" ? "en" : "ko";

  // 1. 保留手写题
  const handwritten = Array.isArray(existing) ? existing : [];
  let result = handwritten.map((q, i) => normalizeHandwrittenQuestion(q, i)).filter(Boolean);

  // 2. 不足则自动生成
  if (result.length < targetCount) {
    const generated = [];

    // vocab
    const vocabQ = generateVocabQuestions(lesson, quota, langKey);
    generated.push(...vocabQ);

    // dialogue
    const dialogueQ = generateDialogueResponseChoice(lesson, quota.dialogue ?? 1, langKey);
    generated.push(...dialogueQ);

    // grammar
    const grammarQ = generateGrammarFillChoice(lesson, quota.grammar ?? 1, langKey);
    generated.push(...grammarQ);

    // extension + sentence_order
    const extQuota = quota.extension ?? 1;
    const extQ = generateExtensionMeaningChoice(lesson, Math.min(extQuota, 2), langKey, levelNum);
    const orderQ = generateSentenceOrderChoice(lesson, Math.max(0, extQuota - 2), langKey);
    generated.push(...extQ, ...orderQ);

    // 去重 id，补齐数量
    const usedIds = new Set(result.map((r) => r.id));
    const shuffled = shuffle(generated);
    for (const q of shuffled) {
      if (result.length >= targetCount) break;
      const normalized = normalizeQuestion(q, lessonId, result.length);
      if (!normalized || usedIds.has(normalized.id)) continue;
      usedIds.add(normalized.id);
      result.push(normalized);
    }
  }

  // 3. 超出则裁剪
  if (result.length > targetCount) {
    result = result.slice(0, targetCount);
  }

  // 4. 确保 id 唯一
  return result.map((q, i) => ({
    ...q,
    id: q.id || `q_v2_${i + 1}`,
  }));
}
