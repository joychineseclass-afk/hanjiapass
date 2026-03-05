#!/usr/bin/env node
/**
 * Normalize data/vocab/hsk3.0/hsk1.json to unified schema.
 * Run: node scripts/normalize-hsk3-vocab.js
 *
 * Fallback (no Node): powershell -File scripts/normalize-hsk3-vocab.ps1
 * Or: python scripts/normalize_hsk3_vocab.py
 *
 * Target schema per entry:
 *   id: number (1..N continuous)
 *   hanzi: string
 *   pinyin: string
 *   meaning: { ko?, en?, zh? }
 *   example?: { zh?, ko?, en? }
 *   tags?: { generated? }
 *   meta?: { lesson?, lesson_title? }  // migrated from top-level
 */

const fs = require("fs");
const path = require("path");

const VOCAB_PATH = path.join(__dirname, "../data/vocab/hsk3.0/hsk1.json");

function trim(s) {
  return String(s ?? "").trim();
}

function normalizeEntry(raw, index) {
  const hanzi = trim(raw.hanzi ?? raw.word ?? raw.zh ?? raw.cn ?? "");
  const pinyin = trim(raw.pinyin ?? raw.py ?? "");
  const rawMeaning = raw.meaning;

  let meaning = { ko: "", en: "", zh: "" };
  if (typeof rawMeaning === "string") {
    meaning.ko = trim(rawMeaning);
  } else if (rawMeaning && typeof rawMeaning === "object") {
    meaning.ko = trim(rawMeaning.ko ?? rawMeaning.kr);
    meaning.en = trim(rawMeaning.en);
    meaning.zh = trim(rawMeaning.zh ?? rawMeaning.cn);
    if (!meaning.zh && hanzi) meaning.zh = hanzi;
  }
  if (!meaning.zh && hanzi) meaning.zh = hanzi;

  // Remove empty keys
  const m = {};
  if (meaning.ko) m.ko = meaning.ko;
  if (meaning.en) m.en = meaning.en;
  if (meaning.zh) m.zh = meaning.zh;

  const rawEx = raw.example;
  let example;
  if (rawEx && typeof rawEx === "object") {
    const ez = trim(rawEx.zh ?? rawEx.cn);
    const ek = trim(rawEx.ko ?? rawEx.kr);
    const ee = trim(rawEx.en);
    if (ez || ek || ee) {
      example = {};
      if (ez) example.zh = ez;
      if (ek) example.ko = ek;
      if (ee) example.en = ee;
    }
  }

  let tags;
  if (raw.tags && typeof raw.tags === "object" && raw.tags.generated) {
    tags = { generated: true };
  }

  const meta =
    raw.lesson != null || raw.lesson_title
      ? {
          ...(raw.lesson != null && { lesson: Number(raw.lesson) }),
          ...(raw.lesson_title && { lesson_title: String(raw.lesson_title).trim() }),
        }
      : undefined;

  return {
    hanzi,
    pinyin,
    meaning: m,
    example: example || undefined,
    tags: tags || undefined,
    meta: meta && Object.keys(meta).length ? meta : undefined,
    _generated: !!(raw.tags && raw.tags.generated),
    _fieldCount: [meaning.ko, meaning.en, meaning.zh, pinyin].filter(Boolean).length,
  };
}

function run() {
  const raw = JSON.parse(fs.readFileSync(VOCAB_PATH, "utf8"));
  const arr = Array.isArray(raw) ? raw : [];

  const beforeCount = arr.length;

  const normalized = [];
  for (let i = 0; i < arr.length; i++) {
    const n = normalizeEntry(arr[i], i + 1);
    if (!n.hanzi) {
      normalized.push({ _discarded: true, _raw: arr[i] });
      continue;
    }
    normalized.push(n);
  }

  const discarded = normalized.filter((x) => x._discarded);
  const valid = normalized.filter((x) => !x._discarded);

  const byHanzi = new Map();
  for (const v of valid) {
    const key = v.hanzi;
    const existing = byHanzi.get(key);
    if (!existing) {
      byHanzi.set(key, v);
      continue;
    }
    const prefer = (a, b) => {
      if (!a._generated && b._generated) return a;
      if (a._generated && !b._generated) return b;
      return a._fieldCount >= b._fieldCount ? a : b;
    };
    byHanzi.set(key, prefer(existing, v));
  }

  const deduped = Array.from(byHanzi.values());
  const duplicateCount = valid.length - deduped.length;

  const result = deduped.map((v, i) => {
    const out = {
      id: i + 1,
      hanzi: v.hanzi,
      pinyin: v.pinyin,
      meaning: v.meaning,
    };
    if (v.example) out.example = v.example;
    if (v.tags) out.tags = v.tags;
    if (v.meta) out.meta = v.meta;
    return out;
  });

  let missingPinyin = 0;
  let missingKo = 0;
  let missingEn = 0;
  let missingZh = 0;
  for (const r of result) {
    if (!r.pinyin) missingPinyin++;
    if (!r.meaning.ko) missingKo++;
    if (!r.meaning.en) missingEn++;
    if (!r.meaning.zh) missingZh++;
  }

  fs.writeFileSync(VOCAB_PATH, JSON.stringify(result, null, 2), "utf8");

  const report = `
=== HSK 3.0 Vocab Normalization Report ===

Entries:  ${beforeCount} → ${result.length}
Discarded (no hanzi): ${discarded.length}
Duplicates removed:   ${duplicateCount}

Missing fields:
  pinyin:  ${missingPinyin}
  ko:      ${missingKo}
  en:      ${missingEn}
  zh:      ${missingZh}

lesson/lesson_title: migrated to meta (kept for reference)
`;
  console.log(report.trim());
  return { beforeCount, afterCount: result.length, discarded: discarded.length, duplicateCount, missingPinyin, missingKo, missingEn, missingZh };
}

run();
