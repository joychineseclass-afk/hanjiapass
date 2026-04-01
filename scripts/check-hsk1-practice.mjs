/**
 * HSK1 练习题轻量检查：题量、空字段、明显重复题干、禁用问法残留。
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "../data/courses/hsk2.0/hsk1");

const BAD_CN = [/用中文怎么说/i, /你应该说？$/];
const issues = [];

function walkPrompts(p, pathStr) {
  if (!p || typeof p !== "object") return;
  const zhStem = p.cn || p.zh;
  if (typeof zhStem !== "string" || !zhStem.trim()) {
    issues.push({ level: "error", msg: `${pathStr}.prompt.cn（或 zh）为空` });
  }
  for (const k of ["cn", "zh", "en", "kr", "jp"]) {
    const v = p[k];
    if (typeof v !== "string" || !v.trim()) continue;
    for (const re of BAD_CN) {
      if (re.test(v)) issues.push({ level: "warn", msg: `${pathStr}: 题干含不推荐问法 — ${v.slice(0, 48)}` });
    }
  }
}

function checkLesson(file, data) {
  const pr = data.practice;
  if (!Array.isArray(pr)) {
    issues.push({ level: "error", msg: `${file}: practice 缺失` });
    return;
  }
  const n = data.lessonNo;
  if (n >= 1 && n <= 20 && pr.length !== 5) {
    issues.push({ level: "warn", msg: `${file}: 普通课默认 5 题，当前 ${pr.length} 题` });
  }
  const stems = [];
  for (let i = 0; i < pr.length; i++) {
    const item = pr[i];
    const base = `${file} p${i + 1} (${item.subtype || item.type || "?"})`;
    if (!item.prompt) issues.push({ level: "error", msg: `${base}: 无 prompt` });
    else walkPrompts(item.prompt, base);
    const opts = item.options;
    if (item.type === "choice" && Array.isArray(opts)) {
      for (let j = 0; j < opts.length; j++) {
        const o = opts[j];
        if (typeof o === "string" && !o.trim()) issues.push({ level: "error", msg: `${base}: options[${j}] 空串` });
      }
    }
    const stem = item.prompt?.cn || item.prompt?.zh;
    if (typeof stem === "string" && stem.trim()) stems.push(stem.trim());
  }
  const dup = stems.filter((s, i) => stems.indexOf(s) !== i);
  if (dup.length) issues.push({ level: "warn", msg: `${file}: 重复题干 cn — ${[...new Set(dup)].join(" | ").slice(0, 80)}` });
}

const files = readdirSync(DIR)
  .filter((f) => /^lesson\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

for (const f of files) {
  const n = parseInt(f.match(/\d+/)[0], 10);
  if (n > 20) continue;
  const data = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  checkLesson(f, data);
}

const errors = issues.filter((x) => x.level === "error");
const warns = issues.filter((x) => x.level === "warn");
console.log("HSK1 practice check (lessons 1–20)\n");
console.log("Errors:", errors.length, "Warnings:", warns.length);
errors.forEach((e) => console.log("[E]", e.msg));
warns.forEach((e) => console.log("[W]", e.msg));
process.exit(errors.length > 0 ? 1 : 0);
