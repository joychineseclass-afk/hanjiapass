/**
 * 轻量校验：lessons.json 每课 vocabTargets ⊆ vocab-distribution.json 对应 distribution.lessonN
 * 默认：打印警告并 exit 0（不阻断构建）。严格模式：node ... --strict 或 STRICT_HSK1_VOCAB=1 → exit 1
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

  let errors = 0;
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
        const msg = `[check-hsk1-vocab-targets] lesson ${no}: vocabTargets 含「${s}」但不在 ${key}（vocab-distribution）中`;
        if (strict) console.error(msg);
        else console.warn(msg);
        errors++;
      }
    }
  }

  if (errors) {
    const tail = `共 ${errors} 条 — 请同步 vocab-distribution 或调整 vocabTargets（${strict ? "strict 模式将失败" : "默认仅警告"}）`;
    if (strict) {
      console.error("[check-hsk1-vocab-targets]", tail);
      process.exit(1);
    }
    console.warn("[check-hsk1-vocab-targets]", tail);
    process.exit(0);
  }
  console.log("[check-hsk1-vocab-targets] OK — vocabTargets ⊆ distribution（1~20）");
}

main();
