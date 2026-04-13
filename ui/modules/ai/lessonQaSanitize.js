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
  /^[\s\uFEFF]*词典[：:]/,
  /^[\s\uFEFF]*教学点[：:]/,
  /^[\s\uFEFF]*知识点[：:]/,
];

/** 整行仅含这些词则删除 */
const LINE_ONLY_META = /^(difference|usage|sentence_explain|meaning|lesson_qa|任务类型|问题类型)\s*$/i;

/** 自由提问最终展示：过长时截断，避免一整坨 */
const LESSON_QA_MAX_CHARS = 2400;

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
 * 清洗后再收口：段落留白、长度上限（与 api 共用）
 * @param {string} raw
 * @returns {string}
 */
export function postProcessLessonQAOutput(raw) {
  let s = sanitizeLessonQAOutput(raw);
  if (!s.trim()) return "";
  s = s.replace(/\*\*/g, "");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  if (s.length > LESSON_QA_MAX_CHARS) {
    s = `${s.slice(0, LESSON_QA_MAX_CHARS).trim()}…`;
  }
  return s;
}

/**
 * 清洗后若全无可用正文，给学生的自然老师口吻短话（非技术词）
 * @param {string} explainLang - ko | en | ja | zh
 */
export function lessonQaEmptyFriendlyMessage(explainLang) {
  const l = String(explainLang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") {
    return "现在暂时不能详细回答这个问题。你可以先回到本课对话和重点表达读一遍，过一会儿再在这里问一次，会更容易理解。";
  }
  if (l === "en") {
    return "I can’t go into detail just now. Reread this lesson’s dialogue and key phrases, then try asking again in a moment—that usually makes it click.";
  }
  if (l === "ja" || l === "jp") {
    return "いまは詳しくお答えしづらいです。まず本課の会話と重要表現を読み直してから、しばらくして同じところでもう一度質問してみてください。";
  }
  return "지금은 자세한 답변을 바로 드리기 어려워요. 잠시 후 같은 질문을 다시 해 보세요.\n먼저 이 과에서 나온 표현과 대화를 다시 한번 읽어 보면 답을 더 쉽게 이해할 수 있어요.";
}

/**
 * 服务端 lesson_qa 专用兜底：老师口吻、短、无字段标签（与 empty 友好文案同系列）
 * @param {string} explainLang
 * @param {string} hintHanzi
 */
export function lessonQaServerOfflineMessage(explainLang, hintHanzi) {
  const h = String(hintHanzi || "你好").slice(0, 12);
  const map = {
    ko: `지금은 자세한 답변을 바로 드리기 어려워요. 잠시 후 같은 질문을 다시 해 보세요.\n먼저 이 과에서 나온 표현과 대화를 다시 한번 읽어 보면, 질문에 나온「${h}」를 중심으로 답을 더 쉽게 이해할 수 있어요.`,
    en: `I can’t give a full answer just now—please try the same question again in a moment.\nReread this lesson’s key expressions and dialogue first; that usually makes「${h}」much easier to follow.`,
    ja: `いまは詳しくお答えしづらいので、しばらくして同じ質問をもう一度試してください。\nまず本課の表現と会話を読み直すと、「${h}」の理解がとても楽になります。`,
    zh: `现在暂时不能详细回答这个问题。请稍后在同一栏里再问一次。\n先回到本课的重点表达和对话读一遍，带着「${h}」慢慢看，会更容易明白。`,
  };
  const l = String(explainLang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return map.zh;
  if (l === "en") return map.en;
  if (l === "ja") return map.ja;
  return map.ko;
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
