/**
 * 对话练习生成 - 从 dialogueCards 或 dialogue 提取
 * 题型：填空、语序、理解
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function getLineText(line) {
  return str(line?.zh ?? line?.cn ?? line?.line ?? "");
}

/** 从 lesson 提取所有对话行（兼容 dialogueCards / dialogue） */
function getDialogueLines(lesson) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  if (cards.length) {
    return cards.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  }
  const d = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const first = d[0];
  if (first?.lines) return d.flatMap((c) => c.lines || []);
  return d;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitSentence(s) {
  const t = str(s);
  if (!t || t.length < 2) return [];
  if (t.length <= 3) return [t.slice(0, 1), t.slice(1)].filter(Boolean);
  if (t.length <= 5) return [t.slice(0, 2), t.slice(2)].filter(Boolean);
  const parts = [];
  let i = 0;
  while (i < t.length) {
    const chunk = t.slice(i, i + 2);
    if (chunk) parts.push(chunk);
    i += 2;
  }
  return parts.length >= 2 ? parts : [t];
}

/** 填空题 - 挖空选词，选项合理 */
export function generateDialogueFill(lesson, count = 1) {
  const lines = getDialogueLines(lesson);
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const texts = lines.map((l) => getLineText(l)).filter((t) => t.length >= 2);
  if (!texts.length) return [];

  const vocabHanzi = vocab.map((w) => str(w?.hanzi ?? w?.word)).filter(Boolean);
  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const t = texts[i % texts.length];
    if (!t || used.has(t)) continue;

    const pieces = splitSentence(t);
    if (pieces.length < 2) continue;
    const idx = i % pieces.length;
    const blank = pieces[idx];
    if (!blank || blank.length > 3) continue;
    used.add(t);

    const before = pieces.slice(0, idx).join("");
    const after = pieces.slice(idx + 1).join("");
    const sentence = before + "___" + after;

    const wrongOpts = vocabHanzi.filter((w) => w !== blank && w.length <= 3);
    const options = [blank, ...shuffle(wrongOpts).slice(0, 3)];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      subType: "fill",
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

/** 语序题 */
export function generateDialogueOrder(lesson, count = 1) {
  const lines = getDialogueLines(lesson);
  const texts = lines.map((l) => getLineText(l)).filter((t) => t.length >= 2);
  if (!texts.length) return [];

  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const t = texts[i % texts.length];
    if (!t || used.has(t)) continue;

    const pieces = splitSentence(t);
    if (pieces.length < 2) continue;
    used.add(t);

    const wrongOrders = new Set();
    wrongOrders.add(t);
    for (let j = 0; j < 5; j++) {
      const shuffled = shuffle([...pieces]);
      const joined = shuffled.join("");
      if (joined !== t) wrongOrders.add(joined);
    }
    const options = [t, ...shuffle([...wrongOrders]).filter((o) => o !== t).slice(0, 3)];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      subType: "order",
      id: `dialogue-order-${i + 1}`,
      question: {
        zh: `词语：${pieces.join(" / ")}。请选择正确的排列。`,
        kr: `단어: ${pieces.join(" / ")}. 올바른 순서를 고르세요.`,
        en: `Words: ${pieces.join(" / ")}. Choose the correct order.`,
      },
      options: uniqueOpts.length >= 2 ? uniqueOpts : [t],
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

/** 理解题 - 从对话推出答案 */
export function generateDialogueComprehension(lesson, count = 1) {
  const lines = getDialogueLines(lesson);
  if (lines.length < 2) return [];

  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const idx = i * 2 % lines.length;
    const lineA = lines[idx];
    const lineB = lines[(idx + 1) % lines.length];
    const textA = getLineText(lineA);
    const textB = getLineText(lineB);
    if (!textA || !textB || used.has(textA + textB)) continue;
    used.add(textA + textB);

    const answer = textB;
    const others = lines
      .map((l) => getLineText(l))
      .filter((t) => t && t !== answer && t.length >= 2);
    const options = [answer, ...shuffle(others).slice(0, 3)];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      subType: "comprehension",
      id: `dialogue-comp-${i + 1}`,
      question: {
        zh: `A：${textA}\nB：___\n\nB 应该说什么？`,
        kr: `A: ${textA}\nB: ___\n\nB가 뭐라고 말해야 할까요?`,
        en: `A: ${textA}\nB: ___\n\nWhat should B say?`,
      },
      options: uniqueOpts,
      answer,
      explanation: {
        zh: `B：${answer}`,
        kr: `B: ${answer}`,
        en: `B: ${answer}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 按等级生成对话题
 * HSK1-2: 1 填空 + 1 理解
 * HSK3-4: 2 填空 + 2 语序 + 1 理解
 * HSK5+: 更多
 */
export function generateFromDialogue(lesson, level = 1) {
  if (level <= 2) {
    const fill = generateDialogueFill(lesson, 1);
    const comp = generateDialogueComprehension(lesson, 1);
    return [...fill, ...comp];
  }
  if (level <= 4) {
    const fill = generateDialogueFill(lesson, 2);
    const order = generateDialogueOrder(lesson, 2);
    const comp = generateDialogueComprehension(lesson, 1);
    return [...fill, ...order, ...comp];
  }
  const fill = generateDialogueFill(lesson, 3);
  const order = generateDialogueOrder(lesson, 2);
  const comp = generateDialogueComprehension(lesson, 2);
  return [...fill, ...order, ...comp];
}
