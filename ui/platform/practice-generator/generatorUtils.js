/**
 * Practice Generator v2 - 通用工具
 * 题型蓝图表：统一问法、选项逻辑、标准输出
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const LETTERS = ["A", "B", "C", "D"];

/** 按语言取文本 */
export function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = String(lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.en);
  if (l === "ko" || l === "kr") return str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.zh ?? obj.cn);
  return str(obj.en) || str(obj.kr ?? obj.ko) || str(obj.zh ?? obj.cn);
}

/** 解析 lesson 的 level 数字 */
export function parseLevelNum(level) {
  return parseInt(String(level || "").replace(/\D/g, ""), 10) || 1;
}

/** 从 vocab 项取 zh（兼容 hanzi / zh / word） */
export function getVocabZh(w) {
  return str(w?.hanzi ?? w?.zh ?? w?.word ?? w?.cn ?? "");
}

/** 从 vocab 项取 pinyin */
export function getVocabPinyin(w) {
  return str(w?.pinyin ?? w?.py ?? "");
}

/** 从 vocab 项取 meaning（多语言） */
export function getVocabMeaning(w, lang) {
  const m = w?.meaning;
  if (!m || typeof m !== "object") return str(w?.hanzi ?? w?.word) || "";
  return pickLang(m, lang);
}

/** 从 vocab 项取完整 meaning 对象 { zh, kr, en } */
export function getVocabMeaningObj(w) {
  const m = w?.meaning;
  if (!m || typeof m !== "object") return { zh: "", kr: "", en: "" };
  return {
    zh: str(m.zh ?? m.cn ?? ""),
    kr: str(m.kr ?? m.ko ?? ""),
    en: str(m.en ?? ""),
  };
}

/** 从 extension 项取 zh（兼容对象 / 字符串） */
export function getExtensionZh(item) {
  if (typeof item === "string") return str(item);
  return str(item?.zh ?? item?.cn ?? item?.line ?? "");
}

/** 从 extension 项取 pinyin */
export function getExtensionPinyin(item) {
  if (typeof item === "string") return "";
  return str(item?.pinyin ?? item?.py ?? "");
}

/** 从 extension 项取 meaning */
export function getExtensionMeaning(item, lang) {
  if (typeof item === "string") return "";
  const m = item?.meaning;
  if (!m || typeof m !== "object") return str(item?.kr ?? item?.ko ?? item?.en ?? item?.zh ?? item?.cn ?? "");
  return pickLang(m, lang);
}

/** 从 extension 项取完整 meaning 对象 */
export function getExtensionMeaningObj(item) {
  if (typeof item === "string") return { zh: "", kr: "", en: "" };
  const m = item?.meaning;
  if (!m || typeof m !== "object") {
    return {
      zh: str(item?.zh ?? item?.cn ?? ""),
      kr: str(item?.kr ?? item?.ko ?? ""),
      en: str(item?.en ?? ""),
    };
  }
  return {
    zh: str(m.zh ?? m.cn ?? ""),
    kr: str(m.kr ?? m.ko ?? ""),
    en: str(m.en ?? ""),
  };
}

/** 从 dialogue line 取 zh */
export function getDialogueLineZh(line) {
  return str(line?.zh ?? line?.cn ?? line?.line ?? "");
}

/** 从 dialogue line 取 translation（kr/en） */
export function getDialogueLineMeaning(line, lang) {
  const t = line?.translation ?? line;
  if (!t || typeof t !== "object") return str(line?.kr ?? line?.ko ?? line?.en ?? "");
  return pickLang(t, lang);
}

/** 从 grammar 取 example zh */
export function getGrammarExampleZh(g) {
  const ex = g?.example ?? g?.examples;
  if (!ex) return "";
  if (typeof ex === "string") return str(ex);
  return str(ex?.zh ?? ex?.cn ?? ex?.line ?? "");
}

/** 从 grammar 取 explanation（多语言） */
export function getGrammarExplanation(g, lang) {
  const l = String(lang || "zh").toLowerCase();
  const zh = str(g?.explanation_zh ?? g?.explanation?.zh ?? g?.zh);
  const kr = str(g?.explanation_kr ?? g?.explanation?.kr ?? g?.kr ?? g?.ko);
  const en = str(g?.explanation_en ?? g?.explanation?.en ?? g?.en);
  if (l === "zh" || l === "cn") return zh || kr || en;
  if (l === "ko" || l === "kr") return kr || en || zh;
  return en || kr || zh;
}

/** Fisher-Yates shuffle */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 生成唯一 id */
let _idCounter = 0;
export function nextId(prefix = "q") {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}

/**
 * 构建标准选项（key A/B/C/D），并返回正确答案字母
 * @param {Array} optionContents - [{ zh, pinyin?, kr?, en? }, ...]
 * @param {string|number} correctRef - 正确答案的 zh 或索引（0-based）
 * @returns {{ options: Array, answer: string }}
 */
export function buildOptionsWithLetterKeys(optionContents, correctRef) {
  const opts = Array.isArray(optionContents) ? optionContents : [];
  if (!opts.length) return { options: [], answer: "A" };

  const shuffled = shuffle(opts);
  const options = shuffled.slice(0, 4).map((o, i) => {
    const letter = LETTERS[i] ?? String(i + 1);
    const obj = o && typeof o === "object"
      ? {
          key: letter,
          zh: str(o.zh ?? o.cn ?? ""),
          pinyin: str(o.pinyin ?? o.py ?? ""),
          kr: str(o.kr ?? o.ko ?? ""),
          en: str(o.en ?? ""),
        }
      : { key: letter, zh: str(o), pinyin: "", kr: "", en: "" };
    return obj;
  });

  let answer = "A";
  const correctStr = typeof correctRef === "number" ? (shuffled[correctRef]?.zh ?? shuffled[correctRef]) : str(correctRef);
  const found = options.find((o) => o.zh === correctStr || str(o.kr) === correctStr || str(o.en) === correctStr);
  if (found) answer = found.key;

  return { options, answer };
}
