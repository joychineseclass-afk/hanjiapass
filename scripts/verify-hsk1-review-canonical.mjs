/**
 * 可复现校验：模拟 HSK1 复习课 canonical 聚合边界（不跑浏览器）。
 * npm run verify:hsk1-review（可选加入 package.json）
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "../data/courses/hsk2.0/hsk1");
const DIST_PATH = join(DIR, "vocab-distribution.json");

function load(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function grammarKey(g) {
  if (!g || typeof g !== "object") return "__g__";
  const p = String(g.pattern || "").trim();
  if (p) return "pat:" + p;
  const t = g.title;
  if (typeof t === "string" && String(t).trim()) return "tit:" + String(t).trim();
  if (t && typeof t === "object")
    return "tit:" + String(t.zh || t.cn || t.kr || t.en || t.ko || "").trim();
  try {
    return "gjson:" + JSON.stringify(g).slice(0, 200);
  } catch {
    return "__g__";
  }
}

function extensionKey(x) {
  if (!x || typeof x !== "object") return "__ex__";
  const k = String(x.phrase || x.zh || x.cn || x.hanzi || x.line || x.text || "").trim();
  if (k) return "ex:" + k;
  try {
    return "exjson:" + JSON.stringify(x).slice(0, 200);
  } catch {
    return "__ex__";
  }
}

function simulateMerge(from, to) {
  const dist = load(DIST_PATH);
  const vocabSeen = new Map();
  const grammarSeen = new Set();
  const extensionSeen = new Set();
  let dialogueCount = 0;
  let grammarCount = 0;
  let extensionCount = 0;

  for (let n = from; n <= to; n++) {
    const path = join(DIR, `lesson${n}.json`);
    const L = load(path);
    const v = Array.isArray(L.vocab) ? L.vocab : [];
    const d = Array.isArray(L.dialogue) ? L.dialogue : [];
    const gArr = Array.isArray(L.grammar) ? L.grammar : [];
    const eArr = Array.isArray(L.extension) ? L.extension : [];

    const bucket = dist.distribution?.["lesson" + n];
    const hanziFromDist = Array.isArray(bucket) ? bucket : null;

    for (const w of v) {
      const key = String(w?.hanzi || w?.word || "").trim();
      if (!key) continue;
      if (!vocabSeen.has(key)) {
        vocabSeen.set(key, n);
      }
    }
    if (v.length === 0 && hanziFromDist) {
      for (const h of hanziFromDist) {
        const key = String(h).trim();
        if (!key) continue;
        if (!vocabSeen.has(key)) vocabSeen.set(key, n);
      }
    }

    dialogueCount += d.length;
    for (const gItem of gArr) {
      const gk = grammarKey(gItem);
      if (grammarSeen.has(gk)) continue;
      grammarSeen.add(gk);
      grammarCount++;
    }
    for (const extItem of eArr) {
      const ek = extensionKey(extItem);
      if (extensionSeen.has(ek)) continue;
      extensionSeen.add(ek);
      extensionCount++;
    }
  }

  return {
    vocabSize: vocabSeen.size,
    dialogueLines: dialogueCount,
    grammarBlocks: grammarCount,
    extensionBlocks: extensionCount,
  };
}

function unionHanziLessons(a, b) {
  const dist = load(DIST_PATH);
  const set = new Set();
  for (let n = a; n <= b; n++) {
    const bucket = dist.distribution?.["lesson" + n];
    if (!Array.isArray(bucket)) continue;
    for (const h of bucket) set.add(String(h).trim());
  }
  return set;
}

function main() {
  const dist = load(DIST_PATH);
  const r21 = dist.reviewRanges?.lesson21;
  const r22 = dist.reviewRanges?.lesson22;
  if (!Array.isArray(r21) || r21[0] !== 1 || r21[1] !== 10) {
    console.error("[verify] reviewRanges.lesson21 应为 [1,10]，当前", r21);
    process.exit(1);
  }
  if (!Array.isArray(r22) || r22[0] !== 11 || r22[1] !== 20) {
    console.error("[verify] reviewRanges.lesson22 应为 [11,20]，当前", r22);
    process.exit(1);
  }

  const m21 = simulateMerge(1, 10);
  const m22 = simulateMerge(11, 20);

  const u110 = unionHanziLessons(1, 10);
  const u1120 = unionHanziLessons(11, 20);

  const L15 = load(join(DIR, "lesson15.json"));
  const marker15 = L15.dialogue?.[0]?.text || "";
  const lesson10 = load(join(DIR, "lesson10.json"));
  const marker10 = lesson10.dialogue?.[0]?.text || "";

  let combinedDialogue21 = "";
  for (let n = 1; n <= 10; n++) {
    const L = load(join(DIR, `lesson${n}.json`));
    for (const line of L.dialogue || []) {
      combinedDialogue21 += String(line.text || "") + "\n";
    }
  }
  let combinedDialogue22 = "";
  for (let n = 11; n <= 20; n++) {
    const L = load(join(DIR, `lesson${n}.json`));
    for (const line of L.dialogue || []) {
      combinedDialogue22 += String(line.text || "") + "\n";
    }
  }

  const leak21 = marker15 && combinedDialogue21.includes(marker15);
  const leak22 = marker10 && combinedDialogue22.includes(marker10);

  console.log(JSON.stringify({
    lesson21: {
      aggregateLessons: "1–10",
      simulatedMerge: m21,
      distributionHanziUnionSize: u110.size,
      heuristicLeakL15FirstLineInto21Merge: leak21,
    },
    lesson22: {
      aggregateLessons: "11–20",
      simulatedMerge: m22,
      distributionHanziUnionSize: u1120.size,
      heuristicLeakL10FirstLineInto22Merge: leak22,
    },
    note: "词表模拟：课内 vocab 为空时用 distribution 该课列表近似 loader；会话/语法/扩展来自 JSON 计数 + 去重规则与 hskLoader 一致",
  }, null, 2));

  if (leak21 || leak22) {
    console.error("[verify] 启发式越界检测失败");
    process.exit(1);
  }
}

main();
