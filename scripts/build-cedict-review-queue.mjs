/**
 * 从 words-cedict-001.json 生成 CC-CEDICT 内部审核队列（不改词条数据）
 * 用法: node scripts/build-cedict-review-queue.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const WORDS = join(ROOT, "data", "dictionary", "words-cedict-001.json");
const OUT_DIR = join(ROOT, "data", "dictionary", "review");
const OUT = join(OUT_DIR, "cedict-review-queue-001.json");
const SOURCE_FILE = "words-cedict-001.json";

const CHECK_KEYS = [
  ["meaning.cn", (e) => e?.meaning?.cn],
  ["meaning.kr", (e) => e?.meaning?.kr],
  ["meaning.jp", (e) => e?.meaning?.jp],
  ["example.cn", (e) => e?.example?.cn],
  ["example.kr", (e) => e?.example?.kr],
  ["example.en", (e) => e?.example?.en],
  ["example.jp", (e) => e?.example?.jp],
  ["examplePinyin", (e) => e?.examplePinyin],
];

function isEmpty(v) {
  return v == null || String(v).trim() === "";
}

function isPendingEntry(e) {
  return e && e.type === "word" && String(e.source) === "CC-CEDICT" && e.needsReview === true;
}

/**
 * v1 简单规则；后续可换关键词/词表
 * @param {{ word: string }} item
 * @returns {1|2|3}
 */
function guessPriority(item) {
  const w = String(item.word || "");
  if (w.length <= 2) return 1;
  if (w.length <= 4) return 2;
  return 3;
}

function buildMissingList(entry) {
  const missing = [];
  for (const [path, get] of CHECK_KEYS) {
    if (isEmpty(get(entry))) missing.push(path);
  }
  return missing;
}

function main() {
  if (!existsSync(WORDS)) {
    console.error("❌ Not found:", WORDS);
    process.exit(1);
  }
  const raw = readFileSync(WORDS, "utf8");
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) {
    console.error("❌ words-cedict-001.json must be a JSON array.");
    process.exit(1);
  }

  const total = list.length;
  const needsReview = list.filter(isPendingEntry);
  const reviewed = total - needsReview.length;

  const items = needsReview.map((e) => {
    const meaningEn = e.meaning && e.meaning.en != null ? String(e.meaning.en) : "";
    return {
      id: e.id,
      word: e.word,
      traditional: e.traditional != null ? String(e.traditional) : "",
      pinyin: e.pinyin != null ? String(e.pinyin) : "",
      meaningEn,
      missing: buildMissingList(e),
      priority: guessPriority(e),
    };
  });

  const out = {
    sourceFile: SOURCE_FILE,
    total,
    reviewed,
    needsReview: needsReview.length,
    items,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log("✅ CC-CEDICT review queue built.");
  console.log(`Total entries: ${total}`);
  console.log(`Reviewed entries: ${reviewed}`);
  console.log(`Needs review: ${needsReview.length}`);
  console.log(`Output: data/dictionary/review/cedict-review-queue-001.json`);
}

main();
