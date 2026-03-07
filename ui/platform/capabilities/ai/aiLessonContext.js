/**
 * 从 lesson 自动生成 AI 对话训练上下文
 * 平台级可复用，不写死 HSK
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.en);
  if (l === "ko" || l === "kr") return str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.zh ?? obj.cn);
  return str(obj.en) || str(obj.kr ?? obj.ko) || str(obj.zh ?? obj.cn);
}

/**
 * 从 lesson 提取 AI 上下文
 * @param {object} lesson - 归一化后的 lesson
 * @param {object} opts - { lang, wordsWithMeaning }
 * @returns {object}
 */
export function buildLessonContext(lesson, opts = {}) {
  const lang = opts.lang || "ko";
  const words = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const dialogue = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const grammar = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  const getMeaning = opts.wordsWithMeaning || ((w) => pickLang(w?.meaning, lang) || str(w?.hanzi ?? w?.word ?? ""));

  const vocabList = words.slice(0, 20).map((w) => {
    const han = str(w.hanzi ?? w.word ?? "");
    const py = str(w.pinyin ?? w.py);
    const mean = getMeaning(w);
    return { hanzi: han, pinyin: py, meaning: mean };
  });

  const dialogueLines = dialogue.map((line) => ({
    speaker: str(line.speaker),
    zh: str(line.zh ?? line.cn ?? line.line ?? ""),
    pinyin: str(line.pinyin ?? line.py ?? ""),
    trans: pickLang({ zh: line.zh, kr: line.kr, en: line.en }, lang),
  }));

  const grammarPoints = grammar.slice(0, 5).map((g) => ({
    title: pickLang(g?.title, lang) || str(g?.title),
    explanation: pickLang(g?.explanation ?? g, lang),
    example: typeof g?.example === "object" ? pickLang(g.example, lang) : str(g?.example),
  }));

  return {
    lessonId: lesson?.id ?? "",
    lessonNo: lesson?.lessonNo ?? 0,
    lessonTitle: pickLang(lesson?.title, lang) || "",
    vocab: vocabList,
    dialogue: dialogueLines,
    grammar: grammarPoints,
    lang,
    level: lesson?.level ?? "",
    version: lesson?.courseType ?? "",
    aiPractice: lesson?.aiPractice ?? {},
  };
}
