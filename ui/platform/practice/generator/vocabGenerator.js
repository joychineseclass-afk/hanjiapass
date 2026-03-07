/**
 * Auto Practice Generator - 从 lesson.vocab 生成
 * 5 choice + 5 fill
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function getMeaning(w, lang = "zh") {
  const m = w?.meaning;
  if (!m || typeof m !== "object") return str(w?.hanzi ?? w?.word) || "";
  const l = String(lang || "zh").toLowerCase();
  if (l === "zh" || l === "cn") return str(m.zh ?? m.cn) || str(m.kr ?? m.ko) || str(m.en);
  if (l === "ko" || l === "kr") return str(m.kr ?? m.ko) || str(m.en) || str(m.zh ?? m.cn);
  return str(m.en) || str(m.kr ?? m.ko) || str(m.zh ?? m.cn);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 生成 5 道词汇选择题
 */
export function generateVocabChoice(vocab, count = 5) {
  const items = Array.isArray(vocab) ? vocab : [];
  if (items.length < 2) return [];

  const out = [];
  const pool = shuffle(items).filter((w) => str(w?.hanzi ?? w?.word));

  for (let i = 0; i < count && i < pool.length; i++) {
    const target = pool[i];
    const hanzi = str(target?.hanzi ?? target?.word);
    if (!hanzi) continue;

    const correctMean = getMeaning(target, "zh");
    const others = items.filter((w) => w !== target).map((w) => getMeaning(w, "zh")).filter(Boolean);
    const options = [correctMean, ...shuffle(others).slice(0, 3)];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      id: `vocab-choice-${i + 1}`,
      question: {
        zh: `「${hanzi}」是什么意思？`,
        kr: `「${hanzi}」는 무슨 뜻입니까?`,
        en: `What does '${hanzi}' mean?`,
      },
      options: uniqueOpts.length >= 2 ? uniqueOpts : [correctMean, "其他"],
      answer: correctMean,
      explanation: {
        zh: `「${hanzi}」：${correctMean}`,
        kr: `「${hanzi}」: ${correctMean}`,
        en: `'${hanzi}' means ${correctMean}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 生成 5 道词汇填空题
 */
export function generateVocabFill(vocab, count = 5) {
  const items = Array.isArray(vocab) ? vocab : [];
  if (!items.length) return [];

  const out = [];
  const pool = items.filter((w) => str(w?.hanzi ?? w?.word));

  for (let i = 0; i < count && i < pool.length; i++) {
    const target = pool[i];
    const hanzi = str(target?.hanzi ?? target?.word);
    if (!hanzi) continue;

    const mean = getMeaning(target, "zh");

    out.push({
      type: "fill",
      id: `vocab-fill-${i + 1}`,
      question: {
        zh: `请填写正确的汉字：___ 的意思是「${mean}」`,
        kr: `올바른 한자를 쓰세요: ___ 의 뜻은「${mean}」`,
        en: `Fill in the correct character: ___ means "${mean}"`,
      },
      answer: hanzi,
      explanation: {
        zh: `答案：${hanzi}。${mean}`,
        kr: `답: ${hanzi}. ${mean}`,
        en: `Answer: ${hanzi}. ${mean}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 从 vocab 生成 10 题（5 choice + 5 fill）
 */
export function generateFromVocab(lesson) {
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const choice = generateVocabChoice(vocab, 5);
  const fill = generateVocabFill(vocab, 5);
  return [...choice, ...fill];
}
