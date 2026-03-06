#!/usr/bin/env node
/**
 * 将课程数据从 data/lessons/ 迁移到 data/courses/
 * 新结构: data/courses/{hsk2.0|hsk3.0}/{hsk1|hsk2|...}/lessons.json, lessonN.json
 *
 * 用法: node scripts/migrate-courses.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data", "lessons");
const DST = path.join(ROOT, "data", "courses");

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
      console.log("  " + path.relative(ROOT, s) + " -> " + path.relative(ROOT, d));
    }
  }
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("data/lessons 不存在");
    process.exit(1);
  }

  const versions = fs.readdirSync(SRC, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const ver of versions) {
    const srcDir = path.join(SRC, ver);
    const dstDir = path.join(DST, ver);
    console.log("\n迁移:", path.relative(ROOT, srcDir), "->", path.relative(ROOT, dstDir));
    copyDir(srcDir, dstDir);
  }

  console.log("\n完成。data/courses/ 已就绪。");
}

main();
