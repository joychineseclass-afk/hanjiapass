/**
 * Normalize hsk1 lesson2–lesson20 to match lesson1.json structure.
 * Run from repo root: node scripts/normalize-hsk1-lessons-2-20.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pinyin } from "pinyin-pro";
import { LINE_I18N } from "./hsk1-line-i18n.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "data/courses/hsk2.0/hsk1");
const L1_PATH = path.join(DIR, "lesson1.json");

function linePinyin(text) {
  const raw = pinyin(text, { toneType: "symbol", type: "string", v: true }).trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return raw;
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts.join(" ");
}

function vocabPinyin(text) {
  return pinyin(text, { toneType: "symbol", type: "string", v: true }).replace(/\s+/g, " ").trim();
}

function uniqDialogueTexts(dialogue) {
  const seen = new Set();
  const out = [];
  for (const ln of dialogue || []) {
    const t = (ln && ln.text) || "";
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function buildVocabEntries(texts) {
  return texts.map((hanzi) => {
    const tr = LINE_I18N[hanzi];
    return {
      hanzi,
      pinyin: vocabPinyin(hanzi),
      meaning: {
        zh: hanzi,
        kr: tr?.kr || "",
        jp: tr?.jp || "",
        en: tr?.en || "",
      },
      pos: { kr: "표현", en: "expression", jp: "表現" },
    };
  });
}

function pickFourOptions(answer, vocab) {
  const set = new Set([answer]);
  for (const v of vocab) {
    if (set.size >= 4) break;
    set.add(v);
  }
  while (set.size < 4) set.add(answer);
  return [...set].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function pickNotInDialogueLine(vocabTexts) {
  const inLesson = new Set(vocabTexts || []);
  const candidates = Object.keys(LINE_I18N).filter((t) => {
    if (!t || t.length < 2) return false;
    if (inLesson.has(t)) return false;
    return true;
  });
  return candidates[0] || "今天我不去学校。";
}

function buildDialogueNotAppearedOptions(vocabTexts, distractor) {
  const lessonLines = [...new Set((vocabTexts || []).filter(Boolean))].filter((t) => t !== distractor);
  const appeared = lessonLines.slice(0, 3);
  const set = new Set([...appeared, distractor]);
  return [...set].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function buildPractice(vocabTexts, lines) {
  const V = vocabTexts;
  const d = lines;
  const t0 = d[0]?.text || V[0];
  const t1 = d[1]?.text || V[1];
  const t2 = d[2]?.text || V[Math.min(2, V.length - 1)];
  const t3 = d[3]?.text || V[Math.min(3, V.length - 1)];
  const qLine = V.find((t) => t.includes("？") || t.includes("?") || t.includes("吗")) || V[0];
  const a4 = V[Math.min(1, V.length - 1)];
  const a5 = V[Math.min(3, V.length - 1)];

  return [
    {
      id: "p1",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: `对方说「${t0}」，你应该说？`,
        kr: `상대가 말할 때: 「${t0}」 답은?`,
        en: `Someone says: "${t0}" You should say?`,
        jp: `相手が「${t0}」と言ったら、あなたは？`,
      },
      options: pickFourOptions(t1, V),
      answer: t1,
      explanation: {
        cn: "请根据本课对话选择应答句。",
        kr: "이번 과 대화에 맞는 응답을 고르세요.",
        en: "Pick the reply that fits this lesson’s dialogue.",
        jp: "この課の会話に合う返答を選びます。",
      },
    },
    {
      id: "p2",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: `对方说「${t2}」，你应该说？`,
        kr: `상대가 말할 때: 「${t2}」 답은?`,
        en: `Someone says: "${t2}" You should say?`,
        jp: `相手が「${t2}」と言ったら、あなたは？`,
      },
      options: pickFourOptions(t3, V),
      answer: t3,
      explanation: {
        cn: "请根据本课对话选择应答句。",
        kr: "이번 과 대화에 맞는 응답을 고르세요.",
        en: "Pick the reply that fits this lesson’s dialogue.",
        jp: "この課の会話に合う返答を選びます。",
      },
    },
    {
      id: "p3",
      type: "choice",
      subtype: "zh_to_meaning",
      prompt: {
        cn: "下面哪一句是本课的问句？",
        kr: "아래 중 이번 과의 질문 문장은?",
        en: "Which line below is a question in this lesson?",
        jp: "次のうち、この課の疑問文はどれですか？",
      },
      options: pickFourOptions(qLine, V),
      answer: qLine,
      explanation: {
        cn: "问句常带有「吗」或问号「？」。",
        kr: "의문문에는 「吗」나 「？」가 자주 붙습니다.",
        en: "Questions often use 吗 or 「？」。",
        jp: "疑問文には「吗」や「？」がよく付きます。",
      },
    },
    {
      id: "p4",
      type: "choice",
      subtype: "sentence_blank",
      prompt: {
        cn: "选择本课对话中的句子：___",
        kr: "이번 과 대화 문장 고르기: ___",
        en: "Pick a sentence from this lesson’s dialogue: ___",
        jp: "この課の会話の文を選ぶ：___",
      },
      options: pickFourOptions(a4, V),
      answer: a4,
      explanation: {
        cn: "选项均出自本课对话。",
        kr: "보기는 모두 이번 과 대화에서 나옵니다.",
        en: "All options come from this lesson’s dialogue.",
        jp: "選択肢はすべてこの課の会話に出てきます。",
      },
    },
    {
      id: "p5",
      type: "choice",
      subtype: "sentence_blank",
      prompt: {
        cn: "下面哪一句没有出现在本课对话里？",
        kr: "다음 중 이번 과 대화에 나오지 않는 문장은 무엇입니까?",
        en: "Which sentence did NOT appear in this lesson dialogue?",
        jp: "次のうち、この課の会話に出てこない文はどれですか？",
      },
      options: buildDialogueNotAppearedOptions(V, pickNotInDialogueLine(V)),
      answer: pickNotInDialogueLine(V),
      explanation: {
        cn: "正确答案是未在本课对话中出现的句子。",
        kr: "정답은 이번 과 대화에 나오지 않은 문장입니다.",
        en: "The correct answer is the sentence that does not appear in this lesson dialogue.",
        jp: "正解は、この課の会話に出てこない文です。",
      },
    },
  ];
}

function patternLineScore(pattern, text) {
  const p = pattern || "";
  const t = text || "";
  let s = 0;
  if (p.includes("是") && p.includes("我") && !t.includes("是")) s -= 4;
  if (p.includes("是") && t.includes("是")) s += 6;
  const keys = ["我叫", "我是", "呢", "吗", "谁", "哪", "什么", "几", "怎么", "想", "要", "会", "有", "没", "不", "很", "的", "在", "去", "来", "请", "找", "谢谢", "不客气", "再见", "你好"];
  for (const k of keys) {
    if (p.includes(k) && t.includes(k)) s += k.length >= 2 ? 3 : 1;
  }
  return s;
}

/** Assign dialogue lines to grammar points by keyword overlap; append leftover lines to last point. */
function assignDialogueToGrammar(patterns, dialogue) {
  const lines = (dialogue || []).map((d) => d.text).filter(Boolean);
  const nG = patterns.length;
  if (!nG || !lines.length) return [];
  const used = new Set();
  const chunks = patterns.map(() => []);
  for (let g = 0; g < nG; g++) {
    const pat = patterns[g].pattern || "";
    let best = -1;
    let bestI = -1;
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      const sc = patternLineScore(pat, lines[i]);
      if (sc > best) {
        best = sc;
        bestI = i;
      }
    }
    if (bestI < 0) {
      bestI = lines.findIndex((_, i) => !used.has(i));
    }
    if (bestI >= 0) {
      chunks[g].push(lines[bestI]);
      used.add(bestI);
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (!used.has(i)) chunks[nG - 1].push(lines[i]);
  }
  return chunks;
}

function mergeLineTranslations(parts) {
  const kr = parts.map((p) => LINE_I18N[p]?.kr || "").filter(Boolean).join(" ");
  const en = parts.map((p) => LINE_I18N[p]?.en || "").filter(Boolean).join(" ");
  const jp = parts.map((p) => LINE_I18N[p]?.jp || "").filter(Boolean).join(" ");
  return { kr, en, jp };
}

function convertGrammar(grammar, rawDialogue) {
  if (!grammar) return [];
  const arr = Array.isArray(grammar) ? grammar : grammar.points || [];
  const chunks = assignDialogueToGrammar(arr, rawDialogue);
  return arr.map((pt, i) => {
    const out = {
      pattern: pt.pattern,
      pinyin: pt.pinyin || "",
    };
    const expl = pt.explanation || pt.explain;
    if (expl && typeof expl === "object") {
      out.explanation = {
        kr: expl.kr || expl.zh || "",
        en: expl.en || expl.zh || "",
        jp: expl.jp || expl.en || expl.zh || "",
      };
    }
    const parts = chunks[i] && chunks[i].length ? chunks[i] : [rawDialogue[0]?.text].filter(Boolean);
    let text = parts.join("");
    const origEx = pt.example;
    const origText = (origEx && (origEx.text || origEx.zh)) || "";
    const origTr = origEx && origEx.translation;
    const pat = pt.pattern || "";
    if (pat.includes("我是") && !pat.includes("不是") && !text.includes("是") && origText.includes("是")) {
      text = origText;
      out.example = {
        text,
        pinyin: origEx.pinyin || linePinyin(text),
        translation: {
          kr: origTr?.kr || "",
          en: origTr?.en || "",
          jp: origTr?.jp || origTr?.en || "",
        },
      };
    } else {
      out.example = {
        text,
        pinyin: parts.map((p) => linePinyin(p)).join(" "),
        translation: mergeLineTranslations(parts),
      };
    }
    return out;
  });
}

function normalizeExtension(ext) {
  if (!Array.isArray(ext)) return [];
  return ext.map((item) => {
    const explain = item.explain && typeof item.explain === "object" ? item.explain : {};
    const zh0 = item.zh || item.phrase || "";
    return {
      zh: zh0,
      pinyin: item.pinyin,
      kr: item.kr || "",
      en: item.en || "",
      phrase: item.phrase || item.zh,
      explain: {
        kr: explain.kr || item.kr || "",
        en: explain.en || item.en || "",
        jp: explain.jp || explain.en || item.jp || "",
      },
    };
  });
}

function normalizeTitle(title) {
  if (!title || typeof title !== "object") return { zh: "", kr: "", jp: "", en: "" };
  return {
    zh: title.zh || "",
    kr: title.kr || "",
    jp: title.jp || "",
    en: title.en || "",
  };
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== "object") return { zh: "", kr: "", jp: "", en: "" };
  return {
    zh: summary.zh || "",
    kr: summary.kr || "",
    en: summary.en || "",
    jp: summary.jp || summary.en || "",
  };
}

function normalizeScene(scene, lessonNo) {
  if (!scene || typeof scene !== "object") {
    return { id: `l${lessonNo}_scene`, title: { zh: "", kr: "", en: "" }, summary: { zh: "", kr: "", en: "" } };
  }
  const title = scene.title || {};
  const summary = scene.summary || {};
  return {
    id: scene.id || `l${lessonNo}_scene`,
    title: { zh: title.zh || "", kr: title.kr || "", en: title.en || "" },
    summary: { zh: summary.zh || "", kr: summary.kr || "", en: summary.en || "" },
  };
}

function normalizeObjectives(ob) {
  if (!Array.isArray(ob)) return [];
  return ob.map((o) => ({
    zh: o.zh || "",
    kr: o.kr || "",
    en: o.en || "",
  }));
}

function buildEnrichedDialogue(rawDialogue) {
  return (rawDialogue || []).map((ln) => {
    const text = ln.text || "";
    const tr = LINE_I18N[text];
    if (!tr) throw new Error(`Missing LINE_I18N for: ${text}`);
    return {
      speaker: ln.speaker || "A",
      text,
      pinyin: linePinyin(text),
      translation: { kr: tr.kr, en: tr.en, jp: tr.jp },
    };
  });
}

function buildAI(lines, vocabTexts) {
  const texts = lines.map((l) => l.text);
  const join2 = texts.slice(0, 2).join(" ");
  return [
    {
      mode: "explain",
      title: { cn: "句子讲解", kr: "문장 설명", en: "Sentence Explanation", jp: "文の説明" },
      target: join2 || texts[0] || "",
      hint: {
        cn: "请结合本课对话解释句子意思。",
        kr: "이번 과 대화와 함께 문장 뜻을 설명해 보세요.",
        en: "Explain the sentence using this lesson’s dialogue.",
        jp: "この課の会話を踏まえて文の意味を説明してください。",
      },
    },
    {
      mode: "roleplay",
      title: { cn: "情景对话", kr: "상황 대화", en: "Roleplay", jp: "ロールプレイ" },
      scenario: "lesson_dialogue",
      prompt: {
        cn: "请用本课对话中的句子进行角色扮演。",
        kr: "이번 과 대화 문장으로 역할극을 해 보세요.",
        en: "Roleplay using sentences from this lesson’s dialogue.",
        jp: "この課の会話の文でロールプレイをしましょう。",
      },
    },
    {
      mode: "shadowing",
      title: { cn: "跟读练习", kr: "따라 읽기", en: "Shadowing", jp: "シャドーイング" },
      lines: texts,
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
  ];
}

function normalizeLesson(raw, lessonNo, stepsTemplate) {
  const enrichedDialogue = buildEnrichedDialogue(raw.dialogue);
  const vocabTexts = uniqDialogueTexts(raw.dialogue);
  const vocab = buildVocabEntries(vocabTexts);
  const practice = buildPractice(vocabTexts, raw.dialogue || []);

  return {
    id: `hsk1_lesson${lessonNo}`,
    courseId: raw.courseId || "hsk2.0_hsk1",
    level: raw.level || "HSK1",
    version: raw.version || "2.0",
    lessonNo,
    type: raw.type || "lesson",
    title: normalizeTitle(raw.title),
    summary: normalizeSummary(raw.summary),
    scene: normalizeScene(raw.scene, lessonNo),
    objectives: normalizeObjectives(raw.objectives),
    vocab,
    dialogue: enrichedDialogue,
    dialogueCards: [],
    grammar: convertGrammar(raw.grammar, raw.dialogue),
    extension: normalizeExtension(raw.extension),
    practice,
    review: {},
    ai: buildAI(enrichedDialogue, vocabTexts),
    aiPractice: {
      speaking: vocabTexts.slice(0, Math.min(5, vocabTexts.length)),
      chatPrompt: "请用本课对话中的句子与同伴练习问答。",
    },
    steps: stepsTemplate,
  };
}

const lesson1 = JSON.parse(fs.readFileSync(L1_PATH, "utf8"));
const stepsTemplate = lesson1.steps;

for (let n = 2; n <= 20; n++) {
  const p = path.join(DIR, `lesson${n}.json`);
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  delete raw.originalDialogues;
  const out = normalizeLesson(raw, n, stepsTemplate);
  fs.writeFileSync(p, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("wrote lesson", n);
}

console.log("done");
