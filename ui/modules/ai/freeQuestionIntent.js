/**
 * 本课「자유 질문」轻量意图分类（关键词/正则，无 NLP 依赖）。
 * 供 buildTutorApiContext 与 /api/gemini 共用，保持行为一致。
 */

/** 与 lesson_qa prompt 改版同步；部署验证时可在控制台 / Network / GET /api/gemini 对照 */
export const LUMINA_LESSON_QA_PROMPT_REV = "lesson_qa_v3_style";

/**
 * 从完整 tutor prompt 中取出「学习者提问」段落；若无标记则全文用于分类。
 * @param {string} fullPrompt
 * @returns {string}
 */
export function extractLearnerQuestionFromTutorPrompt(fullPrompt) {
  const s = String(fullPrompt || "");
  const m = s.match(/【学习者提问】\s*([\s\S]*)$/);
  return (m ? m[1] : s).trim();
}

/**
 * @param {string} userText — 用户原话，或完整 tutor prompt（内部会尝试截取提问段）
 * @returns {"difference"|"usage"|"sentence_explain"|"meaning"}
 */
export function classifyFreeQuestionIntent(userText) {
  const full = extractLearnerQuestionFromTutorPrompt(userText) || String(userText || "").trim();
  if (!full) return "meaning";

  // 1) 表达对比 / 区别题（优先）
  if (
    /(차이|다르|区别|有什么不同|有何不同|difference|different|무슨\s*차이|和.*(区别|不同)|比.*(区别|不同)|versus|\bvs\.?\b|對比|对比)/i.test(
      full,
    ) ||
    /어떻게\s*달라/i.test(full)
  ) {
    return "difference";
  }

  // 2) 句子讲解 / 换种说法说
  if (
    /(문장|이\s*문장|这句|这句话|这句話|쉽게\s*설명|더\s*쉽게|更簡單|更简单|explain.*sentence|what\s+does\s+this\s+sentence)/i.test(
      full,
    )
  ) {
    return "sentence_explain";
  }

  // 3) 使用对象 / 场景 / 何时用
  if (
    /(누구|언제|어떤\s*상황|상황에서|써요|사용|때\s*써|什么时候|何时|对谁说|对谁|场合|场景|when\s+to|who\s+.*(for|use)|어디서)/i.test(
      full,
    )
  ) {
    return "usage";
  }

  return "meaning";
}
