/**
 * Practice Generator v2 - 语法填空题
 * 来源：grammar + vocab
 * 题型：grammar_fill_choice
 * 注意：v2 统一渲染为 choice，填空逻辑但展示用选项卡
 */

import { getGrammarExampleZh, getGrammarExplanation, getVocabZh, shuffle, nextId, parseLevelNum } from "./generatorUtils.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const GRAMMAR_PATTERNS = ["吗", "很", "叫", "什么", "是", "不", "也", "的", "了", "在", "呢", "都", "有", "没"];

function extractBlankFromExample(exampleZh, grammarTitle) {
  if (!exampleZh || exampleZh.length < 2) return null;
  const title = str(grammarTitle);

  for (const keyword of GRAMMAR_PATTERNS) {
    if (title.includes(keyword) && exampleZh.includes(keyword)) {
      return { sentence: exampleZh.replace(keyword, "___"), answer: keyword };
    }
  }

  if (exampleZh.length >= 2) {
    const punct = /[。？！，、；：""''（）\s]/;
    const mid = Math.floor(exampleZh.length / 2);
    let char = exampleZh[mid];
    if (punct.test(char)) {
      for (let k = 0; k < exampleZh.length; k++) {
        const c = exampleZh[k];
        if (!punct.test(c) && /[\u4e00-\u9fff]/.test(c)) {
          char = c;
          const before = exampleZh.slice(0, k);
          const after = exampleZh.slice(k + 1);
          return { sentence: before + "___" + after, answer: char };
        }
      }
      return null;
    }
    const before = exampleZh.slice(0, mid);
    const after = exampleZh.slice(mid + 1);
    return { sentence: before + "___" + after, answer: char };
  }
  return null;
}

/**
 * 生成语法填空题（choice 形式）
 */
export function generateGrammarFillChoice(lesson, count, lang) {
  const grammar = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const vocabHanzi = vocab.map((w) => getVocabZh(w)).filter((h) => h && h.length <= 2);
  const out = [];

  for (let i = 0; i < Math.min(count, grammar.length); i++) {
    const g = grammar[i];
    const exampleZh = getGrammarExampleZh(g);
    const title = str(g?.title ?? g?.name ?? "");
    const expl = getGrammarExplanation(g, lang);

    const blank = extractBlankFromExample(exampleZh, title);
    if (!blank) continue;

    const punct = /[。？！，、；：""''（）\s]/;
    const chars = exampleZh.split("").filter((c) => c.trim() && c !== blank.answer && !punct.test(c));
    const wrongFromExample = [...new Set(chars)].slice(0, 2);
    const wrongFromVocab = vocabHanzi.filter((h) => h !== blank.answer && h.length <= 2).slice(0, 2);
    const wrongPool = shuffle([...wrongFromExample, ...wrongFromVocab]);
    const options = [blank.answer, ...wrongPool];
    const uniqueOpts = shuffle([...new Set(options)]).slice(0, 4);

    const optObjects = uniqueOpts.map((o) => ({
      key: o,
      zh: o,
      pinyin: "",
      kr: "",
      en: "",
    }));

    out.push({
      id: nextId("grammar"),
      type: "choice",
      subtype: "grammar_fill_choice",
      source: "grammar",
      question: {
        zh: `请选择正确的词填空：${blank.sentence}`,
        kr: `빈칸에 맞는 말을 고르세요: ${blank.sentence}`,
        en: `Choose the correct word: ${blank.sentence}`,
      },
      prompt: { zh: blank.sentence, pinyin: "" },
      options: optObjects,
      answer: blank.answer,
      explanation: {
        zh: expl || `答案：${blank.answer}`,
        kr: expl || `답: ${blank.answer}`,
        en: expl || `Answer: ${blank.answer}`,
      },
      score: 1,
    });
  }
  return out;
}
