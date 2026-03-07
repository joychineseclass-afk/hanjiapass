/**
 * AI 对话训练 prompt 生成器
 * 4 种模式：跟读、替换练习、角色扮演、自由问答
 */

const MODES = {
  follow: { key: "follow", zh: "跟读模式", kr: "따라 읽기", en: "Follow-along", jp: "跟読" },
  replace: { key: "replace", zh: "替换练习", kr: "대체 연습", en: "Substitution", jp: "置換練習" },
  roleplay: { key: "roleplay", zh: "角色扮演", kr: "역할 놀이", en: "Role-play", jp: "ロールプレイ" },
  free: { key: "free", zh: "自由问答", kr: "자유 질문", en: "Free Q&A", jp: "自由質問" },
};

/** 获取模式描述 */
export function getModeLabel(mode, lang) {
  const m = MODES[mode] || MODES.follow;
  const key = lang === "zh" || lang === "cn" ? "zh" : lang === "ko" || lang === "kr" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";
  return m[key] || m.zh;
}

/**
 * 根据模式生成训练 prompt
 * @param {object} context - buildLessonContext 的输出
 * @param {string} mode - follow | replace | roleplay | free
 */
export function buildPrompt(context, mode = "follow") {
  const { lessonTitle, vocab, dialogue, grammar, scene, lang } = context || {};
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "ko" || lang === "kr" ? "kr" : "en";
  const vocabStr = vocab?.slice(0, 15).map((w) => `${w.hanzi}${w.pinyin ? `(${w.pinyin})` : ""}${w.meaning ? `: ${w.meaning}` : ""}`).join("\n") || "";
  const dialogueStr = dialogue?.map((d) => `[${d.speaker}] ${d.zh}${d.trans ? ` → ${d.trans}` : ""}`).join("\n") || "";
  const grammarStr = grammar?.map((g) => `- ${g.title}: ${g.explanation || ""}`).join("\n") || "";

  let sceneStr = "";
  if (scene?.id) {
    const parts = [
      scene.title ? `场景: ${scene.title}` : "",
      scene.summary ? `情境: ${scene.summary}` : "",
      scene.goal?.length ? `目标: ${scene.goal.join("; ")}` : "",
      scene.characters?.length ? `角色: ${scene.characters.map((c) => `${c.id}: ${c.name}`).join(", ")}` : "",
    ].filter(Boolean);
    sceneStr = parts.join("\n");
  }

  const base = [
    `课程: ${lessonTitle || "本课"}`,
    sceneStr ? `场景:\n${sceneStr}` : "",
    vocabStr ? `词汇:\n${vocabStr}` : "",
    dialogueStr ? `对话:\n${dialogueStr}` : "",
    grammarStr ? `语法:\n${grammarStr}` : "",
  ].filter(Boolean).join("\n\n");

  const prompts = {
    follow: `请根据当前课程对话逐句带学生练习。学生跟读，你纠正发音或语调。\n\n${base}`,
    replace: `请把对话中的词语进行替换练习。例如把"你好"替换成"老师好""大家好""同学们好"。\n\n${base}`,
    roleplay: `你当老师，学生当学生。用本课词汇和语法进行对话。老师先提问，学生回答。\n\n${base}`,
    free: `只使用本课词汇和语法向学生提问。学生用中文回答。问题难度适合本课水平。\n\n${base}`,
  };

  return prompts[mode] || prompts.follow;
}

/** 获取所有模式 */
export function getModes() {
  return Object.values(MODES);
}
