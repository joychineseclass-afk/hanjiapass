/**
 * Practice Generator v2 - 题目标准化
 * 严格遵循题型蓝图表：options 使用 key A/B/C/D，answer 为字母
 */

import { pickLang, shuffle } from "./generatorUtils.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const LETTERS = ["A", "B", "C", "D"];

/**
 * 标准化选项为 { key: A|B|C|D, zh, pinyin, kr, en }
 * 并确定 answer 为正确选项的字母
 */
function normalizeOptions(rawOptions, rawAnswer) {
  const opts = Array.isArray(rawOptions) ? rawOptions : [];
  const answerRef = rawAnswer;

  const contents = opts.map((o) => {
    if (o && typeof o === "object") {
      return {
        zh: str(o.zh ?? o.cn ?? ""),
        pinyin: str(o.pinyin ?? o.py ?? ""),
        kr: str(o.kr ?? o.ko ?? ""),
        en: str(o.en ?? ""),
      };
    }
    const t = str(o);
    return { zh: t, pinyin: "", kr: "", en: "" };
  }).filter((c) => c.zh || c.kr || c.en);

  const shuffled = shuffle(contents).slice(0, 4);
  const options = shuffled.map((c, i) => ({
    key: LETTERS[i] ?? String(i + 1),
    zh: c.zh,
    pinyin: c.pinyin,
    kr: c.kr,
    en: c.en,
  }));

  const answerStr = typeof answerRef === "object" ? str(answerRef?.key ?? answerRef?.zh) : str(answerRef);
  const found = options.find((o) => o.key === answerStr || o.zh === answerStr || o.kr === answerStr || o.en === answerStr);
  const answer = found ? found.key : (options[0]?.key ?? "A");

  return { options, answer };
}

/**
 * 标准化题目为 Practice Engine 兼容格式
 * 输出符合蓝图表：type, subtype, source, question, prompt, options, answer, explanation, meta
 */
export function normalizeQuestion(raw, lessonId = "", index = 0) {
  if (!raw || !raw.question) return null;

  const question = typeof raw.question === "object"
    ? raw.question
    : { zh: str(raw.question), kr: str(raw.question), en: str(raw.question) };

  const { options, answer } = normalizeOptions(raw.options ?? [], raw.answer);

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
    answer,
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
