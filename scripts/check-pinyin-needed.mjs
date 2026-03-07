#!/usr/bin/env node
/**
 * 检测 pinyinMap.mjs 未覆盖的汉字/词/句
 * 扫描 data/courses/** 和 data/vocab/**，与 pinyinMap 对比
 */
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function loadPinyinMap() {
  const path = join(ROOT, "ui/vendor/pinyinMap.mjs");
  if (!existsSync(path)) return {};
  try {
    const url = pathToFileURL(path).href;
    const mod = await import(url);
    return mod.PINYIN_MAP || {};
  } catch (e) {
    console.warn("[check-pinyin] failed to load pinyinMap:", e?.message);
  }
  return {};
}

function collectStrings() {
  const set = new Set();
  function add(s) {
    if (!s || typeof s !== "string") return;
    const t = s.trim();
    if (t && /[\u4e00-\u9fff]/.test(t)) set.add(t);
  }
  function walk(dir) {
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
              add(raw);
            }
            const d = data?.dialogue ?? [];
            const diaArr = Array.isArray(d) ? d : d?.lines ?? [];
            for (const line of diaArr) add(line?.zh ?? line?.cn ?? line?.line ?? "");
            const g = data?.grammar ?? [];
            const gArr = Array.isArray(g) ? g : g?.points ?? [];
            for (const pt of gArr) {
              const t = typeof pt?.title === "object" ? pt.title?.zh : pt?.title ?? "";
              add(t);
              const ex = pt?.example ?? pt?.examples;
              if (typeof ex === "string") add(ex);
              else if (ex && typeof ex === "object") add(ex?.zh ?? ex?.cn ?? ex?.line ?? "");
            }
            add(data?.summary?.zh ?? data?.summary?.cn ?? "");
            for (const o of data?.objectives ?? []) {
              add(typeof o === "string" ? o : o?.zh ?? o?.cn ?? "");
            }
          } catch {}
        }
      }
    } catch {}
  }
  const vocabDir = join(ROOT, "data/vocab");
  if (existsSync(vocabDir)) walk(vocabDir);
  const courseDir = join(ROOT, "data/courses");
  if (existsSync(courseDir)) walk(courseDir);
  return set;
}

function checkCoverage(map, strings) {
  const missing = [];
  for (const s of strings) {
    if (map[s]) continue;
    let covered = true;
    for (const ch of s) {
      if (/[\u4e00-\u9fff]/.test(ch) && !map[ch]) {
        covered = false;
        break;
      }
    }
    if (!covered) missing.push(s);
  }
  return missing;
}

async function main() {
  const map = await loadPinyinMap();
  const strings = collectStrings();
  const missing = checkCoverage(map, strings);
  if (missing.length === 0) {
    console.log("[check-pinyin] OK: all content covered by pinyinMap");
    process.exit(0);
  }
  console.warn("[check-pinyin] Found", missing.length, "items not fully covered:");
  missing.slice(0, 20).forEach((s) => console.warn("  -", s.length > 40 ? s.slice(0, 40) + "..." : s));
  if (missing.length > 20) console.warn("  ... and", missing.length - 20, "more");
  console.warn("\nRun: npm run build:pinyin");
  process.exit(1);
}

main();
