/**
 * Generate a full HSK1 lesson JSON (lesson1 schema) from dialogue + title.
 *
 * Usage:
 *   node scripts/lumina/generateLesson.mjs <input.json>
 *
 * input.json:
 *   { "lessonNo": 21, "title": { "zh","kr","jp","en" }, "dialogue": ["你好！", "谢谢。"] }
 *
 * Or import: import { generateLesson, saveLesson } from "./generateLesson.mjs";
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pinyin } from "pinyin-pro";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const LESSON1_PATH = path.join(ROOT, "data/courses/hsk2.0/hsk1/lesson1.json");
const OUT_DIR = path.join(ROOT, "data/courses/hsk2.0/hsk1");

/** Punctuation and spaces to strip before vocab extraction */
const PUNCT_FOR_STRIP =
  /[\s\u3000-\u303F\uFF0C-\uFF65\u2000-\u206F\u2E00-\u2E7F，。！？、；：「」『』（）【】《》…—·,.!?;:|/[\]{}()<>"'`~@#$%^&*+=\\]/gu;

const EMPTY_MEANING = { zh: "", kr: "", jp: "", en: "" };
const EMPTY_POS = { kr: "", en: "", jp: "" };
const EMPTY_TR = { kr: "", en: "", jp: "" };

function linePinyin(text) {
  const raw = pinyin(text, { toneType: "symbol", type: "string", v: true }).trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return raw;
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts.join(" ");
}

function wordPinyin(text) {
  return pinyin(text, { toneType: "symbol", type: "string", v: true }).replace(/\s+/g, " ").trim();
}

/**
 * Unique words: strip punctuation, then split on spaces if present, else keep whole line as one token.
 */
export function extractVocabFromDialogue(dialogueStrings) {
  const seen = new Set();
  const out = [];
  for (const sentence of dialogueStrings) {
    const stripped = String(sentence || "").replace(PUNCT_FOR_STRIP, "").trim();
    if (!stripped) continue;
    const parts = stripped.includes(" ") ? stripped.split(/\s+/).filter(Boolean) : [stripped];
    for (const t of parts) {
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function pickFourOptions(answer, vocab) {
  const out = [];
  const seen = new Set();
  for (const v of [answer, ...vocab]) {
    if (out.length >= 4) break;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  while (out.length < 4) out.push(answer);
  return out.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function buildPractice(vocab) {
  const V = vocab;
  if (!V.length) {
    const stub = {
      type: "choice",
      subtype: "sentence_blank",
      prompt: {
        cn: "（无自动词汇）请编辑对话与练习题。",
        kr: "(자동 어휘 없음) 대화와 연습을 편집하세요.",
        en: "(No auto vocab) Edit dialogue and practice.",
        jp: "（語彙なし）会話と練習を編集してください。",
      },
      options: ["—", "—", "—", "—"],
      answer: "—",
      explanation: { cn: "", kr: "", en: "", jp: "" },
    };
    return [1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, ...stub }));
  }

  const t0 = V[0];
  const t1 = V[Math.min(1, V.length - 1)];
  const t2 = V[Math.min(2, V.length - 1)];
  const t3 = V[Math.min(3, V.length - 1)];
  const qLine = V.find((t) => t.includes("？") || t.includes("?") || t.includes("吗")) || V[0];
  const a4 = V[Math.min(1, V.length - 1)];
  const a5 = V[Math.min(3, V.length - 1)];

  return [
    {
      id: "p1",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: `对方提到「${t0}」，下面哪一项是本课词语？`,
        kr: `「${t0}」와 관련해 본 과 단어는?`,
        en: `Related to 「${t0}」, which item is a lesson word?`,
        jp: `「${t0}」に関して、どれが語彙ですか？`,
      },
      options: pickFourOptions(t1, V),
      answer: t1,
      explanation: {
        cn: "选项均来自本课自动抽取的词语。",
        kr: "보기는 본 과에서 추출한 단어입니다.",
        en: "Options are from this lesson’s extracted words.",
        jp: "選択肢はこの課から抽出した語です。",
      },
    },
    {
      id: "p2",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: `下面哪一项是本课词语？（参考：${t2}）`,
        kr: `본 과 단어는? (참고: ${t2})`,
        en: `Which is a lesson word? (hint: ${t2})`,
        jp: `どれが語彙ですか？（ヒント：${t2}）`,
      },
      options: pickFourOptions(t3, V),
      answer: t3,
      explanation: {
        cn: "选项均来自本课词语。",
        kr: "보기는 본 과 단어입니다.",
        en: "Options are lesson words.",
        jp: "選択肢は語彙です。",
      },
    },
    {
      id: "p3",
      type: "choice",
      subtype: "zh_to_meaning",
      prompt: {
        cn: "下面哪一项带有疑问或「吗」？",
        kr: "아래 중 의문이나 「吗」가 있는 말은?",
        en: "Which item looks like a question (吗 / ?)?",
        jp: "疑問や「吗」を含むのはどれですか？",
      },
      options: pickFourOptions(qLine, V),
      answer: qLine,
      explanation: {
        cn: "请对照对话与词语表确认。",
        kr: "대화와 단어표를 확인하세요.",
        en: "Check against dialogue and vocab.",
        jp: "会話と語彙を確認してください。",
      },
    },
    {
      id: "p4",
      type: "choice",
      subtype: "sentence_blank",
      prompt: {
        cn: "选择本课词语：___",
        kr: "본 과 단어 고르기: ___",
        en: "Pick a lesson word: ___",
        jp: "語彙を選ぶ：___",
      },
      options: pickFourOptions(a4, V),
      answer: a4,
      explanation: {
        cn: "填入正确的本课词语。",
        kr: "맞는 단어를 고르세요.",
        en: "Choose the correct lesson word.",
        jp: "正しい語を選びます。",
      },
    },
    {
      id: "p5",
      type: "choice",
      subtype: "sentence_blank",
      prompt: {
        cn: "下面哪一项是本课词语？",
        kr: "아래 중 본 과 단어는?",
        en: "Which is a lesson word?",
        jp: "どれがこの課の語ですか？",
      },
      options: pickFourOptions(a5, V),
      answer: a5,
      explanation: {
        cn: "选项均来自本课词语。",
        kr: "보기는 본 과 단어입니다.",
        en: "Options are lesson words.",
        jp: "選択肢は語彙です。",
      },
    },
  ];
}

function simpleGrammar(sentences, maxPoints = 3) {
  const list = sentences.slice(0, maxPoints);
  return list.map((text) => {
    const stripped = String(text || "").replace(PUNCT_FOR_STRIP, "").trim();
    const pattern = stripped.slice(0, 10) || String(text).slice(0, 10);
    return {
      pattern,
      pinyin: wordPinyin(pattern),
      explanation: { kr: "", en: "", jp: "" },
      example: {
        text,
        pinyin: linePinyin(text),
        translation: { ...EMPTY_TR },
      },
    };
  });
}

function loadStepsTemplate() {
  const lesson1 = JSON.parse(fs.readFileSync(LESSON1_PATH, "utf8"));
  return lesson1.steps;
}

/**
 * @param {object} opts
 * @param {number} opts.lessonNo
 * @param {{ zh?: string, kr?: string, jp?: string, en?: string }} opts.title
 * @param {string[]} opts.dialogue - Chinese lines (full sentences)
 */
export function generateLesson({ lessonNo, title, dialogue }) {
  const n = Number(lessonNo);
  const lines = (dialogue || []).map((s) => String(s).trim()).filter(Boolean);
  const vocabHanzi = extractVocabFromDialogue(lines);

  const vocab = vocabHanzi.map((hanzi) => ({
    hanzi,
    pinyin: wordPinyin(hanzi),
    meaning: { ...EMPTY_MEANING },
    pos: { ...EMPTY_POS },
  }));

  const dialogueOut = lines.map((text, i) => ({
    speaker: i % 2 === 0 ? "A" : "B",
    text,
    pinyin: linePinyin(text),
    translation: { ...EMPTY_TR },
  }));

  const grammar = simpleGrammar(lines, 3);
  const practice = buildPractice(vocabHanzi);
  const steps = loadStepsTemplate();

  const titleObj = {
    zh: title?.zh || "",
    kr: title?.kr || "",
    jp: title?.jp || "",
    en: title?.en || "",
  };

  return {
    id: `hsk1_lesson${n}`,
    courseId: "hsk2.0_hsk1",
    level: "HSK1",
    version: "2.0",
    lessonNo: n,
    type: "lesson",
    title: titleObj,
    summary: {
      zh: titleObj.zh,
      kr: titleObj.kr,
      en: titleObj.en,
      jp: titleObj.jp,
    },
    scene: {
      id: `l${n}_scene`,
      title: { zh: titleObj.zh, kr: titleObj.kr, en: titleObj.en },
      summary: { zh: titleObj.zh, kr: titleObj.kr, en: titleObj.en },
    },
    objectives: [
      { zh: `学习本课词语与对话`, kr: "", en: "" },
      { zh: `能朗读并运用本课句子`, kr: "", en: "" },
    ],
    vocab,
    dialogue: dialogueOut,
    dialogueCards: [],
    grammar,
    extension: [],
    practice,
    review: {},
    ai: [
      {
        mode: "explain",
        title: { cn: "句子讲解", kr: "문장 설명", en: "Sentence Explanation", jp: "文の説明" },
        target: lines.slice(0, 2).join(" ") || lines[0] || "",
        hint: {
          cn: "请解释句意并补充翻译。",
          kr: "문장 뜻을 설명하고 번역을 채우세요.",
          en: "Explain the sentence and fill in translations.",
          jp: "文の意味を説明し、訳を埋めてください。",
        },
      },
      {
        mode: "roleplay",
        title: { cn: "情景对话", kr: "상황 대화", en: "Roleplay", jp: "ロールプレイ" },
        scenario: "lesson_dialogue",
        prompt: {
          cn: "请用本课对话练习角色扮演。",
          kr: "본 과 대화로 역할극을 연습하세요.",
          en: "Practice roleplay with this lesson’s lines.",
          jp: "この課の会話でロールプレイを練習しましょう。",
        },
      },
      {
        mode: "shadowing",
        title: { cn: "跟读练习", kr: "따라 읽기", en: "Shadowing", jp: "シャドーイング" },
        lines: [...lines],
      },
      {
        mode: "free_talk",
        title: { cn: "自由提问", kr: "자유 질문", en: "Free Talk", jp: "自由質問" },
        placeholder: {
          cn: "请输入你想问的问题",
          kr: "질문하고 싶은 내용을 입력하세요",
          en: "Type your question",
          jp: "質問を入力してください",
        },
      },
    ],
    aiPractice: {
      speaking: vocabHanzi.slice(0, Math.min(5, vocabHanzi.length)),
      chatPrompt: "请用本课词语与句子进行口语练习。",
    },
    steps,
  };
}

export function saveLesson(lessonNo, lessonJson) {
  const n = Number(lessonNo);
  const outPath = path.join(OUT_DIR, `lesson${n}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(lessonJson, null, 2) + "\n", "utf8");
  return outPath;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/lumina/generateLesson.mjs <input.json>");
    process.exit(1);
  }
  const inputPath = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const { lessonNo, title, dialogue } = raw;
  if (lessonNo == null || !title || !Array.isArray(dialogue)) {
    console.error("input.json must include lessonNo, title {zh,kr,jp,en}, dialogue: string[]");
    process.exit(1);
  }
  const json = generateLesson({ lessonNo, title, dialogue });
  const out = saveLesson(lessonNo, json);
  console.log("Wrote", out);
}

/** CLI: `node generateLesson.mjs <input.json>` — do not set argv[2] when importing this module. */
if (process.argv[2]) main();
