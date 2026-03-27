/**
 * Practice Engine v1 - 统一练习题数据结构
 * 支持 choice / fill / match / order 四种题型
 * 题干规范：听音题用 LISTENING，母语→中文用 NATIVE_TO_ZH，见 practiceTemplates.js
 */

import { PROMPT_TEMPLATES } from "./practiceTemplates.js";

export const PRACTICE_TYPES = ["choice", "fill", "match", "order"];

/** 兼容旧 key：question -> prompt, reorder -> order */
export function normalizePracticeType(type) {
  const t = String(type || "").toLowerCase().trim();
  if (t === "reorder") return "order";
  return PRACTICE_TYPES.includes(t) ? t : "";
}

/**
 * 校验题目结构
 */
export function validateQuestion(q) {
  if (!q || typeof q !== "object") return { valid: false };
  const type = normalizePracticeType(q.type);
  if (!type) return { valid: false };

  const promptOrQuestion = q.prompt ?? q.question;
  if (type === "choice" || type === "fill" || type === "order") {
    if (!promptOrQuestion) return { valid: false, type };
  }
  if (type === "match") {
    const pairs = q.pairs ?? q.items;
    if (!Array.isArray(pairs) || pairs.length < 2) return { valid: false, type };
  }
  if (type === "order") {
    const items = q.items ?? q.options ?? [];
    if (!Array.isArray(items) || items.length < 2) return { valid: false, type };
  }
  return { valid: true, type };
}

/** 与 validateQuestion 一致，供过滤阶段日志说明丢弃原因 */
export function getQuestionUnsupportedReason(q) {
  if (!q || typeof q !== "object") return "not an object";
  const type = normalizePracticeType(q.type);
  if (!type) return `unsupported or empty type: ${String(q.type)}`;
  const promptOrQuestion = q.prompt ?? q.question;
  if ((type === "choice" || type === "fill" || type === "order") && !promptOrQuestion) {
    return `missing prompt/question (required for ${type})`;
  }
  if (type === "match") {
    const pairs = q.pairs ?? q.items;
    if (!Array.isArray(pairs) || pairs.length < 2) {
      return "match: need pairs or items array with length >= 2";
    }
  }
  if (type === "order") {
    const items = q.items ?? q.options ?? [];
    if (!Array.isArray(items) || items.length < 2) {
      return "order: need items or options array with length >= 2";
    }
  }
  return null;
}

/**
 * 过滤并标准化题目
 */
export function filterSupportedQuestions(items) {
  if (!Array.isArray(items)) {
    console.log("[HSK-PRACTICE-FILTER]", {
      stage: "filterSupportedQuestions",
      inputCount: 0,
      outputCount: 0,
      dropped: [],
    });
    return [];
  }
  const dropped = [];
  const out = [];
  items.forEach((item, i) => {
    const reason = getQuestionUnsupportedReason(item);
    if (reason) {
      dropped.push({
        index: i,
        id: item?.id,
        type: item?.type,
        subtype: item?.subtype,
        reason,
      });
      return;
    }
    const { valid, type } = validateQuestion(item);
    if (!valid) {
      dropped.push({
        index: i,
        id: item?.id,
        type: item?.type,
        subtype: item?.subtype,
        reason: "validateQuestion failed (internal mismatch — check getQuestionUnsupportedReason)",
      });
      return;
    }
    const normalized = normalizeItem(item, type, i);
    const row = { ...normalized, type, id: item.id || `p${i + 1}` };
    if (item.section) row.section = item.section;
    out.push(row);
  });

  console.log("[HSK-PRACTICE-FILTER]", {
    stage: "filterSupportedQuestions",
    inputCount: items.length,
    outputCount: out.length,
    dropped,
  });

  return out;
}

function normalizeItem(item, type, index) {
  let promptOrQuestion = item.prompt ?? item.question;
  let prompt = typeof promptOrQuestion === "object" ? { ...promptOrQuestion } : { cn: String(promptOrQuestion || ""), kr: "", en: "", jp: "" };

  if (type === "choice" && (item.hasListen ?? item.listen ?? item.audioUrl)) {
    prompt = { ...PROMPT_TEMPLATES.LISTENING };
  }

  const answer = item.answer ?? item.correct ?? item.key;
  const explanation = item.explanation ?? item.explain ?? {};

  const base = { prompt, answer, explanation, score: Number(item.score) || 1 };

  if (type === "choice") {
    return { ...base, options: Array.isArray(item.options) ? item.options : [] };
  }
  if (type === "fill") {
    return base;
  }
  if (type === "match") {
    const pairs = item.pairs ?? item.items ?? [];
    return { ...base, pairs: pairs.map((p) => ({ left: p.left ?? p[0] ?? "", right: p.right ?? p[1] ?? "" })) };
  }
  if (type === "order") {
    const items = item.items ?? item.options ?? [];
    const ansArr = Array.isArray(answer) ? answer : (typeof answer === "string" ? [answer] : []);
    return { ...base, items, answer: ansArr.length ? ansArr : items };
  }
  return base;
}
