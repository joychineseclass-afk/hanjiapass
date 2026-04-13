/**
 * 자유 질문（lesson_qa）最终展示前清洗：去掉词条模板行、内部标签、意图枚举等。
 * 与 api/gemini 共用，保持前后端一致。
 */

import { extractLearnerQuestionFromTutorPrompt } from "./freeQuestionIntent.js";

/** 整行删除：以这些前缀开头（含全角冒号） */
const LINE_DROP_PREFIX_RES = [
  /^[\s\uFEFF]*中文[：:]/,
  /^[\s\uFEFF]*原文[：:]/,
  /^[\s\uFEFF]*拼音[：:]/i,
  /^[\s\uFEFF]*pinyin[：:]/i,
  /^[\s\uFEFF]*(韩语解释|韩文解释|韩文|韩国语解释|英语解释|日语解释|英文解释)[：:]/,
  /^[\s\uFEFF]*한국어\s*해석[：:]/,
  /^[\s\uFEFF]*例句\d*[：:]/,
  /^[\s\uFEFF]*例文\d*[：:]/,
  /^[\s\uFEFF]*Example\d*[：:]/i,
  /^[\s\uFEFF]*注[：:]/,
  /^[\s\uFEFF]*翻译[：:]/,
  /^[\s\uFEFF]*释义[：:]/,
  /^[\s\uFEFF]*任务类型[：:\s]/,
  /^[\s\uFEFF]*任务类型\s*$/,
  /^[\s\uFEFF]*问题类型[：:\s]/,
  /^[\s\uFEFF]*(difference|usage|sentence_explain|meaning)\s*[：:]/i,
];

/** 整行仅含这些词则删除 */
const LINE_ONLY_META = /^(difference|usage|sentence_explain|meaning|lesson_qa|任务类型|问题类型)\s*$/i;

/**
 * @param {string} text
 * @returns {string}
 */
export function sanitizeLessonQAOutput(text) {
  let s = String(text ?? "");
  s = s.replace(/\r\n/g, "\n");
  const lines = s.split("\n");
  const out = [];
  for (const line of lines) {
    const t = line.trimEnd();
    const trimmed = t.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (LINE_ONLY_META.test(trimmed)) continue;
    if (LINE_DROP_PREFIX_RES.some((re) => re.test(t))) continue;
    // 管道分列的词典行（整行含 | 且像 例句1：...|...|...）
    if (/例句\d*[：:]/.test(trimmed) && trimmed.includes("|")) continue;
    if (/^\s*[\|｜]\s*$/.test(trimmed)) continue;
    out.push(line);
  }
  let result = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  result = result.replace(/\blesson_qa\b/gi, "");
  result = result.replace(/[ \t]{2,}/g, " ");
  return result.trim();
}

/**
 * 供 /api/gemini 离线兜底：从 tutor 整段里只取「学习者提问」再取首段汉字，避免命中 prompt 里的「任务类型」等。
 * @param {string} fullPrompt
 * @returns {string}
 */
export function firstHanziFromLearnerQuestion(fullPrompt) {
  const q = extractLearnerQuestionFromTutorPrompt(fullPrompt);
  const m = q.match(/[\u4e00-\u9fff]{1,8}/);
  return m ? m[0] : "你好";
}
