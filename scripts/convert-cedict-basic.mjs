/**
 * CC-CEDICT 批量行 → words-cedict-001.json + cedict-basic-100.txt
 * 用法: node scripts/convert-cedict-basic.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { numberedPinyinToToneMarks } from "./convert-cedict-sample.mjs";
import { CEDICT_BASIC_100_ROWS } from "./cedict-basic-100-rows.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = join(ROOT, "data", "dictionary", "sources");
const TXT_OUT = join(SRC_DIR, "cedict-basic-100.txt");
const WORDS_FILE = join(ROOT, "data", "dictionary", "words-cedict-001.json");
const INDEX_FILE = join(ROOT, "data", "dictionary", "dictionary-index.json");
const CEDICT_WORDS = "words-cedict-001.json";
const CEDICT_SOURCE_PENDING = "CC-CEDICT";
const CEDICT_SOURCE_REVIEWED = "CC-CEDICT draft reviewed";

function isProtectedEntry(o) {
  if (!o || o.type !== "word") return false;
  if (o.needsReview === false) return true;
  return String(o.source || "").includes("reviewed");
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function rowToLine(row) {
  const [t, s, pin, ...gloss] = row;
  const inner = gloss.map((x) => x.replace(/\//g, "／")).join("/");
  return `${t} ${s} [${pin}] /${inner}/`;
}

function makePendingEntry({ id, word, traditional, pinyin, en }) {
  return {
    id,
    type: "word",
    word,
    traditional,
    pinyin,
    source: CEDICT_SOURCE_PENDING,
    meaning: { cn: "", kr: "", en: en || "—", jp: "" },
    example: { cn: "", kr: "", en: "", jp: "" },
    examplePinyin: "",
    needsReview: true,
  };
}

function maxCedictNum(list) {
  let n = 0;
  for (const o of list) {
    const m = String(o?.id || "").match(/^cedict_word_(\d+)$/i);
    if (m) n = Math.max(n, parseInt(m[1], 10));
  }
  return n;
}

function main() {
  mkdirSync(SRC_DIR, { recursive: true });
  const lines = CEDICT_BASIC_100_ROWS.map(rowToLine);
  writeFileSync(TXT_OUT, lines.join("\n") + "\n", "utf8");

  let existing = [];
  if (existsSync(WORDS_FILE)) {
    try {
      existing = readJson(WORDS_FILE);
    } catch (e) {
      console.error("Failed to read", WORDS_FILE, e);
      process.exit(1);
    }
  }
  if (!Array.isArray(existing)) existing = [];

  const byWord = new Map();
  for (const o of existing) {
    if (o?.word) byWord.set(o.word, o);
  }

  let nextNum = maxCedictNum(existing) + 1;
  if (nextNum < 6) nextNum = 6;

  const out = [];
  for (const row of CEDICT_BASIC_100_ROWS) {
    const trad = row[0];
    const word = row[1];
    const pinyinNumbered = row[2];
    const en = row
      .slice(3)
      .filter(Boolean)
      .join("; ");
    const pinyin = numberedPinyinToToneMarks(pinyinNumbered);
    const prev = byWord.get(word);

    if (prev && isProtectedEntry(prev)) {
      out.push(JSON.parse(JSON.stringify(prev)));
      continue;
    }
    if (prev && !isProtectedEntry(prev) && prev.id) {
      out.push(
        makePendingEntry({
          id: prev.id,
          word,
          traditional: trad,
          pinyin,
          en: en || "—",
        })
      );
      continue;
    }
    const id = `cedict_word_${String(nextNum++).padStart(4, "0")}`;
    out.push(
      makePendingEntry({
        id,
        word,
        traditional: trad,
        pinyin,
        en: en || "—",
      })
    );
  }

  out.sort(
    (a, b) =>
      (parseInt(String(a.id).match(/\d+/)?.[0] || "0", 10) || 0) -
      (parseInt(String(b.id).match(/\d+/)?.[0] || "0", 10) || 0)
  );

  writeFileSync(WORDS_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");

  let index = readJson(INDEX_FILE);
  if (!Array.isArray(index)) index = [];
  const basicQueries = new Set(
    index.filter((r) => r && r.type === "word" && r.file === "words-basic-001.json").map((r) => r.query)
  );
  const tqSet = new Set(index.filter((r) => r).map((r) => `${r.type}\t${r.query}`));
  const idSet = new Set(index.map((r) => r && r.id).filter(Boolean));

  for (const d of out) {
    if (!d || d.type !== "word") continue;
    if (basicQueries.has(d.word)) continue;
    const k = `word\t${d.word}`;
    if (tqSet.has(k)) continue;
    if (idSet.has(d.id)) {
      tqSet.add(k);
      continue;
    }
    index.push({
      id: d.id,
      type: "word",
      query: d.word,
      word: d.word,
      pinyin: d.pinyin,
      file: CEDICT_WORDS,
      source: String(d.source || "").includes("reviewed") ? CEDICT_SOURCE_REVIEWED : CEDICT_SOURCE_PENDING,
    });
    tqSet.add(k);
    idSet.add(d.id);
  }

  const seenK = new Set();
  const indexDeduped = [];
  for (const r of index) {
    if (!r) continue;
    const k = `${r.type}\t${r.query}`;
    if (seenK.has(k)) continue;
    seenK.add(k);
    indexDeduped.push(r);
  }

  writeFileSync(INDEX_FILE, JSON.stringify(indexDeduped, null, 2) + "\n", "utf8");

  console.log("✅ CC-CEDICT basic-100 convert done.");
  console.log(`  data/dictionary/sources/cedict-basic-100.txt (${lines.length} lines)`);
  console.log(`  data/dictionary/words-cedict-001.json: ${out.length} entries`);
  console.log(`  data/dictionary/dictionary-index.json: ${indexDeduped.length} index rows`);
}

main();
