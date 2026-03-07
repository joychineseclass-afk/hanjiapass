#!/usr/bin/env node
/**
 * 将 glossary 中的教学短释义/词性同步到 lesson1~lesson20 的 vocab
 * - 不覆盖已有非空字段
 * - 不修改 lesson21/lesson22（复习课）
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GLOSSARY_DIR = join(ROOT, "data", "glossary");
const LESSONS_DIR = join(ROOT, "data", "courses", "hsk2.0", "hsk1");

function loadGlossary(lang, scope) {
  const file = join(GLOSSARY_DIR, `${lang}-${scope}.json`);
  if (!existsSync(file)) return {};
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return typeof raw === "object" && raw !== null ? raw : {};
  } catch (e) {
    console.warn(`[sync] load glossary ${file} failed:`, e?.message);
    return {};
  }
}

function str(v) {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function syncVocabItem(item, krGloss, enGloss) {
  if (!item || typeof item !== "object") return item;
  const hanzi = str(item.hanzi ?? item.word ?? item.zh ?? "");
  if (!hanzi) return item;

  const kr = krGloss[hanzi];
  const en = enGloss[hanzi];

  const out = { ...item };

  // meaning
  const m = out.meaning;
  const meaningObj = typeof m === "object" && m !== null ? { ...m } : {};
  if (!str(meaningObj.kr) && !str(meaningObj.ko) && kr?.meaning) {
    meaningObj.kr = kr.meaning;
  }
  if (!str(meaningObj.en) && en?.meaning) {
    meaningObj.en = en.meaning;
  }
  out.meaning = meaningObj;

  // pos
  const p = out.pos;
  const posIsObj = typeof p === "object" && p !== null;
  const posObj = posIsObj ? { ...p } : (str(p) ? { zh: str(p) } : {});
  if (!str(posObj.kr) && !str(posObj.ko) && kr?.pos) {
    posObj.kr = kr.pos;
  }
  if (!str(posObj.en) && en?.pos) {
    posObj.en = en.pos;
  }
  out.pos = Object.keys(posObj).length ? posObj : (out.pos ?? undefined);

  return out;
}

function main() {
  const krGloss = loadGlossary("kr", "hsk1");
  const enGloss = loadGlossary("en", "hsk1");
  const krCount = Object.keys(krGloss).length;
  const enCount = Object.keys(enGloss).length;
  console.log(`[sync] loaded glossary: kr-hsk1 ${krCount} entries, en-hsk1 ${enCount} entries`);

  for (let i = 1; i <= 20; i++) {
    const file = join(LESSONS_DIR, `lesson${i}.json`);
    if (!existsSync(file)) {
      console.warn(`[sync] skip (not found): ${file}`);
      continue;
    }

    let raw;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      console.warn(`[sync] skip (parse error): ${file}`, e?.message);
      continue;
    }

    const vocab = raw?.vocab;
    if (!Array.isArray(vocab)) {
      console.log(`[sync] lesson${i}: no vocab array, skip`);
      continue;
    }

    const synced = vocab.map((v) => syncVocabItem(v, krGloss, enGloss));
    raw.vocab = synced;
    writeFileSync(file, JSON.stringify(raw, null, 2), "utf8");
    console.log(`[sync] lesson${i}.json: ${synced.length} vocab synced`);
  }

  console.log("[sync] done.");
}

main();
