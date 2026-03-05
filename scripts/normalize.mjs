/**
 * Schema 统一、去重、key 规则、统计校验
 * 输出: { id, hanzi, pinyin, meaning:{zh,en,ko}, tags, meta }
 */
import { ensurePinyin } from "./pinyin.mjs";

function safe(v) {
  return String(v ?? "").trim();
}

function pickFirst(...vals) {
  for (const v of vals) {
    const s = safe(v);
    if (s) return s;
  }
  return "";
}

/** 统一 meaning 字段：兼容 word/cn/kr/ko/meaning.zh 等 */
function normalizeMeaning(raw, hanzi) {
  const m = raw?.meaning ?? raw;
  const obj = typeof m === "object" ? m : {};
  return {
    zh: pickFirst(obj.zh, obj.cn, raw?.zh, raw?.cn, hanzi),
    en: pickFirst(obj.en, obj.english, raw?.en, raw?.english),
    ko: pickFirst(obj.ko, obj.kr, raw?.ko, raw?.kr),
  };
}

/**
 * 将原始词条规范化为目标 schema
 * @param {object} raw - 原始词条
 * @param {string} version - hsk2.0 | hsk3.0
 * @param {string} level - hsk1..hsk6 | hsk7-9
 * @param {number} index - 序号（用于 id）
 * @returns {object|null} 规范化词条，hanzi 为空时返回 null
 */
export function normalizeEntry(raw, version, level, index) {
  const hanzi = pickFirst(
    raw?.hanzi,
    raw?.word,
    raw?.simplified,
    raw?.zh,
    raw?.cn,
    raw?.text
  );
  if (!hanzi) return null;

  const existingPinyin = pickFirst(raw?.pinyin, raw?.py, raw?.pronunciation);
  const pinyin = ensurePinyin(hanzi, existingPinyin);

  const meaning = normalizeMeaning(raw, hanzi);

  const id = `${version}:${level}:${String(index + 1).padStart(4, "0")}`;

  const tags = { generated: !!(raw?.tags?.generated || (!existingPinyin && pinyin)) };

  return {
    id,
    hanzi,
    pinyin,
    meaning: { zh: meaning.zh, en: meaning.en, ko: meaning.ko },
    tags,
    meta: { level, version },
  };
}

/**
 * 去重：同一文件内 hanzi 重复 -> 只保留第一条
 * @returns {{ entries: object[], duplicates: string[] }}
 */
export function dedupeByHanzi(entries) {
  const seen = new Set();
  const duplicates = [];
  const filtered = [];
  for (const e of entries) {
    const h = e?.hanzi ?? "";
    if (!h) continue;
    if (seen.has(h)) {
      duplicates.push(h);
      continue;
    }
    seen.add(h);
    filtered.push(e);
  }
  return { entries: filtered, duplicates };
}

/**
 * 统计缺字段数量
 */
export function countMissing(entries) {
  let missingPinyin = 0;
  let missingZh = 0;
  let missingEn = 0;
  let missingKo = 0;
  for (const e of entries) {
    if (!safe(e?.pinyin)) missingPinyin++;
    if (!safe(e?.meaning?.zh)) missingZh++;
    if (!safe(e?.meaning?.en)) missingEn++;
    if (!safe(e?.meaning?.ko)) missingKo++;
  }
  return { missingPinyin, missingZh, missingEn, missingKo };
}
