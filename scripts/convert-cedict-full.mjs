/**
 * CC-CEDICT → data/dictionary/cedict/cedict-index.json + cedict/words-cedict-NNN.json
 *
 * 全量：node scripts/convert-cedict-full.mjs --full
 * 样本：node scripts/convert-cedict-full.mjs --sample
 *
 * 全量前请将官方 CC-CEDICT 放到: data/dictionary/sources/cedict-full.u8
 * （脚本不从网络下载）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, join, basename } from "path";
import { numberedPinyinToToneMarks } from "./convert-cedict-sample.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_BASIC = join(ROOT, "data", "dictionary", "sources", "cedict-basic-100.txt");
const SRC_FULL = join(ROOT, "data", "dictionary", "sources", "cedict-full.u8");
const OUT_DIR = join(ROOT, "data", "dictionary", "cedict");
const CEDICT_SOURCE = "CC-CEDICT";
const LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.+)\/\s*$/;
const SAMPLE_MAX = 25;
/** 每个详情分包条数 */
const CHUNK_SIZE = 1000;

function pinyinToPlain(marks) {
  return String(marks)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[·.]/g, "");
}

function normalizePinyinKey(pinyinNumbered) {
  return String(pinyinNumbered || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function mergeDefLists(base, more) {
  const seen = new Set(base.map((s) => s.toLowerCase()));
  for (const d of more) {
    const t = String(d).trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    base.push(t);
  }
  return base;
}

function rowToDetail(
  { id, word, traditional, pinyin, pinyinNumbered, rawEnglishDefinitions }
) {
  const enJoined = rawEnglishDefinitions.length ? rawEnglishDefinitions.join("; ") : "—";
  return {
    id,
    type: "word",
    word,
    traditional,
    pinyin,
    pinyinNumbered,
    source: CEDICT_SOURCE,
    qualityLevel: "raw",
    needsReview: true,
    rawEnglishDefinitions: [...rawEnglishDefinitions],
    meaning: { cn: "", kr: "", en: enJoined, jp: "" },
    example: { cn: "", kr: "", en: "", jp: "" },
    examplePinyin: "",
  };
}

/**
 * 流式读取大文件、解析、去重（word + 规范化 pinyinNumbered）
 * @param {string} filePath
 * @returns {Promise<{
 *   order: string[],
 *   byKey: Map<string, { word: string, traditional: string, pinyinNumbered: string, rawEnglishDefinitions: string[] }>,
 *   lineCount: { ok: number, skippedEmpty: number, skippedComment: number, unparseable: number }
 * }>}
 */
function parseCedictFileFull(filePath) {
  return new Promise((resolve, reject) => {
    const byKey = new Map();
    const order = [];
    const lineCount = { ok: 0, skippedEmpty: 0, skippedComment: 0, unparseable: 0 };

    const input = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input, crlfDelay: Infinity });

    const flushLine = (line) => {
      const t = String(line).replace(/\r$/, "");
      if (!t.trim()) {
        lineCount.skippedEmpty += 1;
        return;
      }
      if (t.startsWith("#")) {
        lineCount.skippedComment += 1;
        return;
      }
      const m = t.match(LINE_RE);
      if (!m) {
        lineCount.unparseable += 1;
        return;
      }
      const traditional = m[1];
      const word = m[2];
      const pinyinNumbered = m[3].trim();
      const defPart = m[4];
      const rawEnglishDefinitions = defPart
        .split("/")
        .map((s) => s.replace(/\\\//g, "/").trim())
        .filter((s) => s.length);
      if (!pinyinNumbered) {
        lineCount.unparseable += 1;
        return;
      }
      const key = `${word}\t${normalizePinyinKey(pinyinNumbered)}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          word,
          traditional,
          pinyinNumbered,
          rawEnglishDefinitions: [...rawEnglishDefinitions],
        });
        order.push(key);
      } else {
        const o = byKey.get(key);
        mergeDefLists(o.rawEnglishDefinitions, rawEnglishDefinitions);
        if (o.traditional !== traditional) {
          // 保守：保留先出现的 traditional
        }
      }
      lineCount.ok += 1;
    };

    rl.on("line", flushLine);
    rl.on("close", () => {
      try {
        resolve({ order, byKey, lineCount });
      } catch (e) {
        reject(e);
      }
    });
    input.on("error", reject);
    rl.on("error", reject);
  });
}

function fileForSeq(seq1Based) {
  const part = Math.floor((seq1Based - 1) / CHUNK_SIZE) + 1;
  return `cedict/words-cedict-${String(part).padStart(3, "0")}.json`;
}

async function runFull() {
  if (!existsSync(SRC_FULL)) {
    console.error("");
    console.error("请先将 CC-CEDICT 原始文件放到 data/dictionary/sources/cedict-full.u8");
    console.error("");
    process.exit(1);
  }

  return parseCedictFileFull(SRC_FULL)
    .then(({ order, byKey, lineCount }) => {
      mkdirSync(OUT_DIR, { recursive: true });
      if (!order.length) {
        console.error("未解析到任何有效词条。");
        process.exit(1);
      }

      const index = [];
      const chunks = new Map();
      for (let i = 0; i < order.length; i++) {
        const seq = i + 1;
        const id = `cedict_full_${String(seq).padStart(6, "0")}`;
        const key = order[i];
        const row = byKey.get(key);
        if (!row) continue;
        const pinyin = numberedPinyinToToneMarks(row.pinyinNumbered);
        const fileRel = fileForSeq(seq);
        index.push({
          id,
          type: "word",
          query: row.word,
          word: row.word,
          traditional: row.traditional,
          pinyin,
          pinyinPlain: pinyinToPlain(pinyin),
          file: fileRel,
          source: CEDICT_SOURCE,
          qualityLevel: "raw",
          needsReview: true,
        });
        if (!chunks.has(fileRel)) {
          chunks.set(fileRel, []);
        }
        chunks.get(fileRel).push(
          rowToDetail({
            id,
            word: row.word,
            traditional: row.traditional,
            pinyin,
            pinyinNumbered: row.pinyinNumbered,
            rawEnglishDefinitions: row.rawEnglishDefinitions,
          })
        );
      }

      const idxPath = join(OUT_DIR, "cedict-index.json");
      writeFileSync(idxPath, JSON.stringify(index) + "\n", "utf8");

      for (const fpath of [...chunks.keys()].sort()) {
        const arr = chunks.get(fpath);
        const outPath = join(OUT_DIR, basename(fpath));
        writeFileSync(outPath, JSON.stringify(arr) + "\n", "utf8");
      }

      const nChunk = Array.from(chunks.keys()).length;
      console.log("");
      console.log("全量转换完成。");
      console.log(`  去重后词条: ${order.length}`);
      console.log(`  索引文件:   ${index.length} 行`);
      console.log(`  详情分包:   ${nChunk} 个 (每包最多 ${CHUNK_SIZE} 条)`);
      console.log(
        `  解析统计: 有效行(含去重后合并) ${lineCount.ok}, 空行 ${lineCount.skippedEmpty}, 注释 # ${lineCount.skippedComment}, 无法解析 ${lineCount.unparseable}`
      );
      console.log("  输出: data/dictionary/cedict/");
    })
    .catch((e) => {
      console.error("全量转换失败:", e);
      process.exit(1);
    });
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
    if (t.startsWith("#")) continue;
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
    details.push(
      rowToDetail({
        id,
        word,
        traditional,
        pinyin,
        pinyinNumbered,
        rawEnglishDefinitions,
      })
    );
  }

  if (!index.length) {
    console.error("No valid cedict lines.");
    process.exit(1);
  }
  const idxPath = join(OUT_DIR, "cedict-index.json");
  const wPath = join(OUT_DIR, "words-cedict-001.json");
  writeFileSync(idxPath, JSON.stringify(index, null, 2) + "\n", "utf8");
  writeFileSync(wPath, JSON.stringify(details, null, 2) + "\n", "utf8");
  console.log(
    `Wrote ${index.length} entries to data/dictionary/cedict/ (sample, max ${SAMPLE_MAX} lines from cedict-basic-100).`
  );
  console.log("  " + idxPath);
  console.log("  " + wPath);
}

async function main() {
  const full = process.argv.includes("--full");
  const sample = process.argv.includes("--sample");
  if (full) {
    await runFull();
    return;
  }
  if (sample) {
    runSample();
    return;
  }
  const fullSrc = join(ROOT, "data", "dictionary", "sources", "cedict-full.u8");
  console.log("Usage:");
  console.log("  node scripts/convert-cedict-full.mjs --full   # 需", fullSrc);
  console.log("  node scripts/convert-cedict-full.mjs --sample # 用 cedict-basic-100.txt 小样本");
  process.exit(0);
}

main();
