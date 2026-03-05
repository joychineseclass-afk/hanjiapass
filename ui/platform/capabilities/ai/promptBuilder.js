// ui/platform/capabilities/ai/promptBuilder.js
// 按课程类型/等级/主题生成稳定提示词模板

function jsonFence(schemaHint) {
  return [
    "你必须只输出 JSON（不要 markdown，不要解释）。",
    "JSON 必须符合以下结构提示：",
    schemaHint || "{}",
  ].join("\n");
}

export const PromptBuilder = {
  buildLessonPrompt({ courseType, track, level, topic, lang, schemaHint }) {
    return [
      "你是 Joy Chinese 的课程设计师。",
      `课程域=${courseType} track=${track} level=${level} 语言=${lang || "zh"}`,
      `主题/目标：${topic || "通用"}`,
      "要求：难度不要越级；词汇尽量来自对应等级；提供词汇、会话、语法点、练习。",
      jsonFence(schemaHint),
    ].join("\n");
  },

  buildPracticePrompt({ lessonDoc, focus, count, lang, schemaHint }) {
    return [
      "你是练习题生成器。",
      `focus=${focus || "mixed"} count=${count || 8} lang=${lang || "zh"}`,
      `Lesson 摘要：${JSON.stringify({
        id: lessonDoc?.id,
        words: lessonDoc?.content?.words?.slice?.(0, 12) || [],
      })}`,
      jsonFence(schemaHint),
    ].join("\n");
  },

  buildSpeakingCoachPrompt({ lessonDoc, lang }) {
    return [
      `你是口语陪练教练。lang=${lang || "zh"}`,
      "基于本课短语进行 5-8 轮对话，逐步引导学生开口。",
      `本课短语：${JSON.stringify(lessonDoc?.ai?.speakingPhrases || [])}`,
      '输出 JSON: {"assistant":"...","expected":"...","tips":[...]}',
    ].join("\n");
  },
};
