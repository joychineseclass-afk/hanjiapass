/**
 * Practice Generator v2 - C 类：语法应用类
 * C1 grammar_fill_choice：填空选词
 * C2 grammar_pattern_choice：根据语法点选正确句子
 * C3 grammar_example_meaning：给语法例句问意思
 */

import {
  getGrammarExampleZh,
  getGrammarExplanation,
  getVocabZh,
  getDialogueLineZh,
  shuffle,
  nextId,
  buildOptionsWithLetterKeys,
} from "./generatorUtils.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const GRAMMAR_PATTERNS = ["吗", "很", "叫", "什么", "是", "不", "也", "的", "了", "在", "呢", "都", "有", "没"];

function getDialogueLines(lesson) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  if (cards.length) return cards.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  return [];
}

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
 * C1. grammar_fill_choice
 * 请选择正确的词填空：你___吗？
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
    const optionTexts = [blank.answer, ...wrongPool];
    const uniqueOpts = shuffle([...new Set(optionTexts)]).slice(0, 4);
    const contents = uniqueOpts.map((o) => ({ zh: o, pinyin: "", kr: "", en: "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, blank.answer);

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
      options,
      answer,
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

/**
 * C2. grammar_pattern_choice
 * 下面哪一句用了「吗」疑问句？
 */
export function generateGrammarPatternChoice(lesson, count, lang) {
  const grammar = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  const dialogueLines = getDialogueLines(lesson);
  const dialogueTexts = dialogueLines.map((l) => getDialogueLineZh(l)).filter((t) => t && t.length >= 2);
  const out = [];

  for (let i = 0; i < Math.min(count, grammar.length); i++) {
    const g = grammar[i];
    const title = str(g?.title ?? g?.name ?? "");
    const exampleZh = getGrammarExampleZh(g);
    const pattern = GRAMMAR_PATTERNS.find((p) => title.includes(p));
    if (!pattern || !exampleZh || !exampleZh.includes(pattern)) continue;

    const correctSentence = exampleZh;
    const wrongPool = dialogueTexts.filter((t) => t !== correctSentence && !t.includes(pattern));
    const options = [correctSentence, ...shuffle(wrongPool).slice(0, 3)];
    const uniqueOpts = shuffle([...new Set(options)]).slice(0, 4);
    const contents = uniqueOpts.map((o) => ({ zh: o, pinyin: "", kr: "", en: "" }));
    const { options: optObjs, answer } = buildOptionsWithLetterKeys(contents, correctSentence);

    out.push({
      id: nextId("grammar"),
      type: "choice",
      subtype: "grammar_pattern_choice",
      source: "grammar",
      question: {
        zh: `下面哪一句用了「${pattern}」疑问句？`,
        kr: `「${pattern}」의문문을 사용한 문장은?`,
        en: `Which sentence uses the "${pattern}" question pattern?`,
      },
      prompt: { zh: pattern, pinyin: "" },
      options: optObjs,
      answer,
      explanation: {
        zh: `「${pattern}」用于构成一般疑问句。「${correctSentence}」是正确的。`,
        kr: `「${pattern}」는 의문문을 만듭니다. 「${correctSentence}」가 맞습니다.`,
        en: `"${pattern}" forms yes-no questions. "${correctSentence}" is correct.`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * C3. grammar_example_meaning
 * 给语法例句，问意思
 */
export function generateGrammarExampleMeaning(lesson, count, lang) {
  const grammar = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  const out = [];

  for (let i = 0; i < Math.min(count, grammar.length); i++) {
    const g = grammar[i];
    const example = g?.example ?? g?.examples;
    if (!example) continue;
    const exampleZh = typeof example === "string" ? example : str(example?.zh ?? example?.cn ?? "");
    const exampleKr = typeof example === "object" ? str(example?.kr ?? example?.ko ?? "") : "";
    const exampleEn = typeof example === "object" ? str(example?.en ?? "") : "";
    if (!exampleZh) continue;

    const correctMeaning = lang === "ko" ? exampleKr : lang === "en" ? exampleEn : exampleZh;
    if (!correctMeaning) continue;

    const otherGrammar = grammar.filter((x, j) => j !== i);
    const otherMeanings = otherGrammar
      .map((x) => (x?.example ?? x?.examples))
      .filter(Boolean)
      .map((ex) => (typeof ex === "object" ? (lang === "ko" ? ex.kr : ex.en) : ""))
      .filter(Boolean);
    const pool = [correctMeaning, ...shuffle(otherMeanings).slice(0, 3)];
    const contents = pool.map((m) => ({ zh: "", pinyin: "", kr: lang === "ko" ? m : "", en: lang === "en" ? m : "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, correctMeaning);

    out.push({
      id: nextId("grammar"),
      type: "choice",
      subtype: "grammar_example_meaning",
      source: "grammar",
      question: {
        zh: `「${exampleZh}」的意思是？`,
        kr: `「${exampleZh}」의 뜻은?`,
        en: `What does "${exampleZh}" mean?`,
      },
      prompt: { zh: exampleZh, pinyin: "" },
      options,
      answer,
      explanation: {
        zh: `「${exampleZh}」：${correctMeaning}`,
        kr: `「${exampleZh}」: ${correctMeaning}`,
        en: `"${exampleZh}" means ${correctMeaning}.`,
      },
      score: 1,
    });
  }
  return out;
}
