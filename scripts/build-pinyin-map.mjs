#!/usr/bin/env node
/**
 * 生成 HSK 1-6 字符拼音映射表（供浏览器 pinyinEngine 主引擎使用）
 * 使用 pinyin-pro 作为项目依赖，不依赖 CDN
 */
import { pinyin } from "pinyin-pro";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function collectChars() {
  const chars = new Set();
  const vocabPaths = [
    "data/vocab/hsk2.0/hsk1.json",
    "data/vocab/hsk2.0/hsk2.json",
    "data/vocab/hsk2.0/hsk3.json",
    "data/vocab/hsk2.0/hsk4.json",
    "data/vocab/hsk2.0/hsk5.json",
    "data/vocab/hsk2.0/hsk6.json",
    "data/vocab/hsk3.0/hsk1.json",
    "data/vocab/hsk3.0/hsk2.json",
    "data/vocab/hsk3.0/hsk3.json",
    "data/vocab/hsk3.0/hsk4.json",
    "data/vocab/hsk3.0/hsk5.json",
    "data/vocab/hsk3.0/hsk6.json",
  ];

  function addHanzi(str) {
    if (!str || typeof str !== "string") return;
    for (const ch of str) {
      if (/[\u4e00-\u9fff]/.test(ch)) chars.add(ch);
    }
  }

  for (const p of vocabPaths) {
    const full = join(ROOT, p);
    if (!existsSync(full)) continue;
    try {
      const data = JSON.parse(readFileSync(full, "utf-8"));
      const arr = Array.isArray(data) ? data : data?.words || data?.vocab || [];
      for (const item of arr) {
        const raw = typeof item === "string" ? item : item?.hanzi ?? item?.word ?? item?.zh ?? item?.text ?? "";
        addHanzi(raw);
      }
    } catch (e) {
      console.warn("[build-pinyin-map] skip", p, e?.message);
    }
  }

  // 课程对话、语法（仅扫描 hsk2.0/hsk1 作为示例，可扩展）
  const courseBase = join(ROOT, "data/courses");
  const walk = (dir) => {
    let names = [];
    try {
      if (existsSync(dir)) names = readdirSync(dir);
    } catch {}
    for (const n of names) {
      const p = join(dir, n);
      try {
        const stat = statSync(p);
        if (stat?.isDirectory()) {
          walk(p);
          continue;
        }
      } catch {}
      if (n.endsWith(".json")) {
        try {
          const data = JSON.parse(readFileSync(p, "utf-8"));
          const d = data?.dialogue;
          if (Array.isArray(d)) {
            for (const line of d) addHanzi(line?.zh ?? line?.cn ?? line?.line ?? "");
          }
          const g = data?.grammar;
          const grammarArr = Array.isArray(g) ? g : g?.points || [];
          for (const pt of grammarArr) {
            const t = typeof pt?.title === "object" ? pt.title?.zh ?? pt.title?.kr ?? pt.title?.en : pt?.title ?? pt?.pattern ?? "";
            addHanzi(t);
            const ex = pt?.example ?? pt?.examples;
            if (typeof ex === "string") addHanzi(ex);
            else if (ex && typeof ex === "object") addHanzi(ex?.zh ?? ex?.cn ?? ex?.line ?? "");
          }
        } catch {}
      }
    }
  };
  walk(courseBase);

  return Array.from(chars);
}

function buildMap(chars) {
  const map = {};
  for (const ch of chars) {
    try {
      const py = pinyin(ch, { toneType: "symbol", v: true });
      if (py) map[ch] = py.trim();
    } catch (e) {
      console.warn("[build-pinyin-map] skip char", ch, e?.message);
    }
  }
  return map;
}

function main() {
  const chars = collectChars();
  console.log("[build-pinyin-map] collected", chars.length, "unique chars");
  const map = buildMap(chars);
  const outDir = join(ROOT, "ui/vendor");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "pinyinMap.mjs");
  const content = `/**
 * 自动生成：scripts/build-pinyin-map.mjs
 * 供 pinyinEngine 主引擎使用
 */
export const PINYIN_MAP = ${JSON.stringify(map)};
`;
  writeFileSync(outPath, content, "utf-8");
  console.log("[build-pinyin-map] wrote", outPath);
}

main();
