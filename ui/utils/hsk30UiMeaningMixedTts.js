/**
 * HSK3.0·HSK1：系统语言释义中夹杂汉字/拼音时的 TTS 分段与拼音→汉字映射（与练习选项逻辑共用）
 */
import { resolvePinyin } from "./pinyinEngine.js";

function trimStr(v) {
  return String(v ?? "").trim();
}

/** 无声调、去空格：与课内 resolvePinyin 结果及选项拼音对齐 */
export function normalizePinyinKeyForSpeakMatch(s) {
  if (!s || typeof s !== "string") return "";
  return String(s)
    .toLowerCase()
    .replace(/ü/g, "v")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

/** 从课时数据收集「拼音键 → 汉字」 */
export function collectLessonPinyinToHanziMap(lesson) {
  const map = new Map();
  if (!lesson || typeof lesson !== "object") return map;

  const add = (han, manualPy) => {
    const h = trimStr(han);
    if (!h || !/[\u4e00-\u9fff]/.test(h)) return;
    const plain = h.replace(/[\s\u3002\uFF01\uFF0C\uFF1F\uFF1A\uFF1B!?,。；：]+$/u, "");
    const py = trimStr(manualPy) || resolvePinyin(plain, "");
    const key = normalizePinyinKeyForSpeakMatch(py);
    if (key && plain) map.set(key, plain);
  };

  const walkVocab = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const w of arr) {
      if (!w || typeof w !== "object") continue;
      add(w.hanzi || w.word || w.zh || w.cn, w.pinyin || w.py);
    }
  };

  walkVocab(lesson.vocab);
  walkVocab(lesson.words);
  walkVocab(lesson.coreWords);
  walkVocab(lesson.distributedWords);
  walkVocab(lesson.extraWords);

  const dialogueCards = Array.isArray(lesson.dialogueCards) ? lesson.dialogueCards : [];
  for (const card of dialogueCards) {
    const lines = Array.isArray(card?.lines) ? card.lines : [];
    for (const line of lines) {
      if (!line || typeof line !== "object") continue;
      add(line.text || line.zh || line.cn, line.pinyin || line.py);
    }
  }

  const dialogues = Array.isArray(lesson.dialogue) ? lesson.dialogue : [];
  for (const line of dialogues) {
    if (!line || typeof line !== "object") continue;
    add(line.text || line.zh, line.pinyin || line.py);
  }

  const ext = Array.isArray(lesson.extension) ? lesson.extension : [];
  for (const item of ext) {
    if (!item || typeof item !== "object") continue;
    add(item.phrase || item.hanzi || item.zh || item.cn, item.pinyin || item.py);
    add(item.example || item.exampleZh, item.examplePinyin || item.examplePy);
  }

  const grammar = Array.isArray(lesson.grammar) ? lesson.grammar : [];
  for (const g of grammar) {
    if (!g || typeof g !== "object") continue;
    add(g.pattern || (typeof g.title === "object" ? g.title.zh || g.title.cn : g.title), g.pinyin || g.py);
    const exs = Array.isArray(g.examples) ? g.examples : g.example ? [g.example] : [];
    for (const e of exs) {
      if (!e || typeof e !== "object") continue;
      add(e.zh || e.cn || e.line || e.text, e.pinyin || e.py);
    }
  }

  const practice = Array.isArray(lesson.practice) ? lesson.practice : [];
  for (const pq of practice) {
    const opts = Array.isArray(pq?.options) ? pq.options : [];
    for (const o of opts) {
      if (typeof o === "string") {
        if (/[\u4e00-\u9fff]/.test(o)) add(o, "");
      } else if (o && typeof o === "object") {
        const z = o.zh || o.cn;
        if (z && /[\u4e00-\u9fff]/.test(z)) add(z, o.pinyin || o.py);
        const hz = trimStr(o.speakZh || o.hanzi || o.ttsZh);
        if (hz && /[\u4e00-\u9fff]/.test(hz)) add(hz, o.pinyin || o.py);
      }
    }
  }

  const speaking = lesson.aiPractice && Array.isArray(lesson.aiPractice.speaking) ? lesson.aiPractice.speaking : [];
  for (const s of speaking) {
    if (typeof s === "string" && /[\u4e00-\u9fff]/.test(s)) add(s, "");
  }

  return map;
}

/** 题面/释义中的拼音串 → 中文 TTS 用字 */
export function resolvePinyinDisplayToSpeakZh(rawDisplay, optionObj, map) {
  const raw = trimStr(rawDisplay);
  if (!raw) return raw;
  if (optionObj && typeof optionObj === "object") {
    const explicit = trimStr(optionObj.speakZh || optionObj.hanzi || optionObj.ttsZh || optionObj.wordZh);
    if (explicit && /[\u4e00-\u9fff]/.test(explicit)) return explicit;
  }
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  if (!map || map.size === 0) return raw;
  const key = normalizePinyinKeyForSpeakMatch(raw);
  if (!key || key.length < 2) return raw;
  if (map.has(key)) return map.get(key);
  return raw;
}

/**
 * 将系统语言释义拆成：外语说明 / 汉字 / 拉丁拼音块
 * 拼音块不含数字（避免误吞 HSK3、L2 等）
 */
export function tokenizeMixedUiMeaning(text) {
  const s = String(text ?? "");
  const out = [];
  let i = 0;
  let buf = "";

  function flush() {
    if (buf) {
      out.push({ kind: "ui", text: buf });
      buf = "";
    }
  }

  while (i < s.length) {
    const ch = s[i];
    if (/[\u4e00-\u9fff]/.test(ch)) {
      flush();
      let j = i;
      while (j < s.length && /[\u4e00-\u9fff]/.test(s[j])) j++;
      out.push({ kind: "zh", text: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s\-'’]/.test(s[j])) j++;
      let slice = s.slice(i, j);
      if (/\d/.test(slice)) {
        buf += ch;
        i++;
        continue;
      }
      slice = slice.trim();
      const key = normalizePinyinKeyForSpeakMatch(slice);
      if (key.length >= 2) {
        flush();
        out.push({ kind: "py", text: slice });
        i = j;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return out.filter((x) => trimStr(x.text));
}
