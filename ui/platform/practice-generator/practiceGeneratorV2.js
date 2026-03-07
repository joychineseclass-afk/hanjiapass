/**
 * Practice Generator v2 - 主入口
 * 严格遵循题型蓝图表：优先手写题，不足按等级组合自动补齐
 */

import { getTargetPracticeCount, getQuotaByLevelNum } from "./generatorConfig.js";
import { parseLevelNum, shuffle } from "./generatorUtils.js";
import { normalizeQuestion } from "./questionNormalizer.js";
import { generateVocabQuestions } from "./vocabQuestionGenerator.js";
import {
  generateDialogueResponseChoice,
  generateDialogueDetailChoice,
  generateDialogueMeaningChoice,
} from "./dialogueQuestionGenerator.js";
import {
  generateGrammarFillChoice,
  generateGrammarPatternChoice,
  generateGrammarExampleMeaning,
} from "./grammarQuestionGenerator.js";
import {
  generateExtensionMeaningChoice,
  generateSentenceOrderChoice,
  generateSentenceCompletionChoice,
} from "./extensionQuestionGenerator.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const LETTERS = ["A", "B", "C", "D"];

/** 标准化手写题为 v2 格式，options 使用 key A/B/C/D */
function normalizeHandwrittenQuestion(q, index) {
  if (!q || !q.question) return null;
  const question = typeof q.question === "object" ? q.question : { zh: str(q.question), kr: str(q.question), en: str(q.question) };
  const options = Array.isArray(q.options) ? q.options : [];
  const rawAnswer = q.answer ?? q.correct ?? (options[0] && typeof options[0] === "object" ? options[0].key : options[0]);

  const contents = options.map((o) => {
    if (o && typeof o === "object") return { zh: str(o.zh ?? o.cn ?? ""), pinyin: str(o.pinyin ?? o.py ?? ""), kr: str(o.kr ?? o.ko ?? ""), en: str(o.en ?? "") };
    const t = str(o);
    return { zh: t, pinyin: "", kr: "", en: "" };
  });
  const shuffled = shuffle(contents).slice(0, 4);
  const optObjects = shuffled.map((c, i) => ({
    key: LETTERS[i] ?? String(i + 1),
    zh: c.zh,
    pinyin: c.pinyin,
    kr: c.kr,
    en: c.en,
  }));
  const answerStr = typeof rawAnswer === "object" ? str(rawAnswer?.key ?? rawAnswer?.zh) : str(rawAnswer);
  const found = optObjects.find((o) => o.key === answerStr || o.zh === answerStr);
  const answer = found ? found.key : (optObjects[0]?.key ?? "A");

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
    options: optObjects,
    answer,
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
 */
export function generate(opts = {}) {
  const { lesson, lang = "ko", level, course, existing = [] } = opts;
  if (!lesson) return [];

  const levelNum = parseLevelNum(level ?? lesson?.level ?? lesson?.courseId ?? 1);
  const targetCount = getTargetPracticeCount({ course, level: level ?? lesson?.level });
  const quota = getQuotaByLevelNum(levelNum);
  const lessonId = str(lesson?.id ?? lesson?.courseId ?? "");
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "en" ? "en" : "ko";

  let result = (Array.isArray(existing) ? existing : [])
    .map((q, i) => normalizeHandwrittenQuestion(q, i))
    .filter(Boolean);

  if (result.length < targetCount) {
    const generated = [];

    generated.push(...generateVocabQuestions(lesson, quota, langKey));
    generated.push(...generateDialogueResponseChoice(lesson, quota.dialogue ?? 1, langKey));
    generated.push(...generateDialogueDetailChoice(lesson, Math.min(1, quota.dialogue ?? 1), langKey));
    generated.push(...generateGrammarFillChoice(lesson, quota.grammar ?? 1, langKey));
    generated.push(...generateGrammarPatternChoice(lesson, Math.min(1, quota.grammar ?? 1), langKey));
    generated.push(...generateExtensionMeaningChoice(lesson, quota.extension ?? 1, langKey, levelNum));
    generated.push(...generateSentenceOrderChoice(lesson, quota.sentenceOrder ?? 2, langKey));
    if (levelNum >= 3) generated.push(...generateSentenceCompletionChoice(lesson, 1, langKey));
    if (levelNum >= 3) generated.push(...generateGrammarExampleMeaning(lesson, 1, langKey));
    if (levelNum >= 3) generated.push(...generateDialogueMeaningChoice(lesson, 1, langKey));

    const usedIds = new Set(result.map((r) => r.id));
    for (const q of shuffle(generated)) {
      if (result.length >= targetCount) break;
      const normalized = normalizeQuestion(q, lessonId, result.length);
      if (!normalized || usedIds.has(normalized.id)) continue;
      usedIds.add(normalized.id);
      result.push(normalized);
    }
  }

  if (result.length > targetCount) result = result.slice(0, targetCount);
  return result.map((q, i) => ({ ...q, id: q.id || `q_v2_${i + 1}` }));
}
