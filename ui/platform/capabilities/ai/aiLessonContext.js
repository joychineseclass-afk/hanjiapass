/**
 * 从 lesson 自动生成 AI 对话训练上下文
 * 平台级可复用，不写死 HSK
 * 若 lesson 有 scene，注入 scene 信息供 AI roleplay
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "ko").toLowerCase();
  const key = l === "zh" || l === "cn" ? "zh" : l === "ko" || l === "kr" ? "kr" : l === "jp" || l === "ja" ? "jp" : "en";
  const v = obj[key] != null ? obj[key] : obj[key === "kr" ? "ko" : key === "zh" ? "cn" : key === "jp" ? "ja" : key];
  return str(v != null ? v : "") || "";
}

/**
 * 从 lesson 提取 AI 上下文
 * @param {object} lesson - 归一化后的 lesson
 * @param {object} opts - { lang, wordsWithMeaning }
 * @returns {object}
 */
export function buildLessonContext(lesson, opts = {}) {
  const lang = opts.lang || "ko";
  const words = Array.isArray(lesson?.vocab) ? lesson.vocab : (Array.isArray(lesson?.words) ? lesson.words : []);
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  const flatLines = cards.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  const dialogue = flatLines.length ? flatLines : (Array.isArray(lesson?.dialogue) ? lesson.dialogue : []);
  const grammar = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  const getMeaning = opts.wordsWithMeaning || ((w) => pickLang(w && w.meaning, lang) || str((w && (w.hanzi != null ? w.hanzi : w.word)) || ""));

  const vocabList = words.slice(0, 20).map((w) => {
    const han = str((w.hanzi != null ? w.hanzi : w.word) || "");
    const py = str((w.pinyin != null ? w.pinyin : w.py) || "");
    const mean = getMeaning(w);
    return { hanzi: han, pinyin: py, meaning: mean };
  });

  const dialogueLines = dialogue.map((line) => {
    const zh = str((line.zh != null ? line.zh : line.cn != null ? line.cn : line.text != null ? line.text : line.line) || "");
    const trans = (line.translation && typeof line.translation === "object")
      ? ((line.translation[lang] != null ? line.translation[lang] : line.translation[lang === "kr" ? "ko" : lang === "cn" ? "zh" : lang === "jp" ? "ja" : lang]) || "")
      : pickLang({ zh: line.zh, kr: line.kr, en: line.en, jp: line.jp }, lang);
    return {
      speaker: str(line.speaker),
      zh,
      pinyin: str((line.pinyin != null ? line.pinyin : line.py) || ""),
      trans: str(trans),
    };
  });

  const grammarPoints = grammar.slice(0, 5).map((g) => ({
    title: pickLang(g && g.title, lang) || str((g && (g.pattern != null ? g.pattern : g.title)) || ""),
    explanation: pickLang((g && (g.explain != null ? g.explain : g.explanation)) || g, lang),
    example: typeof g?.example === "object" ? pickLang(g.example, lang) : str(g?.example),
  }));

  const base = {
    lessonId: (lesson && lesson.id != null ? lesson.id : "") || "",
    lessonNo: (lesson && lesson.lessonNo != null ? lesson.lessonNo : 0) || 0,
    lessonTitle: pickLang(lesson?.title, lang) || "",
    vocab: vocabList,
    dialogue: dialogueLines,
    grammar: grammarPoints,
    lang,
    level: (lesson && lesson.level != null ? lesson.level : "") || "",
    version: (lesson && lesson.courseType != null ? lesson.courseType : "") || "",
    aiPractice: (lesson && lesson.aiPractice != null ? lesson.aiPractice : {}) || {},
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
