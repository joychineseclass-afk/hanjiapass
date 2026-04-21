/**
 * HSK3.0 · HSK1 最小校验（不修改课程 JSON）
 *
 * 说明：`scripts/check-hsk1-*.mjs` 等仍指向 data/courses/hsk2.0/hsk1；
 * Lumina **HSK 3.0 · 一级** 正式课请以本脚本与 `npm run check:hsk30-hsk1(:strict)` 为准。
 *
 * 覆盖：
 * 1) vocab-distribution 中的词 ⊆ data/vocab/hsk3.0/hsk1.json（hanzi 精确匹配）
 * 2) lesson1～lesson22 基础结构字段
 * 3) lessons.json 目录与单课文件 id / lessonNo 对齐
 *
 * 用法：node scripts/check-hsk30-hsk1.mjs
 * 严格（CI 失败）：node scripts/check-hsk30-hsk1.mjs --strict
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const COURSE_DIR = join(ROOT, "data/courses/hsk3.0/hsk1");
const VOCAB_PATH = join(ROOT, "data/vocab/hsk3.0/hsk1.json");
const LESSONS_INDEX = join(COURSE_DIR, "lessons.json");
const DIST_PATH = join(COURSE_DIR, "vocab-distribution.json");

const strict =
  process.argv.includes("--strict") ||
  String(process.env.STRICT_HSK30_HSK1 || "").trim() === "1";

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function vocabHanziSet(vocabArr) {
  const set = new Set();
  for (const e of vocabArr) {
    const h = String(e?.hanzi ?? "").trim();
    if (h) set.add(h);
  }
  return set;
}

/** 正式词：仅 vocab-distribution.distribution 并集 */
function formalWordSet(distDoc) {
  const set = new Set();
  const d = distDoc?.distribution || {};
  for (const key of Object.keys(d)) {
    const arr = d[key];
    if (!Array.isArray(arr)) continue;
    for (const w of arr) {
      const s = String(w || "").trim();
      if (s) set.add(s);
    }
  }
  return set;
}

const REQUIRED_LESSON_FIELDS = [
  "id",
  "courseId",
  "level",
  "lessonNo",
  "title",
  "dialogueCards",
  "grammar",
  "extension",
  "practice",
];

function collectNonDialogueText(obj, path = "") {
  const texts = [];
  if (obj == null) return texts;
  if (typeof obj === "string") {
    const t = obj.trim();
    if (t) texts.push(t);
    return texts;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      texts.push(...collectNonDialogueText(obj[i], `${path}[${i}]`));
    }
    return texts;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (k === "dialogueCards") continue;
      texts.push(...collectNonDialogueText(v, `${path}.${k}`));
    }
  }
  return texts;
}

function collectDialogueLineTexts(lesson) {
  const texts = [];
  const cards = lesson?.dialogueCards;
  if (!Array.isArray(cards)) return texts;
  for (const c of cards) {
    const lines = c?.lines;
    if (!Array.isArray(lines)) continue;
    for (const line of lines) {
      const zh = String(line?.text ?? line?.zh ?? line?.cn ?? "").trim();
      if (zh) texts.push(zh);
    }
  }
  return texts;
}

function suggestLessonForOrphan(hanzi, lessonsDoc, distDoc, lessonBodies) {
  const targetsHit = [];
  for (const entry of lessonsDoc.lessons || []) {
    const no = Number(entry.lessonNo);
    const targets = entry.vocabTargets || [];
    if (targets.includes(hanzi)) targetsHit.push(no);
  }
  if (targetsHit.length) return { lessonNo: Math.min(...targetsHit), reason: "已列入 lessons.json 该课 vocabTargets" };

  const themeHit = [];
  const themes = distDoc.lessonThemes || {};
  for (const [noStr, theme] of Object.entries(themes)) {
    if (String(theme).includes(hanzi)) themeHit.push(Number(noStr));
  }
  if (themeHit.length) return { lessonNo: Math.min(...themeHit), reason: "与 vocab-distribution.lessonThemes 课名用语重合" };

  for (let no = 1; no <= 22; no++) {
    const L = lessonBodies.get(no);
    if (!L) continue;
    const blob = collectNonDialogueText(L).join("\n");
    if (blob.includes(hanzi))
      return { lessonNo: no, reason: "出现在该课 JSON 非 dialogueCards 字段（如语法/扩展/练习/目标等）" };
  }

  return { lessonNo: null, reason: "课内非会话字段未命中，可能为总表扩展/预备词条，需人工定夺" };
}

function classifyOrphan(hanzi, lessonBodies) {
  let anyNon = false;
  let anyDlg = false;
  for (let no = 1; no <= 22; no++) {
    const L = lessonBodies.get(no);
    if (!L) continue;
    const nonD = collectNonDialogueText(L).join("\n");
    const dlg = collectDialogueLineTexts(L).join("\n");
    if (nonD.includes(hanzi)) anyNon = true;
    if (dlg.includes(hanzi)) anyDlg = true;
  }
  if (anyNon) return "课内非会话字段已出现；若纳入教学可进正式分布";
  if (anyDlg) return "倾向：仅见于会话正文（未进正式分布）";
  return "课内 JSON 未检索到用例（总表扩展/预留）";
}

function main() {
  const errors = [];
  const warnings = [];

  if (!existsSync(COURSE_DIR)) errors.push(`缺少课程目录: ${COURSE_DIR}`);
  if (!existsSync(VOCAB_PATH)) errors.push(`缺少总词表: ${VOCAB_PATH}`);
  if (!existsSync(LESSONS_INDEX)) errors.push(`缺少目录: ${LESSONS_INDEX}`);
  if (!existsSync(DIST_PATH)) errors.push(`缺少分布: ${DIST_PATH}`);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  const vocabArr = loadJson(VOCAB_PATH);
  if (!Array.isArray(vocabArr)) {
    console.error("hsk1.json 应为数组");
    process.exit(1);
  }

  const vocabSet = vocabHanziSet(vocabArr);
  const distDoc = loadJson(DIST_PATH);
  const formal = formalWordSet(distDoc);
  const missingInVocab = [...formal].filter((h) => !vocabSet.has(h)).sort();

  if (missingInVocab.length) {
    const msg = `[P0] distribution 中有 ${missingInVocab.length} 个词不在总表 hanzi 中: ${missingInVocab.join("、")}`;
    if (strict) errors.push(msg);
    else warnings.push(msg);
  }

  const lessonsDoc = loadJson(LESSONS_INDEX);
  const indexList = lessonsDoc.lessons || [];
  if (indexList.length !== 22) warnings.push(`lessons.json 条目数为 ${indexList.length}，预期 22`);

  const lessonBodies = new Map();
  const structureIssues = [];

  for (let n = 1; n <= 22; n++) {
    const filePath = join(COURSE_DIR, `lesson${n}.json`);
    if (!existsSync(filePath)) {
      structureIssues.push(`缺少 lesson${n}.json`);
      continue;
    }
    let L;
    try {
      L = loadJson(filePath);
    } catch (e) {
      structureIssues.push(`lesson${n}.json JSON 解析失败: ${e.message}`);
      continue;
    }
    lessonBodies.set(n, L);

    for (const f of REQUIRED_LESSON_FIELDS) {
      if (!(f in L)) structureIssues.push(`lesson${n}.json 缺少字段: ${f}`);
    }
    if (!Array.isArray(L.dialogueCards) || L.dialogueCards.length === 0)
      structureIssues.push(`lesson${n}.json dialogueCards 应为非空数组`);
    if (!Array.isArray(L.grammar)) structureIssues.push(`lesson${n}.json grammar 应为数组`);
    if (!Array.isArray(L.extension)) structureIssues.push(`lesson${n}.json extension 应为数组`);
    if (!Array.isArray(L.practice)) structureIssues.push(`lesson${n}.json practice 应为数组`);

    const idx = indexList.find((e) => Number(e.lessonNo) === n);
    if (!idx) structureIssues.push(`lessons.json 无 lessonNo=${n} 的目录项`);
    else {
      if (String(idx.id) !== String(L.id))
        structureIssues.push(`lesson${n}: 目录 id「${idx.id}」与文件 id「${L.id}」不一致`);
      if (Number(idx.lessonNo) !== Number(L.lessonNo))
        structureIssues.push(`lesson${n}: 目录 lessonNo 与文件 lessonNo 不一致`);
      const expectedFile = idx.file || `lesson${n}.json`;
      if (expectedFile !== `lesson${n}.json`)
        warnings.push(`lesson${n}: 目录 file=${expectedFile}（非默认命名，请人工确认）`);
    }
  }

  if (structureIssues.length) {
    const block = structureIssues.join("\n  - ");
    if (strict) errors.push(`结构问题:\n  - ${block}`);
    else warnings.push(`结构问题:\n  - ${block}`);
  }

  /** 总表有、正式分布无 */
  const notInFormal = [...vocabSet].filter((h) => !formal.has(h)).sort();

  console.log("=== HSK3.0 · HSK1 最小校验 ===\n");
  console.log(`正式词（distribution 去重）: ${formal.size}`);
  console.log(`总表 hanzi 去重: ${vocabSet.size}`);
  console.log(`distribution ⊆ 总表: ${missingInVocab.length ? "FAIL" : "OK"}`);
  if (missingInVocab.length) {
    console.log(`  缺失: ${missingInVocab.join(", ")}`);
    const bucket = distDoc.distribution || {};
    for (const w of missingInVocab) {
      const lessons = [];
      for (const [k, arr] of Object.entries(bucket)) {
        if (Array.isArray(arr) && arr.includes(w)) lessons.push(k.replace("lesson", "第") + "课");
      }
      console.log(`    · ${w} → 出现在 ${lessons.join("、") || "（未找到 bucket，请查 distribution）"}`);
    }
  }

  console.log(`\n总表未进入正式分布的词数: ${notInFormal.length}`);

  const orphanRows = notInFormal.map((h) => {
    const sug = suggestLessonForOrphan(h, lessonsDoc, distDoc, lessonBodies);
    const cls = classifyOrphan(h, lessonBodies);
    return {
      hanzi: h,
      suggestLessonNo: sug.lessonNo,
      suggestReason: sug.reason,
      usageNote: cls,
    };
  });

  const reportDir = join(ROOT, "data/reports");
  try {
    mkdirSync(reportDir, { recursive: true });
  } catch {}
  const reportPath = join(reportDir, "hsk30-hsk1-vocab-audit.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        formalWordCount: formal.size,
        vocabUniqueCount: vocabSet.size,
        distributionMissingInVocab: missingInVocab,
        orphansNotInFormal: orphanRows,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`详细对照已写入: ${reportPath}`);

  const preview = Math.min(25, orphanRows.length);
  if (preview) {
    console.log(`（控制台预览前 ${preview} 条，全文见报告 JSON）`);
    for (let i = 0; i < preview; i++) {
      const r = orphanRows[i];
      const loc = r.suggestLessonNo != null ? `第${r.suggestLessonNo}课` : "（无自动课次）";
      console.log(`  · ${r.hanzi} → ${loc}；${r.suggestReason}；${r.usageNote}`);
    }
  }

  if (warnings.length) {
    console.log("\n--- warnings ---");
    warnings.forEach((w) => console.log(w));
  }
  if (errors.length) {
    console.log("\n--- errors ---");
    errors.forEach((e) => console.log(e));
    process.exit(1);
  }

  console.log("\n校验结束: OK");
}

main();
