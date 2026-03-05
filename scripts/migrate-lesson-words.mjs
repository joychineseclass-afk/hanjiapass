#!/usr/bin/env node
/**
 * 将 lesson 的 words 从完整对象迁移为纯 hanzi 列表（lesson-vocab 解耦）
 * 输入: words: [{hanzi, pinyin, ko, en}, ...]
 * 输出: words: ["好","你","我"]
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LESSONS_DIR = join(__dirname, "..", "data", "lessons", "hsk2.0");

function extractHanzi(w) {
  if (w == null) return "";
  if (typeof w === "string") return String(w).trim();
  return String(w?.hanzi ?? w?.word ?? w?.zh ?? "").trim();
}

import { readdirSync } from "fs";
const all = readdirSync(LESSONS_DIR).filter((f) => /hsk\d+_lesson\d+\.json$/.test(f));

for (const file of all) {
  const path = join(LESSONS_DIR, file);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw?.words)) continue;
  const migrated = raw.words.map((w) => {
    const h = extractHanzi(w);
    return h || null;
  }).filter(Boolean);
  raw.words = migrated;
  writeFileSync(path, JSON.stringify(raw, null, 2), "utf8");
  console.log(`[migrate] ${file}: ${migrated.length} words`);
}
