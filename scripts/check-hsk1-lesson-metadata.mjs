/**
 * HSK1 轻量元数据检查：scene / summary / objectives 非空、scene.id 与课次基本一致。
 * 不校验文案质量，只抓明显缺失与错位。
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "../data/courses/hsk2.0/hsk1");

const issues = [];

function nonEmpty(s) {
  return typeof s === "string" && s.trim().length > 0;
}

function checkLesson(file, data) {
  const n = data.lessonNo;
  const prefix = `${file} (L${n})`;

  if (!data.summary || !nonEmpty(data.summary.zh)) {
    issues.push({ level: "error", msg: `${prefix}: summary.zh 缺失或为空` });
  }

  const sc = data.scene;
  if (!sc || typeof sc !== "object") {
    issues.push({ level: "error", msg: `${prefix}: scene 缺失` });
    return;
  }
  if (!nonEmpty(sc.id)) {
    issues.push({ level: "error", msg: `${prefix}: scene.id 为空` });
  } else {
    const expectRegular = `l${n}_scene`;
    const isReview = data.type === "review";
    if (isReview) {
      if (!/^l\d+_review_scene$/.test(sc.id)) {
        issues.push({ level: "warn", msg: `${prefix}: scene.id 建议为 l{N}_review_scene，当前: ${sc.id}` });
      }
    } else if (sc.id !== expectRegular) {
      issues.push({ level: "warn", msg: `${prefix}: scene.id 期望 ${expectRegular}，当前: ${sc.id}` });
    }
  }

  const st = sc.title;
  const ss = sc.summary;
  for (const lang of ["zh", "kr", "en"]) {
    if (!st || !nonEmpty(st[lang])) {
      issues.push({ level: "error", msg: `${prefix}: scene.title.${lang} 为空` });
    }
    if (!ss || !nonEmpty(ss[lang])) {
      issues.push({ level: "error", msg: `${prefix}: scene.summary.${lang} 为空` });
    }
  }

  const objs = data.objectives;
  if (!Array.isArray(objs) || objs.length === 0) {
    issues.push({ level: "error", msg: `${prefix}: objectives 为空或不是数组` });
  } else {
    objs.forEach((o, i) => {
      if (!nonEmpty(o?.zh)) {
        issues.push({ level: "error", msg: `${prefix}: objectives[${i}].zh 为空` });
      }
    });
  }
}

const files = readdirSync(DIR)
  .filter((f) => /^lesson\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

for (const f of files) {
  const data = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  checkLesson(f, data);
}

const errors = issues.filter((x) => x.level === "error");
const warns = issues.filter((x) => x.level === "warn");

console.log("HSK1 lesson metadata check\n");
console.log("Files:", files.length);
console.log("Errors:", errors.length);
console.log("Warnings:", warns.length);
if (errors.length) {
  console.log("\n--- errors ---\n");
  errors.forEach((e) => console.log(e.msg));
}
if (warns.length) {
  console.log("\n--- warnings ---\n");
  warns.forEach((e) => console.log(e.msg));
}

process.exit(errors.length > 0 ? 1 : 0);
