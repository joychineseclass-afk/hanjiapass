/**
 * 轻量扫描：HSK1 lesson*.json 中多语言字段的明显混语（非 NLP 级）。
 * - cn/zh：不应含韩文音节（Hangul）
 * - en：不应含 Hangul（引号内教学用中文/韩文素材时仍可能命中，需人工复核）
 * - jp：不应含 Hangul；若整段主要为汉字且几乎无假名，标为疑似中文直贴
 *
 * 排除路径片段：title、displayTitle、scene、summary、objectives、vocabTargets、
 * distribution（按任务边界不扫或仅提示）
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HSK1_DIR = join(__dirname, "../data/courses/hsk2.0/hsk1");

const HANGUL = /[\uAC00-\uD7A3\u3131-\u318E]/;
const HAS_LATIN = /[A-Za-z]/;
const HIRAGANA_KATAKANA = /[\u3040-\u30FF]/;
/** 日文行：汉字占比高、无假名、无韩文 — 可能为中文整句复制（启发式） */
function looksLikeJpChineseDump(s) {
  if (!s || typeof s !== "string") return false;
  if (HIRAGANA_KATAKANA.test(s) || HANGUL.test(s)) return false;
  const cjk = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
  if (cjk < 8) return false;
  return cjk / s.length > 0.55;
}

const SKIP_KEYS = new Set([
  "title",
  "displayTitle",
  "scene",
  "summary",
  "objectives",
  "vocabTargets",
  "distribution",
]);

/** 路径任一段为跳过键则不再深入该子树（任务边界：不扫标题/scene 等） */
function shouldSkipPath(pathStr) {
  const parts = pathStr.split(/\.|\[|\]/).filter(Boolean);
  return parts.some((seg) => SKIP_KEYS.has(seg));
}

const issues = [];

function walk(obj, pathStr, lessonFile) {
  if (shouldSkipPath(pathStr)) return;
  if (obj === null || obj === undefined) return;
  if (typeof obj === "string") {
    const key = pathStr.split(".").pop() || "";
    const lang = key.replace(/\[\d+\]$/, "");

    if ((lang === "cn" || lang === "zh") && HANGUL.test(obj)) {
      issues.push({ lessonFile, path: pathStr, kind: "hangul_in_zh_cn", sample: obj.slice(0, 120) });
    }
    if (lang === "en" && HANGUL.test(obj)) {
      issues.push({ lessonFile, path: pathStr, kind: "hangul_in_en", sample: obj.slice(0, 120) });
    }
    if ((lang === "jp" || lang === "ja") && HANGUL.test(obj)) {
      issues.push({ lessonFile, path: pathStr, kind: "hangul_in_jp", sample: obj.slice(0, 120) });
    }
    if ((lang === "jp" || lang === "ja") && looksLikeJpChineseDump(obj)) {
      issues.push({ lessonFile, path: pathStr, kind: "jp_suspected_zh_paste", sample: obj.slice(0, 120) });
    }
    if (lang === "en" && !HAS_LATIN.test(obj) && HANGUL.test(obj)) {
      issues.push({ lessonFile, path: pathStr, kind: "en_non_latin_hangul", sample: obj.slice(0, 120) });
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => walk(item, `${pathStr}[${i}]`, lessonFile));
    return;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      walk(obj[k], pathStr ? `${pathStr}.${k}` : k, lessonFile);
    }
  }
}

const files = readdirSync(HSK1_DIR)
  .filter((f) => /^lesson\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

for (const f of files) {
  const raw = readFileSync(join(HSK1_DIR, f), "utf8");
  try {
    const data = JSON.parse(raw);
    walk(data, "", f);
  } catch (e) {
    console.error("JSON parse error:", f, e.message);
    process.exit(1);
  }
}

const byKind = {};
for (const row of issues) {
  byKind[row.kind] = (byKind[row.kind] || 0) + 1;
}

console.log("HSK1 mixed-language scan (heuristic)\n");
console.log("Files scanned:", files.length);
console.log("Total findings:", issues.length);
console.log("By kind:", JSON.stringify(byKind, null, 2));
if (issues.length) {
  console.log("\n--- details (max 80) ---\n");
  issues.slice(0, 80).forEach((r) => {
    console.log(`${r.lessonFile} [${r.kind}] ${r.path}`);
    console.log(`  ${r.sample.replace(/\n/g, " ")}\n`);
  });
  if (issues.length > 80) console.log(`... and ${issues.length - 80} more`);
}

process.exit(issues.length > 0 ? 1 : 0);
