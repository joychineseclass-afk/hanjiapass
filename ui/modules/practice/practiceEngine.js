/**
 * Practice Engine v1 - 核心逻辑
 * 读取 lesson.practice、判题、返回结果
 */

import { i18n } from "../../i18n.js";
import { filterSupportedQuestions } from "./practiceSchema.js";
import * as PracticeState from "./practiceState.js";

function getLang() {
  const l = String(i18n?.getLang?.() ?? "ko").toLowerCase();
  if (l === "zh" || l === "cn") return "cn";
  if (l === "en") return "en";
  if (l === "jp" || l === "ja") return "jp";
  return "kr";
}

/** 优先使用 lesson.practice 手写题，不自动生成 */
export function loadPractice(lesson) {
  PracticeState.resetPracticeState();
  const existing = Array.isArray(lesson?.practice) ? lesson.practice : [];
  const questions = filterSupportedQuestions(existing);
  const totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 1), 0);

  PracticeState.setPracticeState({ questions, totalScore });
  return { questions, totalScore };
}

function pickPrompt(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const key = lang === "cn" || lang === "zh" ? "cn" : lang === "kr" || lang === "ko" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";
  const v = obj[key] ?? obj[key === "kr" ? "ko" : key === "cn" ? "zh" : key === "jp" ? "ja" : key];
  return String(v ?? "").trim() || String(obj.cn ?? obj.zh ?? "").trim();
}

function normalizeAnswer(expected, selected, lang) {
  const sel = String(selected ?? "").trim();
  if (expected == null) return { exp: "", sel };
  if (typeof expected === "object" && expected !== null) {
    const exp = pickPrompt(expected, lang) || String(expected.zh ?? expected.cn ?? expected.kr ?? expected.en ?? "").trim();
    return { exp, sel };
  }
  return { exp: String(expected).trim(), sel };
}

function judgeChoice(q, answer, lang) {
  const expected = q.answer;
  const { exp, sel } = normalizeAnswer(expected, answer, lang);
  const score = Number(q.score) || 1;
  return { correct: sel === exp, score: sel === exp ? score : 0 };
}

function judgeFill(q, answer, lang) {
  const expected = q.answer;
  const exp = typeof expected === "object" ? pickPrompt(expected, lang) || String(expected.cn ?? expected.zh ?? "").trim() : String(expected ?? "").trim();
  const sel = String(answer ?? "").trim();
  const score = Number(q.score) || 1;
  const correct = sel === exp;
  return { correct, score: correct ? score : 0 };
}

function judgeMatch(q, answer) {
  if (!Array.isArray(answer)) return { correct: false, score: 0 };
  const pairs = q.pairs ?? [];
  const expMap = new Map(pairs.map((p) => [String(p.left ?? p[0] ?? "").trim(), String(p.right ?? p[1] ?? "").trim()]));
  if (expMap.size !== answer.length) return { correct: false, score: 0 };
  let correct = true;
  for (const [left, right] of answer) {
    const l = String(left ?? "").trim();
    const r = String(right ?? "").trim();
    if (expMap.get(l) !== r) {
      correct = false;
      break;
    }
  }
  const score = Number(q.score) || 1;
  return { correct, score: correct ? score : 0 };
}

function judgeOrder(q, answer) {
  const expArr = Array.isArray(q.answer) ? q.answer : (typeof q.answer === "string" ? q.answer.split(/[\s,，、]+/).filter(Boolean) : []);
  const ansArr = Array.isArray(answer) ? answer : (typeof answer === "string" ? answer.split(/[\s,，、]+/).filter(Boolean) : []);
  const correct = expArr.length === ansArr.length && expArr.every((e, i) => String(ansArr[i]).trim() === String(e).trim());
  const score = Number(q.score) || 1;
  return { correct, score: correct ? score : 0 };
}

function judgeOne(q, answer) {
  const type = String(q.type || "choice").toLowerCase();
  const lang = getLang();

  if (type === "choice") return judgeChoice(q, answer, lang);
  if (type === "fill") return judgeFill(q, answer, lang);
  if (type === "match") return judgeMatch(q, answer);
  if (type === "order") return judgeOrder(q, answer);

  return judgeChoice(q, answer, lang);
}

/**
 * 整页提交批改
 */
export function submitAll() {
  const questions = PracticeState.getQuestions();
  const answers = PracticeState.getAnswers();
  const resultMap = {};
  const wrongItems = [];
  let score = 0;
  const lang = getLang();

  questions.forEach((q) => {
    const selected = answers[q.id] ?? null;
    const { correct, score: s } = judgeOne(q, selected);
    resultMap[q.id] = { correct, selected, answer: q.answer, score: s };
    if (correct) score += s;
    else if (selected != null && (typeof selected !== "string" || selected !== "")) {
      const exp = typeof q.answer === "object" ? pickPrompt(q.answer, lang) : String(q.answer ?? "");
      wrongItems.push({
        questionId: q.id,
        subtype: q.type ?? "choice",
        selected: typeof selected === "object" ? JSON.stringify(selected) : String(selected),
        correct: typeof q.answer === "object" ? JSON.stringify(q.answer) : String(exp),
        questionSnapshot: {
          prompt: q.prompt,
          question: q.prompt,
          options: q.options,
          pairs: q.pairs,
          items: q.items,
          answer: q.answer,
          explanation: q.explanation,
        },
      });
    }
  });

  PracticeState.setResultMap(resultMap);
  PracticeState.setSubmitted(true);

  return {
    resultMap,
    score,
    correctCount: Object.values(resultMap).filter((r) => r?.correct).length,
    wrongItems,
  };
}

export { PracticeState };
