#!/usr/bin/env node
/**
 * 版本化词库构建脚本
 * - 下载 raw -> 解析 -> 规范化 -> 写入 vocab
 * - 生成 report.json / report.md
 * - 支持 --force 强制重新下载
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { SOURCES, parseRaw } from "./sources.mjs";
import { normalizeEntry, dedupeByHanzi, countMissing } from "./normalize.mjs";
import { buildReport } from "./report.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RAW_DIR = join(ROOT, "data", "raw");
const VOCAB_DIR = join(ROOT, "data", "vocab");
const REPORTS_DIR = join(ROOT, "data", "reports");

const force = process.argv.includes("--force");

function ensureDirs() {
  for (const d of [RAW_DIR, REPORTS_DIR]) {
    mkdirSync(d, { recursive: true });
  }
  for (const v of ["hsk2.0", "hsk3.0"]) {
    mkdirSync(join(VOCAB_DIR, v), { recursive: true });
  }
}

async function fetchOrRead(url, rawPath) {
  if (!force && existsSync(rawPath)) {
    return JSON.parse(readFileSync(rawPath, "utf8"));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const data = await res.json();
  writeFileSync(rawPath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

function buildSpecList() {
  const list = [];
  for (const [version, levels] of Object.entries(SOURCES)) {
    for (const [level, cfg] of Object.entries(levels)) {
      list.push({
        version,
        level,
        ...cfg,
        rawFile: `${version}-${level}.raw.json`,
      });
    }
  }
  return list;
}

async function main() {
  ensureDirs();
  const stats = { files: {}, generatedAt: new Date().toISOString() };
  const specList = buildSpecList();

  for (const spec of specList) {
    const { version, level, url, parse: strategy, rawFile } = spec;
    const rawPath = join(RAW_DIR, rawFile);
    const vocabPath = join(VOCAB_DIR, version, level === "hsk7-9" ? "hsk7-9.json" : `${level}.json`);

    let parsed = [];
    let missing_source = false;

    try {
      const data = await fetchOrRead(url, rawPath);
      parsed = parseRaw(data, strategy);
    } catch (e) {
      console.warn(`[build-vocab] Failed to fetch/parse ${version} ${level}:`, e.message);
      missing_source = true;
      writeFileSync(rawPath, JSON.stringify({ error: e.message, missing: true }, null, 2), "utf8");
    }

    const normalized = parsed
      .map((r, i) => normalizeEntry(r, version, level, i))
      .filter(Boolean);

    const { entries, duplicates } = dedupeByHanzi(normalized);
    const missing = countMissing(entries);

    stats.files[`${version}:${level}`] = {
      version,
      level,
      entries: entries.length,
      missingPinyin: missing.missingPinyin,
      missingZh: missing.missingZh,
      missingEn: missing.missingEn,
      missingKo: missing.missingKo,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 50),
      missing_source,
    };

    writeFileSync(vocabPath, JSON.stringify(entries, null, 2), "utf8");
    console.log(`[build-vocab] ${version}/${level}: ${entries.length} entries`);
  }

  const { jsonPath, mdPath } = buildReport(stats, REPORTS_DIR);
  console.log(`[build-vocab] Report: ${jsonPath}, ${mdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
