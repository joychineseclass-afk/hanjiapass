/**
 * Auto Practice Generator - 从 lesson.dialogue 生成
 * 4 choice + 3 order
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
 * 生成 4 道对话选择题
 */
export function generateDialogueChoice(dialogue, count = 4) {
  const lines = Array.isArray(dialogue) ? dialogue : [];
  if (lines.length < 2) return [];

  const out = [];
  const allTexts = lines.map((l) => getLineText(l)).filter(Boolean);
  const texts = [...new Set(allTexts)];
  if (texts.length < 2) return [];

  for (let i = 0; i < Math.min(count, texts.length); i++) {
    const target = texts[i];
    const others = texts.filter((t) => t !== target);
    const options = [target, ...shuffle(others).slice(0, 3)];
    const uniqueOpts = [...new Set(shuffle(options))].slice(0, 4);

    out.push({
      type: "choice",
      id: `dialogue-choice-${i + 1}`,
      question: {
        zh: `对话中第 ${i + 1} 句是什么？`,
        kr: `대화에서 ${i + 1}번째 문장은?`,
        en: `What is the ${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"} line in the dialogue?`,
      },
      options: uniqueOpts.length >= 2 ? uniqueOpts : [target],
      answer: target,
      explanation: {
        zh: `正确答案：${target}`,
        kr: `정답: ${target}`,
        en: `Correct answer: ${target}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 生成 3 道对话排序题
 */
export function generateDialogueOrder(dialogue, count = 3) {
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
 * 从 dialogue 生成 7 题（4 choice + 3 order）
 */
export function generateFromDialogue(lesson) {
  const dialogue = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const choice = generateDialogueChoice(dialogue, 4);
  const order = generateDialogueOrder(dialogue, 3);
  return [...choice, ...order];
}
