#!/usr/bin/env node
/**
 * 生成 HSK 未分配词汇报告：data/pedagogy/hsk1-vocab-unmapped.json
 * 用法：node scripts/generate-vocab-unmapped.mjs [hsk1]
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function wordKey(w) {
  if (!w || typeof w !== "object") return "";
  return String(w.hanzi ?? w.word ?? w.zh ?? "").trim();
}

function findWordInVocabList(term, vocabList) {
  if (!term || typeof term !== "string") return null;
  const t = String(term).trim();
  if (!t) return null;
  const fields = ["zh", "word", "hanzi", "simplified", "text"];
  for (const w of vocabList) {
    if (!w || typeof w !== "object") continue;
    for (const f of fields) {
      const v = w[f];
      if (v != null && String(v).trim() === t) return w;
    }
  }
  return null;
}

function isReviewMapItem(mapItem) {
  return Array.isArray(mapItem?.reviewOf);
}

function auditVocabularyCoverage(vocabMap, vocabList) {
  const total = vocabList.length;
  const vocabKeys = new Set(vocabList.map((w) => wordKey(w)).filter(Boolean));
  const mappedInVocab = new Set();

  const keys = Object.keys(vocabMap).filter((k) => k !== "description" && k !== "version" && /^\d+$/.test(k));

  for (const key of keys) {
    const mapItem = vocabMap[key];
    if (isReviewMapItem(mapItem)) continue;

    const core = Array.isArray(mapItem?.core) ? mapItem.core : [];
    const extra = Array.isArray(mapItem?.extra) ? mapItem.extra : [];
    const terms = [...core, ...extra];
    for (const t of terms) {
      const w = findWordInVocabList(t, vocabList);
      if (w) mappedInVocab.add(wordKey(w));
    }
  }

  const unmappedTerms = [...vocabKeys].filter((k) => !mappedInVocab.has(k)).sort();
  return { total, mappedCount: mappedInVocab.size, unmappedCount: unmappedTerms.length, unmappedTerms };
}

const level = process.argv[2] || "hsk1";
const levelKey = level.startsWith("hsk") ? level : `hsk${level}`;

const vocabPath = join(ROOT, `data/vocab/hsk2.0/${levelKey.replace("hsk", "hsk")}.json`);
const mapPath = join(ROOT, `data/pedagogy/${levelKey}-vocab-map.json`);
const outPath = join(ROOT, `data/pedagogy/${levelKey}-vocab-unmapped.json`);

let vocabList = [];
let vocabMap = {};

try {
  vocabList = JSON.parse(readFileSync(vocabPath, "utf8"));
} catch (e) {
  console.error("Failed to read vocab:", vocabPath, e.message);
  process.exit(1);
}

try {
  vocabMap = JSON.parse(readFileSync(mapPath, "utf8"));
} catch (e) {
  console.warn("No vocab map at", mapPath, "- writing all as unmapped");
}

const { total, mappedCount, unmappedCount, unmappedTerms } = auditVocabularyCoverage(vocabMap, vocabList);

const output = {
  description: `${levelKey} 未分配词汇 — 尚未进入 core/extra 的词条`,
  version: "1.0",
  total,
  mappedCount,
  unmappedCount,
  unmappedTerms,
};

writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
console.log(`[VocabUnmapped] wrote ${outPath}`);
console.log(`[VocabUnmapped] total: ${total}, mapped: ${mappedCount}, unmapped: ${unmappedCount}`);
