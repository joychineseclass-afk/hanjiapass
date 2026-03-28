/**
 * Normalize hsk1 lesson1–lesson20 to a unified schema + Lumina Practice Variety v1 (static 5-slot mix).
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

const LETTERS = ["A", "B", "C", "D"];

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

/** text -> {kr,en,jp} for dialogue lines (LINE_I18N or raw translation) */
function buildTranslationMap(rawDialogue) {
  const m = new Map();
  for (const ln of rawDialogue || []) {
    const t = ln.text || "";
    if (!t || m.has(t)) continue;
    const tr = LINE_I18N[t] || ln.translation;
    if (tr && (tr.kr || tr.en || tr.jp)) {
      m.set(t, { kr: tr.kr || "", en: tr.en || "", jp: tr.jp || "" });
    }
  }
  return m;
}

function resolveMeaning(zh, transMap) {
  if (LINE_I18N[zh]) return LINE_I18N[zh];
  return transMap.get(zh) || { kr: "", en: "", jp: "" };
}

/** Neighbour lesson dialogue lines (n±1) for themed distractors */
function buildNeighborLineSet(lessonNo, rawByLesson) {
  const set = new Set();
  for (const m of [lessonNo - 1, lessonNo + 1]) {
    if (m < 1 || m > 20) continue;
    const raw = rawByLesson[m];
    if (!raw) continue;
    for (const t of uniqDialogueTexts(raw.dialogue || [])) set.add(t);
  }
  return set;
}

function stripForPinyin(s) {
  return String(s || "").replace(/[。！？，、\s]/g, "").trim();
}

/** 干扰项顺序：本课 → 邻课 → 其余（各组内按拼音序） */
function sortDistractorZh(list, V, neighborArr) {
  const inV = list.filter((z) => V.includes(z));
  const inN = list.filter((z) => !V.includes(z) && neighborArr.includes(z));
  const tail = list.filter((z) => !V.includes(z) && !neighborArr.includes(z));
  const cmp = (a, b) => a.localeCompare(b, "zh-Hans-CN");
  return [...inV.sort(cmp), ...inN.sort(cmp), ...tail.sort(cmp)];
}

function buildVocabEntries(texts, transMap) {
  return texts.map((hanzi) => {
    const tr = resolveMeaning(hanzi, transMap);
    const core = stripForPinyin(hanzi);
    return {
      hanzi,
      pinyin: core ? vocabPinyin(core) : vocabPinyin(hanzi),
      meaning: {
        zh: hanzi,
        kr: tr.kr || "",
        jp: tr.jp || "",
        en: tr.en || "",
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

function pickNotInDialogueLine(vocabTexts, exclude = new Set(), neighborLines = new Set()) {
  const inLesson = new Set(vocabTexts || []);
  const ordered = [];
  for (const t of neighborLines) {
    if (!t || t.length < 2 || inLesson.has(t) || exclude.has(t)) continue;
    if (!LINE_I18N[t]) continue;
    ordered.push(t);
  }
  for (const t of Object.keys(LINE_I18N)) {
    if (inLesson.has(t) || exclude.has(t) || t.length < 2) continue;
    if (!ordered.includes(t)) ordered.push(t);
  }
  return ordered[0] || "今天我不去学校。";
}

/** 问句：含「？/吗」等；选项里仅允许一个非问句作为正确答案 */
function isQuestionSentence(t) {
  const s = String(t || "").trim();
  if (!s) return false;
  if (s.includes("？") || s.includes("?")) return true;
  if (s.includes("吗")) return true;
  return false;
}

/**
 * p3：哪一句不是问句？保证四个选项里恰有一句为陈述/非问句。
 * @returns {{ options: string[], answer: string }}
 */
function buildNotQuestionChoice(vocabTexts) {
  const V = [...new Set((vocabTexts || []).filter(Boolean))];
  const inLesson = new Set(V);
  const lessonQuestions = V.filter(isQuestionSentence);
  const lessonStatements = V.filter((t) => !isQuestionSentence(t));

  const poolQuestionDistractors = [];
  const pushUniqueQ = (line) => {
    if (!line || poolQuestionDistractors.includes(line)) return;
    if (isQuestionSentence(line)) poolQuestionDistractors.push(line);
  };
  for (const t of lessonQuestions) pushUniqueQ(t);
  if (poolQuestionDistractors.length < 3) {
    for (const key of Object.keys(LINE_I18N)) {
      if (inLesson.has(key)) continue;
      pushUniqueQ(key);
      if (poolQuestionDistractors.length >= 3) break;
    }
  }

  let answer;
  if (lessonStatements.length >= 1) {
    answer = lessonStatements[0];
  } else {
    answer =
      Object.keys(LINE_I18N).find((t) => !inLesson.has(t) && !isQuestionSentence(t)) || "谢谢。";
  }

  const distractors = poolQuestionDistractors.filter((t) => t !== answer).slice(0, 3);
  while (distractors.length < 3) {
    const filler =
      Object.keys(LINE_I18N).find(
        (t) => t !== answer && isQuestionSentence(t) && !distractors.includes(t),
      ) || "你好吗？";
    if (!distractors.includes(filler)) distractors.push(filler);
  }

  const set = new Set([answer, ...distractors.slice(0, 3)]);
  while (set.size < 4) set.add(answer);
  const options = [...set].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  return { options, answer };
}

function buildDialogueNotAppearedOptions(vocabTexts, distractor) {
  const lessonLines = [...new Set((vocabTexts || []).filter(Boolean))].filter((t) => t !== distractor);
  const appeared = lessonLines.slice(0, 3);
  const set = new Set([...appeared, distractor]);
  return [...set].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function pickPinyinTargets(V) {
  return V.filter((t) => {
    const c = stripForPinyin(t);
    return c.length >= 2 && c.length <= 16;
  });
}

function buildSlot1ZhToMeaning(V, neighborArr, lessonNo, transMap) {
  const target = V[(lessonNo - 1) % V.length] || V[0];
  const pool = [];
  const seenZh = new Set();
  const pushRow = (zh) => {
    if (!zh || seenZh.has(zh)) return;
    const m = resolveMeaning(zh, transMap);
    if (!m.kr && !m.en) return;
    seenZh.add(zh);
    pool.push({ zh, m });
  };
  pushRow(target);
  for (const z of V) pushRow(z);
  for (const z of neighborArr) pushRow(z);
  for (const z of Object.keys(LINE_I18N)) pushRow(z);
  const uniqRows = [];
  const used = new Set();
  for (const row of pool) {
    if (used.has(row.zh)) continue;
    used.add(row.zh);
    uniqRows.push(row);
    if (uniqRows.length >= 4) break;
  }
  while (uniqRows.length < 4) {
    const z = Object.keys(LINE_I18N).find((k) => !used.has(k));
    if (!z) break;
    const m = resolveMeaning(z, transMap);
    if (!m.kr && !m.en) {
      used.add(z);
      uniqRows.push({ zh: z, m: { kr: z, en: z, jp: z } });
    } else {
      used.add(z);
      uniqRows.push({ zh: z, m });
    }
  }
  const sorted = uniqRows.sort((a, b) => (a.m.kr || a.m.en).localeCompare(b.m.kr || b.m.en, "ko"));
  const options = sorted.map((row, i) => ({
    key: LETTERS[i],
    meaning: {
      kr: row.m.kr || row.m.en,
      en: row.m.en || row.m.kr,
      jp: row.m.jp || "",
      zh: row.zh,
      cn: row.zh,
    },
  }));
  const answer = options.find((o) => (o.meaning.zh || o.meaning.cn) === target)?.key || "A";
  const rm = resolveMeaning(target, transMap);
  return {
    id: "p1",
    type: "choice",
    subtype: "vocab_meaning_choice",
    prompt: {
      cn: `「${target}」的意思是？`,
      kr: `「${target}」의 뜻은?`,
      en: `What does "${target}" mean?`,
      jp: `「${target}」の意味は？`,
    },
    options,
    answer,
    explanation: {
      cn: `「${target}」：${rm.en || rm.jp || "见本课对话翻译"}`,
      kr: `「${target}」는 ${rm.kr || rm.en || ""}입니다.`,
      en: `"${target}" means ${rm.en || rm.kr || ""}.`,
      jp: `「${target}」は ${rm.jp || rm.en || ""} です。`,
    },
  };
}

function buildSlot1MeaningToZh(V, neighborArr, lessonNo, transMap) {
  const target = V[lessonNo % V.length] || V[0];
  const optsZh = [];
  const seen = new Set();
  const pushZ = (z) => {
    if (!z || seen.has(z)) return;
    seen.add(z);
    optsZh.push(z);
  };
  pushZ(target);
  for (const z of V) pushZ(z);
  for (const z of neighborArr) pushZ(z);
  for (const z of Object.keys(LINE_I18N)) pushZ(z);
  const uniqZh = [...new Set(optsZh)];
  const rest = sortDistractorZh(
    uniqZh.filter((z) => z !== target),
    V,
    neighborArr,
  );
  const core = [target, ...rest.slice(0, 3)];
  while (core.length < 4) {
    const z = Object.keys(LINE_I18N).find((k) => !core.includes(k));
    if (!z) break;
    core.push(z);
  }
  const sortedZh = [...new Set(core)].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).slice(0, 4);
  const options = sortedZh.map((zh, i) => ({
    key: LETTERS[i],
    zh,
    cn: zh,
  }));
  const answer = options.find((o) => o.zh === target)?.key || "A";
  const rm = resolveMeaning(target, transMap);
  const hint = rm.kr || rm.en || rm.jp || target;
  return {
    id: "p1",
    type: "choice",
    subtype: "meaning_to_vocab_choice",
    prompt: {
      cn: `「${hint}」用中文怎么说？`,
      kr: `'${hint}'에 해당하는 중국어는?`,
      en: `What is the Chinese for "${hint}"?`,
      jp: `「${hint}」に対応する中国語は？`,
    },
    options,
    answer,
    explanation: {
      cn: `「${hint}」：${target}`,
      kr: `「${hint}」: ${target}`,
      en: `"${hint}" → ${target}.`,
      jp: `「${hint}」→ ${target}`,
    },
  };
}

function buildSlot2PinyinToZh(V, neighborArr, lessonNo, transMap) {
  const cand = pickPinyinTargets(V);
  const target = cand[(lessonNo - 1) % cand.length] || V[0];
  const py = vocabPinyin(stripForPinyin(target));
  const optsZh = [];
  const seen = new Set();
  const pushZ = (z) => {
    if (!z || seen.has(z)) return;
    seen.add(z);
    optsZh.push(z);
  };
  pushZ(target);
  for (const z of V) pushZ(z);
  for (const z of neighborArr) pushZ(z);
  for (const z of Object.keys(LINE_I18N)) pushZ(z);
  const uniqZh2 = [...new Set(optsZh)];
  const rest2 = sortDistractorZh(uniqZh2.filter((z) => z !== target), V, neighborArr);
  const core2 = [target, ...rest2.slice(0, 3)];
  while (core2.length < 4) {
    const z = Object.keys(LINE_I18N).find((k) => !core2.includes(k));
    if (!z) break;
    core2.push(z);
  }
  const sortedZh2 = [...new Set(core2)].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).slice(0, 4);
  const options = sortedZh2.map((zh, i) => ({
    key: LETTERS[i],
    zh,
    cn: zh,
  }));
  const answer = options.find((o) => o.zh === target)?.key || "A";
  return {
    id: "p2",
    type: "choice",
    subtype: "pinyin_to_vocab_choice",
    prompt: {
      cn: `根据拼音「${py}」选择正确的词语。`,
      kr: `'${py}'의 한자는?`,
      en: `Choose the Chinese that matches pinyin "${py}".`,
      jp: `ピンイン「${py}」に合う語を選んでください。`,
    },
    options,
    answer,
    explanation: {
      cn: `「${py}」：${target}`,
      kr: `「${py}」: ${target}`,
      en: `"${py}" is ${target}.`,
      jp: `「${py}」→ ${target}`,
    },
  };
}

function buildSlot2ZhToPinyin(V, lessonNo, transMap) {
  const cand = pickPinyinTargets(V);
  const target = cand[lessonNo % Math.max(cand.length, 1)] || V[0];
  const correctPy = vocabPinyin(stripForPinyin(target));
  const pyList = [];
  const seenPy = new Set([correctPy]);
  const pushPy = (z) => {
    if (!z || z === target) return;
    const p = vocabPinyin(stripForPinyin(z));
    if (!p || seenPy.has(p)) return;
    seenPy.add(p);
    pyList.push(p);
  };
  for (const z of V) pushPy(z);
  for (const z of Object.keys(LINE_I18N)) pushPy(z);
  const FALLBACK_PY = ["nǐ hǎo", "xiè xie", "zài jiàn", "bú kè qi", "wǒ shì", "hěn hǎo"];
  for (const p of FALLBACK_PY) {
    if (pyList.length >= 3) break;
    if (!seenPy.has(p)) {
      seenPy.add(p);
      pyList.push(p);
    }
  }
  const finalFour = [correctPy, ...pyList].slice(0, 4);
  const options = finalFour.map((p, i) => ({
    key: LETTERS[i],
    zh: p,
    cn: p,
    kr: p,
    en: p,
    jp: p,
  }));
  const answer = options.find((o) => o.zh === correctPy)?.key || "A";
  return {
    id: "p2",
    type: "choice",
    subtype: "zh_to_pinyin_choice",
    prompt: {
      cn: `「${target}」的拼音是？`,
      kr: `「${target}」의 병음은?`,
      en: `What is the pinyin of "${target}"?`,
      jp: `「${target}」のピンインは？`,
    },
    options,
    answer,
    explanation: {
      cn: `「${target}」：${correctPy}`,
      kr: `「${target}」: ${correctPy}`,
      en: `"${target}" → ${correctPy}.`,
      jp: `「${target}」→ ${correctPy}`,
    },
  };
}

/**
 * 第二组对话应答（与 p3 不同行），避免「本课正确句子」类无唯一解题型。
 */
function pickSecondDialogueExchange(d, V, t0, t1) {
  const lines = (d || []).map((x) => x?.text).filter(Boolean);
  const tryPair = (i, j) => {
    const a = lines[i];
    const b = lines[j];
    if (!a || !b) return null;
    if (a === t0 && b === t1) return null;
    return { t2: a, t3: b };
  };
  let pair = tryPair(2, 3) || tryPair(4, 5) || tryPair(1, 2);
  if (pair) return pair;
  const u = [...new Set(V)];
  if (u.length >= 4) return { t2: u[2], t3: u[3] };
  if (u.length >= 2) return { t2: u[u.length - 2], t3: u[u.length - 1] };
  return { t2: u[0] || t0, t3: u[1] || u[0] || t1 };
}

/**
 * Lumina static mix v1 — fixed slots p1–p5 (single-choice only).
 * p4: dialogue_response（第二组对白），不再使用 sentence_blank 挖空/整句四选一。
 */
function buildPractice(vocabTexts, lines, lessonNo, neighborLines, transMap) {
  const V = vocabTexts;
  const d = lines;
  const neighborArr = [...neighborLines];

  const slot1 = lessonNo % 2 === 0 ? buildSlot1ZhToMeaning(V, neighborArr, lessonNo, transMap) : buildSlot1MeaningToZh(V, neighborArr, lessonNo, transMap);

  const slot2 = lessonNo % 2 === 0 ? buildSlot2PinyinToZh(V, neighborArr, lessonNo, transMap) : buildSlot2ZhToPinyin(V, lessonNo, transMap);

  const t0 = d[0]?.text || V[0];
  const t1 = d[1]?.text || V[1];
  const slot3 = {
    id: "p3",
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
  };

  const neighborSet = new Set(neighborArr);
  const usedExclusionDistractors = new Set();
  const { t2, t3 } = pickSecondDialogueExchange(d, V, t0, t1);
  let slot4;
  if (t2 === t0 && t3 === t1) {
    const distractorP4 = pickNotInDialogueLine(V, usedExclusionDistractors, neighborSet);
    usedExclusionDistractors.add(distractorP4);
    slot4 = {
      id: "p4",
      type: "choice",
      subtype: "sentence_blank",
      prompt: {
        cn: "下面哪一句没有出现在本课对话里？",
        kr: "다음 중 이번 과 대화에 나오지 않는 문장은 무엇입니까?",
        en: "Which sentence did NOT appear in this lesson dialogue?",
        jp: "次のうち、この課の会話に出てこない文はどれですか？",
      },
      options: buildDialogueNotAppearedOptions(V, distractorP4),
      answer: distractorP4,
      explanation: {
        cn: "正确答案是未在本课对话中出现的句子。",
        kr: "정답은 이번 과 대화에 나오지 않은 문장입니다.",
        en: "The correct answer is the sentence that does not appear in this lesson dialogue.",
        jp: "正解は、この課の会話に出てこない文です。",
      },
    };
  } else {
    slot4 = {
      id: "p4",
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
    };
  }

  let slot5;
  if (lessonNo % 2 === 0) {
    const nq = buildNotQuestionChoice(V);
    slot5 = {
      id: "p5",
      type: "choice",
      subtype: "zh_to_meaning",
      prompt: {
        cn: "下面哪一句不是问句？",
        kr: "아래 중 질문 문장이 아닌 것은?",
        en: "Which line below is NOT a question?",
        jp: "次のうち、疑問文ではないのはどれですか？",
      },
      options: nq.options,
      answer: nq.answer,
      explanation: {
        cn: "问句常带「吗」或「？」；其余为陈述或应答。",
        kr: "의문문은 「吗」나 「？」가 붙는 경우가 많고, 나머지는 평서/응답입니다.",
        en: "Questions often use 吗 or 「？」; the others are statements or replies.",
        jp: "疑問文は「吗」や「？」を伴うことが多く、他は平叙文や応答です。",
      },
    };
  } else {
    const distractor = pickNotInDialogueLine(V, usedExclusionDistractors, neighborSet);
    slot5 = {
      id: "p5",
      type: "choice",
      subtype: "sentence_blank",
      prompt: {
        cn: "下面哪一句没有出现在本课对话里？",
        kr: "다음 중 이번 과 대화에 나오지 않는 문장은 무엇입니까?",
        en: "Which sentence did NOT appear in this lesson dialogue?",
        jp: "次のうち、この課の会話に出てこない文はどれですか？",
      },
      options: buildDialogueNotAppearedOptions(V, distractor),
      answer: distractor,
      explanation: {
        cn: "正确答案是未在本课对话中出现的句子。",
        kr: "정답은 이번 과 대화에 나오지 않은 문장입니다.",
        en: "The correct answer is the sentence that does not appear in this lesson dialogue.",
        jp: "正解は、この課の会話に出てこない文です。",
      },
    };
  }

  return [slot1, slot2, slot3, slot4, slot5];
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
    const tr = LINE_I18N[text] || ln.translation;
    if (!tr || (!tr.kr && !tr.en && !tr.jp)) {
      throw new Error(`Missing translation for dialogue line: ${text}`);
    }
    return {
      speaker: ln.speaker || "A",
      text,
      pinyin: ln.pinyin || linePinyin(text),
      translation: { kr: tr.kr || "", en: tr.en || "", jp: tr.jp || tr.en || "" },
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

function normalizeLesson(raw, lessonNo, stepsTemplate, neighborLines, rawDialogueForTrans) {
  const dialogueSrc = rawDialogueForTrans || raw.dialogue;
  const transMap = buildTranslationMap(dialogueSrc);
  const enrichedDialogue = buildEnrichedDialogue(raw.dialogue);
  const vocabTexts = uniqDialogueTexts(raw.dialogue);
  const vocab = buildVocabEntries(vocabTexts, transMap);
  const practice = buildPractice(vocabTexts, raw.dialogue || [], lessonNo, neighborLines, transMap);

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

const rawByLesson = {};
for (let n = 1; n <= 20; n++) {
  const p = path.join(DIR, `lesson${n}.json`);
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  delete raw.originalDialogues;
  rawByLesson[n] = raw;
}

const stepsTemplate = rawByLesson[1].steps;

for (let n = 1; n <= 20; n++) {
  const raw = rawByLesson[n];
  const neighborLines = buildNeighborLineSet(n, rawByLesson);
  const p = path.join(DIR, `lesson${n}.json`);
  const out = normalizeLesson(raw, n, stepsTemplate, neighborLines, raw.dialogue);
  fs.writeFileSync(p, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("wrote lesson", n);
}

console.log("done");
