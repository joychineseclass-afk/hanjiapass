/**
 * Image Engine v1 - AI 图片生成 Prompt 占位
 * 当前仅返回 prompt 字符串，不调用任何 API
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = String(lang || "en").toLowerCase();
  return str(obj[l] ?? obj.zh ?? obj.kr ?? obj.en ?? "");
}

/**
 * 词汇图 prompt
 */
export function buildWordImagePrompt(word, lang = "en") {
  const hanzi = str(word?.hanzi ?? word?.word ?? "");
  const meaning = pickLang(word?.meaning, lang) || str(word?.meaning);
  if (!hanzi) return "";
  return `Chinese vocabulary card image: "${hanzi}"${meaning ? `, meaning: ${meaning}` : ""}. Simple, clear, educational illustration.`;
}

/**
 * 课程图 prompt
 */
export function buildLessonImagePrompt(lesson, lang = "en") {
  const title = pickLang(lesson?.title, lang) || str(lesson?.title);
  const summary = pickLang(lesson?.summary, lang) || str(lesson?.summary);
  if (!title) return "";
  return `Chinese lesson cover image: "${title}"${summary ? `. Topic: ${summary}` : ""}. Welcoming, educational style.`;
}

/**
 * 对话图 prompt
 */
export function buildDialogueImagePrompt(lesson, scene, lang = "en") {
  const line = str(scene?.zh ?? scene?.line ?? scene?.cn ?? "");
  const context = pickLang(lesson?.title, lang) || str(lesson?.title);
  if (!line) return "";
  return `Dialogue scene illustration: "${line}"${context ? ` (from lesson: ${context})` : ""}. Conversational, friendly style.`;
}
