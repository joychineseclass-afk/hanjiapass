/**
 * HSK1：校验 lessons.json 中普通课（1–20）的 vocabTargets ⊆ vocab-distribution.json 对应 distribution.lessonN
 *
 * 语义：
 *   • distribution = 该课「正式词表」集合（宽）
 *   • vocabTargets = 教学目标/拆词辅助（窄），每个词必须出现在本课 distribution 中
 *   • 不要求二者相等；strict 仅失败于「targets 越界」
 *
 * 用法：
 *   node scripts/check-hsk1-vocab-targets.mjs           → 有违例时 console.warn，exit 0
 *   node scripts/check-hsk1-vocab-targets.mjs --strict   → 有违例时 console.error，exit 1（CI）
 *   STRICT_HSK1_VOCAB=1 node scripts/check-hsk1-vocab-targets.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LESSONS = join(ROOT, "data/courses/hsk2.0/hsk1/lessons.json");
const DIST = join(ROOT, "data/courses/hsk2.0/hsk1/vocab-distribution.json");

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function main() {
  const strict =
    process.argv.includes("--strict") ||
    String(process.env.STRICT_HSK1_VOCAB || "").trim() === "1";

  const lessonsDoc = loadJson(LESSONS);
  const distDoc = loadJson(DIST);
  const dist = distDoc.distribution || {};
  const list = Array.isArray(lessonsDoc.lessons) ? lessonsDoc.lessons : [];

  const violations = [];
  for (const entry of list) {
    const no = Number(entry.lessonNo ?? entry.no ?? 0);
    if (!no || no > 20) continue;
    const key = `lesson${no}`;
    const bucket = Array.isArray(dist[key]) ? dist[key].map((x) => String(x).trim()) : [];
    const set = new Set(bucket);
    const targets = Array.isArray(entry.vocabTargets) ? entry.vocabTargets : [];
    for (const t of targets) {
      const s = String(t || "").trim();
      if (!s) continue;
      if (!set.has(s)) {
        violations.push({ lessonNo: no, key, word: s });
      }
    }
  }

  const log = strict ? console.error.bind(console) : console.warn.bind(console);

  if (violations.length) {
    for (const v of violations) {
      log(
        `[check-hsk1-vocab-targets] STRICT 违例 · lesson ${v.lessonNo}: vocabTargets「${v.word}」∉ ${v.key}（vocab-distribution）。应：从 targets 删除、或将该词合规则并入本课 distribution。`
      );
    }
    log(
      `[check-hsk1-vocab-targets] 小结：${violations.length} 条越界（vocabTargets 不是本课正式词表的子集）· 模式=${strict ? "strict→exit 1" : "warn→exit 0"}`
    );
    process.exit(strict ? 1 : 0);
  }

  console.log(
    "[check-hsk1-vocab-targets] OK — 普通课 1–20：vocabTargets ⊆ distribution.lessonN（允许 distribution 更宽；未检查 targets 是否过窄）"
  );
}

main();
