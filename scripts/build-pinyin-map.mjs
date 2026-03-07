#!/usr/bin/env node
/**
 * 生成拼音映射表（供 pinyinEngine 使用）
 * 扫描 data/courses/** 和 data/vocab/**
 * 输出：短语级 + 单字级映射到 ui/vendor/pinyinMap.mjs
 */
import { pinyin } from "pinyin-pro";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function addHanzi(set, str) {
  if (!str || typeof str !== "string") return;
  const t = str.trim();
  if (!t) return;
  for (const ch of t) {
    if (/[\u4e00-\u9fff]/.test(ch)) set.add(ch);
  }
}

function addPhrase(set, str) {
  if (!str || typeof str !== "string") return;
  const t = str.trim();
  if (!t || !/[\u4e00-\u9fff]/.test(t)) return;
  set.add(t);
}

function collectFromVocab(chars, phrases) {
  const vocabDir = join(ROOT, "data/vocab");
  if (!existsSync(vocabDir)) return;
  const walk = (dir) => {
    try {
      const names = readdirSync(dir);
      for (const n of names) {
        const p = join(dir, n);
        const stat = statSync(p);
        if (stat?.isDirectory()) walk(p);
        else if (n.endsWith(".json")) {
          try {
            const data = JSON.parse(readFileSync(p, "utf-8"));
            const arr = Array.isArray(data) ? data : data?.words || data?.vocab || [];
            for (const item of arr) {
              const raw = typeof item === "string" ? item : item?.hanzi ?? item?.word ?? item?.zh ?? item?.text ?? "";
              addPhrase(phrases, raw);
              addHanzi(chars, raw);
            }
          } catch {}
        }
      }
    } catch {}
  };
  walk(vocabDir);
}

function collectFromCourses(chars, phrases) {
  const courseDir = join(ROOT, "data/courses");
  if (!existsSync(courseDir)) return;
  const walk = (dir) => {
    try {
      const names = readdirSync(dir);
      for (const n of names) {
        const p = join(dir, n);
        const stat = statSync(p);
        if (stat?.isDirectory()) walk(p);
        else if (n.endsWith(".json")) {
          try {
            const data = JSON.parse(readFileSync(p, "utf-8"));
            const v = data?.vocab ?? data?.words ?? [];
            for (const item of v) {
              const raw = typeof item === "string" ? item : item?.hanzi ?? item?.word ?? "";
              addPhrase(phrases, raw);
              addHanzi(chars, raw);
            }
            const d = data?.dialogue ?? [];
            const diaArr = Array.isArray(d) ? d : d?.lines ?? [];
            for (const line of diaArr) {
              const zh = line?.zh ?? line?.cn ?? line?.line ?? "";
              addPhrase(phrases, zh);
              addHanzi(chars, zh);
            }
            const g = data?.grammar ?? [];
            const gArr = Array.isArray(g) ? g : g?.points ?? [];
            for (const pt of gArr) {
              const t = typeof pt?.title === "object" ? pt.title?.zh ?? pt.title?.cn : pt?.title ?? pt?.pattern ?? "";
              addPhrase(phrases, t);
              addHanzi(chars, t);
              const ex = pt?.example ?? pt?.examples;
              if (typeof ex === "string") {
                addPhrase(phrases, ex);
                addHanzi(chars, ex);
              } else if (ex && typeof ex === "object") {
                const ez = ex?.zh ?? ex?.cn ?? ex?.line ?? "";
                addPhrase(phrases, ez);
                addHanzi(chars, ez);
              }
            }
            addPhrase(phrases, data?.summary?.zh ?? data?.summary?.cn ?? "");
            addHanzi(chars, data?.summary?.zh ?? data?.summary?.cn ?? "");
            const obj = data?.objectives ?? [];
            for (const o of obj) {
              const oz = typeof o === "string" ? o : (o?.zh ?? o?.cn ?? "");
              addPhrase(phrases, oz);
              addHanzi(chars, oz);
            }
          } catch {}
        }
      }
    } catch {}
  };
  walk(courseDir);
}

function buildMap(chars, phrases) {
  const map = {};
  const phraseList = [...phrases].filter((s) => s.length > 1).sort((a, b) => b.length - a.length);
  for (const s of phraseList) {
    try {
      const py = pinyin(s, { toneType: "symbol", v: true });
      if (py) map[s] = py.trim().replace(/\s+/g, " ");
    } catch (e) {
      console.warn("[build-pinyin-map] skip phrase", s.slice(0, 20), e?.message);
    }
  }
  for (const ch of chars) {
    if (map[ch]) continue;
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
  const chars = new Set();
  const phrases = new Set();
  collectFromVocab(chars, phrases);
  collectFromCourses(chars, phrases);
  console.log("[build-pinyin-map] collected", chars.size, "chars,", phrases.size, "phrases");
  const map = buildMap(chars, phrases);
  const outDir = join(ROOT, "ui/vendor");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "pinyinMap.mjs");
  const content = `/**
 * 自动生成：scripts/build-pinyin-map.mjs
 * 供 pinyinEngine 主引擎使用（短语级 + 单字级）
 */
export const PINYIN_MAP = ${JSON.stringify(map)};
`;
  writeFileSync(outPath, content, "utf-8");
  console.log("[build-pinyin-map] wrote", outPath, "keys:", Object.keys(map).length);
}

main();
