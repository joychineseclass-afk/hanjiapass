/**
 * 词汇练习生成 - 题型逻辑正确
 * A: 词义识别 - 看中文选翻译（选项为翻译）
 * B: 翻译找中文 - 看翻译选中文
 * C: 拼音选中文
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

/** 取多语言释义，带 key（hanzi）用于判题 */
function getMeaningObj(w) {
  const hanzi = str(w?.hanzi ?? w?.word);
  const m = w?.meaning;
  if (!m || typeof m !== "object") return { key: hanzi, zh: hanzi, kr: "", en: "" };
  return {
    key: hanzi,
    zh: str(m.zh ?? m.cn) || str(m.kr ?? m.ko) || str(m.en),
    kr: str(m.kr ?? m.ko) || str(m.en) || str(m.zh ?? m.cn),
    en: str(m.en) || str(m.kr ?? m.ko) || str(m.zh ?? m.cn),
  };
}

/** A: 词义识别 - 看中文选翻译。选项为多语言对象 {key, zh, kr, en}，answer 为 key */
function generateMeaningChoice(vocab, count = 2) {
  const items = Array.isArray(vocab) ? vocab : [];
  if (items.length < 2) return [];

  const out = [];
  const pool = shuffle(items).filter((w) => str(w?.hanzi ?? w?.word));

  for (let i = 0; i < count && i < pool.length; i++) {
    const target = pool[i];
    const hanzi = str(target?.hanzi ?? target?.word);
    if (!hanzi) continue;

    const correctObj = getMeaningObj(target);
    const others = items
      .filter((w) => w !== target)
      .map((w) => getMeaningObj(w))
      .filter((o) => o.key && o.key !== hanzi);
    const options = [correctObj, ...shuffle(others).slice(0, 3)];
    const uniqueOpts = options.slice(0, 4);

    out.push({
      type: "choice",
      subType: "meaning",
      id: `vocab-meaning-${i + 1}`,
      question: {
        zh: `「${hanzi}」的意思是？`,
        kr: `「${hanzi}」의 뜻은?`,
        en: `What does '${hanzi}' mean?`,
      },
      options: uniqueOpts,
      answer: hanzi,
      explanation: {
        zh: `「${hanzi}」：${correctObj.zh || correctObj.kr || correctObj.en}`,
        kr: `「${hanzi}」: ${correctObj.kr || correctObj.zh || correctObj.en}`,
        en: `'${hanzi}' means ${correctObj.en || correctObj.kr || correctObj.zh}`,
      },
      score: 1,
    });
  }
  return out;
}

/** B: 翻译找中文 - 看翻译选中文。题干用多语言，选项为中文词 */
function generateTranslateToZh(vocab, count = 1) {
  const items = Array.isArray(vocab) ? vocab : [];
  if (items.length < 2) return [];

  const out = [];
  const pool = shuffle(items).filter((w) => str(w?.hanzi ?? w?.word));

  for (let i = 0; i < count && i < pool.length; i++) {
    const target = pool[i];
    const hanzi = str(target?.hanzi ?? target?.word);
    const trans = getMeaningObj(target);
    if (!hanzi || !(trans.zh || trans.kr || trans.en)) continue;

    const others = items
      .filter((w) => w !== target)
      .map((w) => str(w?.hanzi ?? w?.word))
      .filter((h) => h && h !== hanzi);
    const options = [hanzi, ...shuffle(others).slice(0, 3)];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      subType: "trans2zh",
      id: `vocab-trans-${i + 1}`,
      question: {
        zh: `「${trans.zh || trans.kr || trans.en}」用中文怎么说？`,
        kr: `「${trans.kr || trans.zh || trans.en}」은 중국어로?`,
        en: `Which Chinese word means '${trans.en || trans.kr || trans.zh}'?`,
      },
      options: uniqueOpts.length >= 2 ? uniqueOpts : [hanzi],
      answer: hanzi,
      explanation: {
        zh: `「${trans.zh || trans.kr}」：${hanzi}`,
        kr: `「${trans.kr || trans.zh}」: ${hanzi}`,
        en: `'${trans.en || trans.kr}' is ${hanzi}`,
      },
      score: 1,
    });
  }
  return out;
}

/** C: 拼音选中文 */
function generatePinyinChoice(vocab, count = 1) {
  const items = Array.isArray(vocab) ? vocab : [];
  if (items.length < 2) return [];

  const out = [];
  const pool = shuffle(items).filter((w) => str(w?.hanzi ?? w?.word) && str(w?.pinyin ?? w?.py));

  for (let i = 0; i < count && i < pool.length; i++) {
    const target = pool[i];
    const hanzi = str(target?.hanzi ?? target?.word);
    const pinyin = str(target?.pinyin ?? target?.py);
    if (!hanzi || !pinyin) continue;

    const others = items
      .filter((w) => w !== target)
      .map((w) => str(w?.hanzi ?? w?.word))
      .filter((h) => h && h !== hanzi);
    const options = [hanzi, ...shuffle(others).slice(0, 3)];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      id: `vocab-pinyin-${i + 1}`,
      question: {
        zh: `「${pinyin}」是哪一个？`,
        kr: `「${pinyin}」은 어느 것?`,
        en: `Which word is "${pinyin}"?`,
      },
      options: uniqueOpts.length >= 2 ? uniqueOpts : [hanzi],
      answer: hanzi,
      explanation: {
        zh: `「${pinyin}」：${hanzi}`,
        kr: `「${pinyin}」: ${hanzi}`,
        en: `"${pinyin}" is ${hanzi}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 按等级生成词汇题
 * HSK1-2: 2 词义 + 1 翻译找中文
 * HSK3-4: 3 词义 + 2 翻译找中文
 * HSK5+: 更多
 */
export function generateFromVocab(lesson, level = 1) {
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];

  if (level <= 2) {
    const a = generateMeaningChoice(vocab, 2);
    const b = generateTranslateToZh(vocab, 1);
    return [...a, ...b];
  }
  if (level <= 4) {
    const a = generateMeaningChoice(vocab, 3);
    const b = generateTranslateToZh(vocab, 2);
    return [...a, ...b];
  }
  const a = generateMeaningChoice(vocab, 4);
  const b = generateTranslateToZh(vocab, 2);
  const c = generatePinyinChoice(vocab, 1);
  return [...a, ...b, ...c];
}
