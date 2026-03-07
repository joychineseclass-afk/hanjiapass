/**
 * 从 lesson 自动生成 AI 对话训练上下文
 * 平台级可复用，不写死 HSK
 * 若 lesson 有 scene，注入 scene 信息供 AI roleplay
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

  const base = {
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

  if (lesson?.scene && typeof lesson.scene === "object") {
    const s = lesson.scene;
    base.scene = {
      id: str(s.id),
      title: pickLang(s.title, lang),
      summary: pickLang(s.summary, lang),
      goal: Array.isArray(s.goal) ? s.goal.map((g) => pickLang(g, lang)).filter(Boolean) : [],
      characters: Array.isArray(s.characters)
        ? s.characters.map((c) => ({ id: str(c.id), name: pickLang(c.name, lang) }))
        : [],
    };
  }

  return base;
}
