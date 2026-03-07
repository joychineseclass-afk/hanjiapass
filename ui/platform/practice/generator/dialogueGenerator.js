/**
 * Auto Practice Generator - 从 lesson.dialogue 生成
 * 4 听句选词 + 4 语序 + 4 填空 + 2 理解
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function getLineText(line) {
  return str(line?.zh ?? line?.cn ?? line?.line ?? "");
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
 * 将句子拆成可排序的词语（按字符或常见词切分）
 */
function splitSentence(s) {
  const t = str(s);
  if (!t) return [];
  if (t.length <= 2) return [t];
  if (t.length === 3) return [t[0], t.slice(1)];
  if (t.length === 4) return [t.slice(0, 2), t.slice(2)];
  if (t.length <= 6) return [t.slice(0, 2), t.slice(2, 4), t.slice(4)].filter(Boolean);
  const parts = [];
  let i = 0;
  while (i < t.length) {
    const chunk = t.slice(i, i + 2);
    if (chunk) parts.push(chunk);
    i += 2;
  }
  return parts.length >= 2 ? parts : [t];
}

/**
 * 听句选词：句子 → 选择正确释义/对应词
 * 例：你好！这句话的意思是？ A 再见 B 你好 C 谢谢
 */
export function generateSentenceMeaningChoice(dialogue, vocab, count = 4) {
  const lines = Array.isArray(dialogue) ? dialogue : [];
  const vocabItems = Array.isArray(vocab) ? vocab : [];
  const vocabWords = vocabItems.map((w) => str(w?.hanzi ?? w?.word)).filter(Boolean);
  if (lines.length < 1 || vocabWords.length < 2) return [];

  const out = [];
  const used = new Set();
  const pool = shuffle(lines);

  for (let i = 0; i < count && i < pool.length; i++) {
    const line = pool[i];
    const sentence = getLineText(line);
    if (!sentence || used.has(sentence)) continue;
    used.add(sentence);

    const matchWord = vocabWords.find((w) => sentence.includes(w)) || vocabWords[0];
    const others = shuffle(vocabWords.filter((w) => w !== matchWord)).slice(0, 3);
    const options = [matchWord, ...others];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      id: `dialogue-meaning-${i + 1}`,
      question: {
        zh: `「${sentence}」这句话的意思是？`,
        kr: `「${sentence}」이 문장의 뜻은?`,
        en: `What does "${sentence}" mean?`,
      },
      options: uniqueOpts.length >= 2 ? uniqueOpts : [matchWord, "其他"],
      answer: matchWord,
      explanation: {
        zh: `「${sentence}」：${matchWord}`,
        kr: `「${sentence}」: ${matchWord}`,
        en: `"${sentence}" means ${matchWord}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 生成 4 道对话排序题
 */
export function generateDialogueOrder(dialogue, count = 4) {
  const lines = Array.isArray(dialogue) ? dialogue : [];
  const texts = lines.map((l) => getLineText(l)).filter((t) => t.length >= 2);
  if (!texts.length) return [];

  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const t = texts[i % texts.length];
    if (!t || used.has(t)) continue;
    used.add(t);

    const pieces = splitSentence(t);
    if (pieces.length < 2) continue;

    const shuffled = shuffle([...pieces]);
    if (shuffled.join("") === t) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }

    out.push({
      type: "order",
      id: `dialogue-order-${i + 1}`,
      question: {
        zh: "请将词语按正确顺序排列成句子。",
        kr: "단어를 올바른 순서로 배열하세요.",
        en: "Arrange the words in the correct order.",
      },
      options: shuffled,
      answer: t,
      explanation: {
        zh: `正确答案：${t}`,
        kr: `정답: ${t}`,
        en: `Correct answer: ${t}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 填空题：从对话句挖空，选词填空
 * 例：你____吗？ A 好 B 好吗 C 好的
 */
export function generateDialogueFill(dialogue, vocab, count = 4) {
  const lines = Array.isArray(dialogue) ? dialogue : [];
  const vocabItems = Array.isArray(vocab) ? vocab : [];
  const texts = lines.map((l) => getLineText(l)).filter((t) => t.length >= 2);
  if (!texts.length) return [];

  const out = [];

  for (let i = 0; i < count; i++) {
    const t = texts[i % texts.length];
    if (!t) continue;

    const pieces = splitSentence(t);
    if (pieces.length < 2) continue;
    const idx = i % pieces.length;
    const blank = pieces[idx];
    const before = pieces.slice(0, idx).join("");
    const after = pieces.slice(idx + 1).join("");
    const sentence = before + "____" + after;

    const wrongOpts = vocabItems
      .map((w) => str(w?.hanzi ?? w?.word))
      .filter((w) => w && w !== blank && w.length <= 3);
    const options = [blank, ...shuffle(wrongOpts).slice(0, 3)];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      id: `dialogue-fill-${i + 1}`,
      question: {
        zh: `请选择正确的词填空：${sentence}`,
        kr: `빈칸에 맞는 말을 고르세요: ${sentence}`,
        en: `Choose the correct word: ${sentence}`,
      },
      options: uniqueOpts.length >= 2 ? uniqueOpts : [blank],
      answer: blank,
      explanation: {
        zh: `正确答案：${t}`,
        kr: `정답: ${t}`,
        en: `Correct answer: ${t}`,
      },
      score: 1,
    });
  }
  return out;
}

/** 理解题选项映射 */
const COMPREHENSION_MAP = [
  { keywords: ["你好", "您好", "嗨"], answer: "打招呼" },
  { keywords: ["再见", "拜拜"], answer: "告别" },
  { keywords: ["谢谢", "感谢"], answer: "感谢" },
  { keywords: ["对不起", "抱歉"], answer: "道歉" },
  { keywords: ["你好吗", "怎么样"], answer: "问候" },
];

/**
 * 理解题：对话片段 → 他们在做什么？
 */
export function generateDialogueComprehension(dialogue, count = 2) {
  const lines = Array.isArray(dialogue) ? dialogue : [];
  if (lines.length < 2) return [];

  const out = [];
  const allAnswers = COMPREHENSION_MAP.map((c) => c.answer);

  for (let i = 0; i < count; i++) {
    const lineA = lines[i * 2 % lines.length];
    const lineB = lines[(i * 2 + 1) % lines.length];
    const textA = getLineText(lineA);
    const textB = getLineText(lineB);
    if (!textA || !textB) continue;

    let answer = "打招呼";
    for (const { keywords, answer: a } of COMPREHENSION_MAP) {
      if (keywords.some((k) => textA.includes(k) || textB.includes(k))) {
        answer = a;
        break;
      }
    }

    const others = shuffle(allAnswers.filter((a) => a !== answer)).slice(0, 3);
    const options = [answer, ...others];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      id: `dialogue-comprehension-${i + 1}`,
      question: {
        zh: `A：${textA}\nB：${textB}\n\n他们是在做什么？`,
        kr: `A: ${textA}\nB: ${textB}\n\n그들은 무엇을 하고 있나요?`,
        en: `A: ${textA}\nB: ${textB}\n\nWhat are they doing?`,
      },
      options: uniqueOpts,
      answer,
      explanation: {
        zh: `正确答案：${answer}`,
        kr: `정답: ${answer}`,
        en: `Correct answer: ${answer}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 从 dialogue 生成 14 题（4 听句选词 + 4 语序 + 4 填空 + 2 理解）
 */
export function generateFromDialogue(lesson) {
  const dialogue = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const meaning = generateSentenceMeaningChoice(dialogue, vocab, 4);
  const order = generateDialogueOrder(dialogue, 4);
  const fill = generateDialogueFill(dialogue, vocab, 4);
  const comprehension = generateDialogueComprehension(dialogue, 2);
  return [...meaning, ...order, ...fill, ...comprehension];
}
