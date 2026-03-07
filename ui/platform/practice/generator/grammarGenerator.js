/**
 * Auto Practice Generator - 从 lesson.grammar 生成
 * 3 fill
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function getExampleZh(g) {
  const ex = g?.example ?? g?.examples;
  if (!ex) return "";
  if (typeof ex === "string") return ex;
  return str(ex?.zh ?? ex?.cn ?? ex?.line ?? "");
}

function getExplanation(g, lang = "zh") {
  const l = String(lang || "zh").toLowerCase();
  const zh = str(g?.explanation_zh ?? g?.explanation?.zh ?? g?.zh);
  const kr = str(g?.explanation_kr ?? g?.explanation?.kr ?? g?.kr ?? g?.ko);
  const en = str(g?.explanation_en ?? g?.explanation?.en ?? g?.en);
  if (l === "zh" || l === "cn") return zh || kr || en;
  if (l === "ko" || l === "kr") return kr || en || zh;
  return en || kr || zh;
}

const GRAMMAR_PATTERNS = ["吗", "很", "叫", "什么", "是", "不", "也", "的", "了", "在"];

/**
 * 从例句中提取可填空的词（单字或关键词）
 */
function extractBlankFromExample(exampleZh, grammarTitle) {
  if (!exampleZh || exampleZh.length < 2) return null;
  const title = str(grammarTitle);

  for (const keyword of GRAMMAR_PATTERNS) {
    if (title.includes(keyword) && exampleZh.includes(keyword)) {
      return { sentence: exampleZh.replace(keyword, "___"), answer: keyword };
    }
  }

  if (exampleZh.length >= 2) {
    const mid = Math.floor(exampleZh.length / 2);
    const char = exampleZh[mid];
    const before = exampleZh.slice(0, mid);
    const after = exampleZh.slice(mid + 1);
    return { sentence: before + "___" + after, answer: char };
  }
  return null;
}

/**
 * 生成 3 道语法选择题（统一为 choice）
 * 将填空题转为：选择正确填空
 */
export function generateGrammarFill(grammar, count = 3) {
  const items = Array.isArray(grammar) ? grammar : [];
  if (!items.length) return [];

  const out = [];
  for (let i = 0; i < Math.min(count, items.length); i++) {
    const g = items[i];
    const exampleZh = getExampleZh(g);
    const title = str(g?.title ?? g?.name ?? "");
    const expl = getExplanation(g, "zh");

    const blank = extractBlankFromExample(exampleZh, title);
    if (!blank) continue;

    const punct = /[。？！，、；：""''（）\s]/;
    const chars = exampleZh.split("").filter((c) => c.trim() && c !== blank.answer && !punct.test(c));
    const wrongOpts = [...new Set(chars)].slice(0, 3);
    const options = [blank.answer, ...wrongOpts];
    const uniqueOpts = [...new Set(options)].slice(0, 4);

    out.push({
      type: "choice",
      id: `grammar-fill-${i + 1}`,
      question: {
        zh: `请选择正确的词填空：${blank.sentence}`,
        kr: `빈칸에 맞는 말을 고르세요: ${blank.sentence}`,
        en: `Choose the correct word: ${blank.sentence}`,
      },
      options: uniqueOpts.length >= 2 ? uniqueOpts : [blank.answer],
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

/**
 * 按等级生成语法题
 * HSK1-2: 0
 * HSK3-4: 1
 * HSK5+: 2-3
 */
export function generateFromGrammar(lesson, level = 1) {
  const grammar = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  if (level <= 2) return [];
  if (level <= 4) return generateGrammarFill(grammar, 1);
  return generateGrammarFill(grammar, Math.min(3, grammar.length));
}
