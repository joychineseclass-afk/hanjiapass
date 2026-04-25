/**
 * CC-CEDICT 小样本 → Lumina draft word 格式
 * 用法: node scripts/convert-cedict-sample.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const INPUT = join(ROOT, "data", "dictionary", "sources", "cedict-sample.txt");
const OUT_DIR = join(ROOT, "data", "dictionary", "drafts");
const OUTPUT = join(OUT_DIR, "words-cedict-draft-001.json");

// --- 数字声调 → 带调拼音（可整体替换/升级，勿散落逻辑）---------------------------------

const TONE = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
  v: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

/**
 * 在一个音节（无数字）中确定标调元音下标
 * 遵循常见拼音标调规则：先 a，再 e，再 o；iu→u，ui→i；否则取 i u ü 中合适一个。
 */
function getToneVowelIndex(body) {
  const s = String(body).toLowerCase();
  if (s.includes("a")) return s.indexOf("a");
  if (s.includes("e")) return s.indexOf("e");
  if (s.includes("o")) return s.indexOf("o");
  if (s.length >= 2 && s.endsWith("iu")) return s.length - 1;
  if (s.length >= 2 && s.endsWith("ui")) return s.length - 1;
  if (s.includes("i") && s.includes("ü")) return s.indexOf("ü");
  if (s.includes("i")) return s.lastIndexOf("i");
  if (s.includes("u")) return s.indexOf("u");
  if (s.includes("ü") || s.includes("v")) return s.includes("ü") ? s.indexOf("ü") : s.indexOf("v");
  return 0;
}

/**
 * 单音节 + 1–4 → 带调
 */
function addToneToSyllableBody(body, tone) {
  const t = Math.min(4, Math.max(1, tone));
  const b = String(body);
  const lower = b.toLowerCase();
  const idx = getToneVowelIndex(b);
  const ch = lower[idx];
  const map = ch === "ü" || ch === "v" ? TONE.ü : TONE[ch];
  if (!map) {
    // 罕见元音，尽量退回小写
    return lower;
  }
  const repl = charAtCaseAware(b, idx, map[t - 1]);
  return b.slice(0, idx) + repl + b.slice(idx + 1);
}

function charAtCaseAware(orig, i, withTone) {
  const c = orig[i];
  return c && c === c.toUpperCase() && c !== c.toLowerCase() ? withTone.toUpperCase() : withTone;
}

/**
 * 解析 "Zhong1" / "xue2" 等
 */
function syllableNumberedToMark(token) {
  const m = String(token).match(/^(.+?)([1-5])$/i);
  if (!m) return String(token).toLowerCase();
  const body = m[1];
  const t = +m[2];
  if (t === 5) return body.toLowerCase();
  return addToneToSyllableBody(body, t);
}

/**
 * CC-CEDICT 数字声调节拍串 → Lumina 词语拼音：全小写、音节间无空格
 * 例: Zhong1 guo2 → zhōngguó
 * @param {string} input
 * @returns {string}
 */
export function numberedPinyinToToneMarks(input) {
  const parts = String(input || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts
    .map((p) => syllableNumberedToMark(p))
    .join("")
    .toLowerCase();
}

// --- 行解析 ------------------------------------------------------------------

const LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.+)\/\s*$/;

function parseLine(line) {
  const t = String(line).replace(/\r$/, "");
  if (!t.trim()) return { ok: false, empty: true };
  const m = t.match(LINE_RE);
  if (!m) return { ok: false, empty: false, raw: t };
  const traditional = m[1];
  const word = m[2];
  const pinyinNumbered = m[3].trim();
  const defPart = m[4];
  const rawEnglishDefinitions = defPart
    .split("/")
    .map((s) => s.replace(/\\\//g, "/").trim())
    .filter((s) => s.length);
  return {
    ok: true,
    traditional,
    word,
    pinyinNumbered,
    rawEnglishDefinitions,
  };
}

const NOTES =
  "Imported from CC-CEDICT sample. Requires CN/KR/JP meanings and examples before publishing.";

function toDraftEntry(id, row) {
  const pinyin = numberedPinyinToToneMarks(row.pinyinNumbered);
  const enJoined = row.rawEnglishDefinitions.join("; ");
  return {
    id: `cedict_draft_${String(id).padStart(4, "0")}`,
    type: "word",
    status: "draft",
    source: "CC-CEDICT",
    word: row.word,
    traditional: row.traditional,
    pinyinNumbered: row.pinyinNumbered,
    pinyin,
    rawEnglishDefinitions: row.rawEnglishDefinitions,
    meaning: { cn: "", kr: "", en: enJoined, jp: "" },
    example: { cn: "", kr: "", en: "", jp: "" },
    examplePinyin: "",
    needsReview: true,
    notes: NOTES,
  };
}

function main() {
  if (!existsSync(INPUT)) {
    console.error("❌ Input not found:", INPUT);
    process.exit(1);
  }
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const text = readFileSync(INPUT, "utf8");
  const lines = text.split(/\n/);
  const drafts = [];
  let inputCount = 0;
  const skipped = [];

  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const parsed = parseLine(lines[i]);
    if (parsed.empty) continue;
    inputCount += 1;
    if (!parsed.ok) {
      skipped.push([n, lines[i].trim() || "(blank)"]);
      continue;
    }
    drafts.push(toDraftEntry(drafts.length + 1, parsed));
  }

  for (const [lineNo, content] of skipped) {
    console.warn(`⚠ Skipped invalid line ${lineNo}: ${content.slice(0, 120)}`);
  }

  writeFileSync(OUTPUT, JSON.stringify(drafts, null, 2) + "\n", "utf8");

  console.log("✅ CC-CEDICT sample converted.");
  console.log(`Input entries: ${inputCount}`);
  console.log(`Output entries: ${drafts.length}`);
  console.log(`Output: data/dictionary/drafts/words-cedict-draft-001.json`);

  if (drafts.length === 0) {
    process.exit(1);
  }
}

main();
