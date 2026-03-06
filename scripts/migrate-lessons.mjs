#!/usr/bin/env node
/**
 * 将 HSK 课程序列迁移到新层级结构
 * 旧: data/lessons/hsk2.0/hsk1_lessons.json, hsk1_lesson1.json
 * 新: data/lessons/hsk2.0/hsk1/lessons.json, hsk1/lesson1.json
 *
 * 用法: node scripts/migrate-lessons.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_LESSONS = path.join(ROOT, "data", "lessons");

function migrateVersion(verDir) {
  const ver = path.basename(verDir);
  const entries = fs.readdirSync(verDir, { withFileTypes: true });
  const lessonsIndexes = entries.filter((e) => e.isFile() && /^hsk\d+_lessons\.json$/i.test(e.name));
  const lessonFiles = entries.filter((e) => e.isFile() && /^hsk\d+_lesson\d+\.json$/i.test(e.name));

  const byLevel = new Map();
  for (const idx of lessonsIndexes) {
    const m = idx.name.match(/^hsk(\d+)_lessons\.json$/i);
    if (m) byLevel.set(m[1], { index: idx.name, lessons: [] });
  }
  for (const f of lessonFiles) {
    const m = f.name.match(/^hsk(\d+)_lesson(\d+)\.json$/i);
    if (m) {
      if (!byLevel.has(m[1])) byLevel.set(m[1], { index: null, lessons: [] });
      byLevel.get(m[1]).lessons.push({ file: f.name, no: m[2] });
    }
  }

  for (const [lv, { index, lessons }] of byLevel) {
    const levelDir = path.join(verDir, `hsk${lv}`);
    fs.mkdirSync(levelDir, { recursive: true });

    if (index && fs.existsSync(path.join(verDir, index))) {
      const src = path.join(verDir, index);
      const dst = path.join(levelDir, "lessons.json");
      fs.copyFileSync(src, dst);
      console.log(`  ${ver}/${index} -> ${ver}/hsk${lv}/lessons.json`);
    }

    for (const { file, no } of lessons) {
      const src = path.join(verDir, file);
      const dst = path.join(levelDir, `lesson${no}.json`);
      fs.copyFileSync(src, dst);
      console.log(`  ${ver}/${file} -> ${ver}/hsk${lv}/lesson${no}.json`);
    }
  }
}

function main() {
  if (!fs.existsSync(DATA_LESSONS)) {
    console.error("data/lessons 不存在");
    process.exit(1);
  }

  const versions = fs.readdirSync(DATA_LESSONS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(DATA_LESSONS, e.name));

  for (const verDir of versions) {
    console.log("\n迁移:", path.relative(ROOT, verDir));
    migrateVersion(verDir);
  }

  console.log("\n完成。可手动删除旧文件（hskN_lessons.json, hskN_lessonM.json）");
}

main();
