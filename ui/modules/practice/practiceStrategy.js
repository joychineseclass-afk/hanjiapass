/**
 * Lumina Practice Engine - 出题策略
 *
 * 学生端（HSK1~4 标准课后练习）：
 * - 以 choice 选择题为主
 * - fill / match / order 仅作少量补充
 * - 不使用自由问答题
 *
 * 老师端（预留）：
 * - 可选题量
 * - 可选题型（choice / fill / short answer）
 * - 可按词汇/语法/会话生成
 */

/** HSK1~4 标准题型比例（学生端） */
export const STUDENT_STRATEGY = {
  hsk1: { choice: 0.85, fill: 0.08, match: 0.05, order: 0.02 },
  hsk2: { choice: 0.85, fill: 0.08, match: 0.05, order: 0.02 },
  hsk3: { choice: 0.82, fill: 0.10, match: 0.05, order: 0.03 },
  hsk4: { choice: 0.82, fill: 0.10, match: 0.05, order: 0.03 },
};

/** 每课建议题量（学生端） */
export const TARGET_COUNT = {
  hsk1: 5,
  hsk2: 5,
  hsk3: 8,
  hsk4: 10,
};

/** 非 choice 题型每课上限 */
export const SUPPLEMENTARY_LIMIT = {
  fill: 1,
  match: 1,
  order: 1,
};

/** review lesson 题型上限（复习课需更完整检测，放宽 fill/order） */
export const REVIEW_SUPPLEMENTARY_LIMIT = {
  fill: 3,
  match: 1,
  order: 2,
};

/**
 * 按策略过滤/排序题目（学生端）
 * 确保 choice 为主，fill/match/order 不超过上限
 * @param {Array} items - 原始题目
 * @param {string} level - hsk1 | hsk2 | hsk3 | hsk4
 * @param {boolean} [isReview] - 是否为 review lesson，是则使用放宽的题型上限
 * @returns {Array}
 */
export function applyStudentStrategy(items, level = "hsk1", isReview = false) {
  if (!Array.isArray(items)) return [];
  const strategy = STUDENT_STRATEGY[level] ?? STUDENT_STRATEGY.hsk1;
  const limit = isReview ? REVIEW_SUPPLEMENTARY_LIMIT : SUPPLEMENTARY_LIMIT;

  const byType = { choice: [], fill: [], match: [], order: [] };
  items.forEach((q) => {
    const t = String(q.type ?? "choice").toLowerCase();
    if (byType[t]) byType[t].push(q);
    else byType.choice.push(q);
  });

  const out = [];
  out.push(...byType.choice);

  const fillTake = Math.min(byType.fill.length, limit.fill);
  out.push(...byType.fill.slice(0, fillTake));

  const matchTake = Math.min(byType.match.length, limit.match);
  out.push(...byType.match.slice(0, matchTake));

  const orderTake = Math.min(byType.order.length, limit.order);
  out.push(...byType.order.slice(0, orderTake));

  return out;
}

/**
 * 老师端策略（预留接口）
 * @param {object} opts - { questionCount, types: ['choice','fill','short_answer'], sources: ['vocab','grammar','dialogue'] }
 */
export function getTeacherStrategy(opts = {}) {
  return {
    questionCount: opts.questionCount ?? 10,
    types: opts.types ?? ["choice", "fill"],
    sources: opts.sources ?? ["vocab", "grammar", "dialogue"],
    allowShortAnswer: opts.allowShortAnswer ?? false,
  };
}
