/**
 * 未来：CC-CEDICT 全量 u8 → data/dictionary/cedict/cedict-index.json + 详情分包
 *
 * 小样本：node scripts/convert-cedict-full.mjs --sample
 *   输入: data/dictionary/sources/cedict-basic-100.txt
 *   输出: data/dictionary/cedict/cedict-index.json
 *         data/dictionary/cedict/words-cedict-001.json
 *
 * 全量未实现：见 TODO（不影响现有构建）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { numberedPinyinToToneMarks } from "./convert-cedict-sample.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_BASIC = join(ROOT, "data", "dictionary", "sources", "cedict-basic-100.txt");
const OUT_DIR = join(ROOT, "data", "dictionary", "cedict");
const CEDICT_SOURCE = "CC-CEDICT";
const LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.+)\/\s*$/;
const SAMPLE_MAX = 25;

function pinyinToPlain(marks) {
  return String(marks)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[·.]/g, "");
}

function runSample() {
  if (!existsSync(SRC_BASIC)) {
    console.error("Missing:", SRC_BASIC);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const text = readFileSync(SRC_BASIC, "utf8");
  const index = [];
  const details = [];
  let n = 0;
  for (const line of text.split("\n")) {
    const t = String(line).replace(/\r$/, "");
    if (!t.trim()) continue;
    const m = t.match(LINE_RE);
    if (!m) continue;
    n += 1;
    if (n > SAMPLE_MAX) break;

    const traditional = m[1];
    const word = m[2];
    const pinyinNumbered = m[3].trim();
    const defPart = m[4];
    const rawEnglishDefinitions = defPart
      .split("/")
      .map((s) => s.replace(/\\\//g, "/").trim())
      .filter((s) => s.length);
    const enGloss = rawEnglishDefinitions[0] || "—";
    const pinyin = numberedPinyinToToneMarks(pinyinNumbered);
    const pinyinPlain = pinyinToPlain(pinyin);
    const id = `cedict_full_${String(n).padStart(6, "0")}`;

    index.push({
      id,
      type: "word",
      query: word,
      word,
      traditional,
      pinyin,
      pinyinPlain,
      file: "cedict/words-cedict-001.json",
      source: CEDICT_SOURCE,
      qualityLevel: "raw",
      needsReview: true,
    });
    details.push({
      id,
      type: "word",
      word,
      traditional,
      pinyin,
      pinyinNumbered,
      source: CEDICT_SOURCE,
      qualityLevel: "raw",
      needsReview: true,
      rawEnglishDefinitions,
      meaning: { cn: "", kr: "", en: enGloss, jp: "" },
      example: { cn: "", kr: "", en: "", jp: "" },
      examplePinyin: "",
    });
  }

  if (!index.length) {
    console.error("No valid cedict lines.");
    process.exit(1);
  }
  const idxPath = join(OUT_DIR, "cedict-index.json");
  const wPath = join(OUT_DIR, "words-cedict-001.json");
  writeFileSync(idxPath, JSON.stringify(index, null, 2) + "\n", "utf8");
  writeFileSync(wPath, JSON.stringify(details, null, 2) + "\n", "utf8");
  console.log(`Wrote ${index.length} entries to data/dictionary/cedict/ (sample, max ${SAMPLE_MAX} lines from cedict-basic-100).`);
  console.log("  " + idxPath);
  console.log("  " + wPath);
}

function main() {
  const sample = process.argv.includes("--sample");
  if (sample) {
    runSample();
    return;
  }
  const fullSrc = join(ROOT, "data", "dictionary", "sources", "cedict-full.u8");
  console.log("TODO (full import):");
  console.log("  1) Read input from:", fullSrc, "(or official CC-CEDICT release).");
  console.log("  2) Emit lightweight cedict-index.json rows (id, pinyinPlain, file chunk, qualityLevel, …).");
  console.log("  3) Split details into cedict/words-cedict-NNN.json (size target, stable ids).");
  console.log("  4) Do not block npm run build; this script is offline-only.");
  console.log("");
  console.log("Use --sample to generate a small cedict/ tree from cedict-basic-100.txt.");
  process.exit(0);
}

main();
