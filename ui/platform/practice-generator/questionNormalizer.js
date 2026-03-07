/**
 * Practice Generator v2 - 题目标准化
 * 所有生成题目转换为统一结构，兼容 Practice Engine v1
 */

import { pickLang } from "./generatorUtils.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const LETTERS = ["A", "B", "C", "D"];

/**
 * 标准化选项格式
 * 支持：字符串数组、对象数组 { key, zh, kr, en }
 * 输出：{ key, zh, pinyin, kr, en }，answer 为 key
 */
function normalizeOptions(rawOptions, answer) {
  const opts = Array.isArray(rawOptions) ? rawOptions : [];
  const result = [];
  const answerStr = typeof answer === "object" ? str(answer?.key ?? answer?.zh) : str(answer);

  for (let i = 0; i < Math.min(opts.length, 6); i++) {
    const o = opts[i];
    const letter = LETTERS[i] ?? String(i + 1);
    let obj;
    if (o && typeof o === "object") {
      obj = {
        key: str(o.key) || str(o.zh ?? o.cn ?? o.kr ?? o.en) || letter,
        zh: str(o.zh ?? o.cn ?? ""),
        pinyin: str(o.pinyin ?? o.py ?? ""),
        kr: str(o.kr ?? o.ko ?? ""),
        en: str(o.en ?? ""),
      };
    } else {
      const text = str(o);
      obj = {
        key: text || letter,
        zh: text,
        pinyin: "",
        kr: "",
        en: "",
      };
    }
    if (!obj.key) obj.key = letter;
    result.push(obj);
  }

  // 确保正确答案在选项中
  const hasAnswer = result.some((r) => r.key === answerStr || r.zh === answerStr);
  if (!hasAnswer && answerStr && result.length < 6) {
    result.push({
      key: answerStr,
      zh: answerStr,
      pinyin: "",
      kr: "",
      en: "",
    });
  }

  return result;
}

/**
 * 标准化题目为 Practice Engine 兼容格式
 * @param {object} raw - 原始题目
 * @param {string} lessonId
 * @param {number} index
 * @returns {object|null}
 */
export function normalizeQuestion(raw, lessonId = "", index = 0) {
  if (!raw || !raw.question) return null;

  const question = typeof raw.question === "object"
    ? raw.question
    : { zh: str(raw.question), kr: str(raw.question), en: str(raw.question) };

  const options = normalizeOptions(raw.options ?? [], raw.answer);
  const answer = raw.answer ?? (options[0]?.key ?? "A");

  return {
    id: raw.id || `q_v2_${index + 1}`,
    type: "choice",
    subtype: raw.subtype ?? raw.subType ?? "",
    source: raw.source ?? "",
    question: {
      zh: str(question.zh ?? question.cn) || str(raw.question),
      kr: str(question.kr ?? question.ko) || str(question.zh),
      en: str(question.en) || str(question.zh),
    },
    prompt: raw.prompt
      ? {
          zh: str(raw.prompt.zh ?? raw.prompt.cn ?? ""),
          pinyin: str(raw.prompt.pinyin ?? raw.prompt.py ?? ""),
          kr: str(raw.prompt.kr ?? raw.prompt.ko ?? ""),
          en: str(raw.prompt.en ?? ""),
        }
      : undefined,
    options,
    answer: typeof answer === "object" ? str(answer?.key ?? answer?.zh) : str(answer),
    explanation: raw.explanation
      ? {
          zh: str(raw.explanation.zh ?? raw.explanation.cn ?? ""),
          kr: str(raw.explanation.kr ?? raw.explanation.ko ?? ""),
          en: str(raw.explanation.en ?? ""),
        }
      : undefined,
    score: Number(raw.score) || 1,
    meta: {
      lessonId: str(lessonId),
      generator: "practice-generator-v2",
      subtype: raw.subtype ?? raw.subType ?? "",
    },
  };
}

/**
 * 批量标准化
 */
export function normalizeQuestions(rawList, lessonId = "") {
  return rawList
    .map((q, i) => normalizeQuestion(q, lessonId, i))
    .filter(Boolean);
}
