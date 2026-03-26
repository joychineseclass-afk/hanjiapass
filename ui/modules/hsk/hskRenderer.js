// /ui/modules/hsk/hskRenderer.js — Lumina Language Engine v1
// 统一使用 i18n.t() + languageEngine.pick/getContentText，禁止散乱 item.kr/item.en 判断

import { i18n } from "../../i18n.js";
import { pick, getContentText, getLang, getLessonDisplayTitle } from "../../core/languageEngine.js";
import { openStrokeInModal } from "./strokeModal.js";
import { openStrokePlayer } from "../stroke/index.js";
import { resolvePinyin, maybeGetManualPinyin } from "../../utils/pinyinEngine.js";
import { getMeaningByLang, getPosByLang, getWordImageUrl } from "../../utils/wordDisplay.js";

/** 同一 stroke 页路径并发 HEAD 只发一次 */
const _strokeHeadInflight = new Map();

/** 解析笔顺页 URL，避免 /pages/pages/ 重复 */
function resolveStrokeUrl(hanzi) {
  const ch = encodeURIComponent(hanzi || "");
  const inPages = (typeof location !== "undefined" && location.pathname) ? location.pathname.includes("/pages/") : false;
  if (inPages) return `stroke.html?ch=${ch}`; // 相对路径 → /pages/stroke.html
  return `/pages/stroke.html?ch=${ch}`;
}

/** 存在性探测，优先返回可用的 stroke 页路径 */
async function resolveStrokeUrlAsync(hanzi) {
  const ch = encodeURIComponent(hanzi || "");
  const candidates = [];
  if (typeof location !== "undefined" && location.pathname && location.pathname.includes("/pages/")) {
    candidates.push(`stroke.html?ch=${ch}`);
  }
  candidates.push(`/pages/stroke.html?ch=${ch}`, `/stroke.html?ch=${ch}`);

  for (const u of candidates) {
    try {
      const test = u.split("?")[0];
      let headP = _strokeHeadInflight.get(test);
      if (!headP) {
        headP = fetch(test, { method: "HEAD" }).finally(() => {
          if (_strokeHeadInflight.get(test) === headP) _strokeHeadInflight.delete(test);
        });
        _strokeHeadInflight.set(test, headP);
      }
      const r = await headP;
      if (r.ok) return u;
    } catch {}
  }
  return candidates[0] || `/pages/stroke.html?ch=${ch}`;
}

/** 归一化为 wordDisplay/glossary 用：kr|cn|en|jp，兼容 ko/zh */
export function normalizeLang(lang) {
  const l = String(lang != null ? lang : getLang()).toLowerCase();
  if (l === "kr" || l === "ko") return "kr";
  if (l === "cn" || l === "zh") return "cn";
  if (l === "jp" || l === "ja") return "jp";
  if (l === "en") return "en";
  return "kr";
}

export function wordKey(x) {
  if (x == null) return "";
  if (typeof x === "string") return x.trim();
  return String(x.hanzi || x.word || x.zh || x.cn || x.simplified || x.text || "").trim();
}

export function wordPinyin(x) {
  if (x == null || typeof x === "string") return "";
  return String(x.pinyin || x.py || "").trim();
}

/** 将任意词条归一化为 buildWordCard 可用的对象，兼容多数据源字段差异 */
function normalizeWordForCard(x) {
  if (x == null) return null;
  if (typeof x === "string") {
    const t = x.trim();
    return t ? { hanzi: t } : null;
  }
  if (typeof x !== "object") return null;
  const han = wordKey(x) || String(x.simplified || x.trad || "").trim();
  if (!han) return null;
  return { ...x, hanzi: han, pinyin: x.pinyin ?? x.py ?? "" };
}

/** 按系统语言取释义，委托给全站统一的 getMeaningByLang */
export function wordMeaning(x, lang) {
  if (x == null) return "";
  if (typeof x === "string") return "";
  const l = normalizeLang(lang);
  return getMeaningByLang(x, l, wordKey(x) || "");
}

function getLessonListNo(lesson) {
  return Number(lesson?.lessonNo ?? lesson?.no ?? lesson?.id ?? lesson?.lesson ?? lesson?.index ?? 0) || 0;
}

/** 与 page.hsk mergeLessonVocabulary 一致：优先 distribution 的 core/extra */
function mergeListEntryCoreVocab(lesson) {
  if (!lesson) return [];

  const core = Array.isArray(lesson.coreWords)
    ? lesson.coreWords
    : Array.isArray(lesson.distributedWords)
    ? lesson.distributedWords
    : [];

  const extra = Array.isArray(lesson.extraWords) ? lesson.extraWords : [];

  if (core.length === 0 && extra.length === 0) {
    const fallback = lesson.words ?? lesson.originalWords;
    return Array.isArray(fallback) ? fallback : [];
  }

  const seen = new Set();
  const result = [];
  for (const w of [...core, ...extra]) {
    const k = wordKey(w);
    if (k && !seen.has(k)) {
      seen.add(k);
      result.push(w);
    }
  }
  return result;
}

function collectDialogueHanziSet(lessonData) {
  const set = new Set();
  const lines = Array.isArray(lessonData?.dialogue) ? lessonData.dialogue : [];
  for (const line of lines) {
    if (!line || typeof line !== "object") continue;
    const zh = String(line.zh ?? line.cn ?? line.line ?? line.text ?? "").trim();
    if (zh) set.add(zh);
  }
  return set;
}

function stripTrailingDialoguePunct(s) {
  return String(s || "")
    .replace(/[。！？!?\s]+$/g, "")
    .trim();
}

/**
 * 从一句定稿文本得到单个教学短单位（已去句末标点）；含句内逗号/问号片段则丢弃。
 */
function teachingUnitFromSegment(segment) {
  let t = String(segment || "")
    .replace(/[？?！!]+$/g, "")
    .trim();
  t = stripTrailingDialoguePunct(t);
  if (!t) return null;
  if (/[，、,；;？?]/.test(t)) return null;
  const hanCount = Array.from(t).filter((ch) => /[\u4e00-\u9fff]/.test(ch)).length;
  /* 上限 10：覆盖 HSK1 第14/18 课等 9 字问句，仍拒绝冗长段落 */
  if (hanCount < 1 || hanCount > 10) return null;
  if (isLikelyFullSentenceVocab(t, new Set(), false)) return null;
  return { hanzi: t };
}

/** 对无句内逗号的一节按「。」再切（兼容「我叫王明。你呢？」单行） */
function segmentsFromClauseChunk(chunk) {
  const c = String(chunk || "").trim();
  if (!c) return [];
  const parts = c.split(/。/).map((s) => s.trim()).filter(Boolean);
  const pieces = parts.length ? parts : [c];
  const out = [];
  for (const p of pieces) {
    const u = teachingUnitFromSegment(p);
    if (u) out.push(u);
  }
  return out;
}

/**
 * 从定稿 dialogue 一行拆出 0..n 个教学单位：先按 ，、 分句，再按 。 分节；与第1课单行格式兼容，并覆盖第2课起常见「一句多顿号/句号」写法。
 * 仍只使用 dialogue 字段，不读 extension/grammar。
 */
function dialogueLineToTeachingUnits(line) {
  const raw0 = String(line?.zh ?? line?.cn ?? line?.line ?? line?.text ?? "").trim();
  if (!raw0) return [];
  const chunks = raw0.split(/[，、]/).map((s) => s.trim()).filter(Boolean);
  if (!chunks.length) return [];
  const out = [];
  for (const ch of chunks) {
    out.push(...segmentsFromClauseChunk(ch));
  }
  return out;
}

/**
 * 仅从定稿 dialogue 按行顺序抽取教学单位（同行内去重保留先出现顺序）。
 */
function collectDialogueTeachingUnitsInOrder(lessonData) {
  const lines = Array.isArray(lessonData?.dialogue) ? lessonData.dialogue : [];
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    for (const u of dialogueLineToTeachingUnits(line)) {
      const h = wordKey(u);
      if (!h || seen.has(h)) continue;
      seen.add(h);
      out.push({ hanzi: h });
    }
  }
  return out;
}

/**
 * 在「对话教学单位」基础上做受控拆分：
 * - 整单位始终先保留；仅当该单位本身也是本课 vocabTargets 中的「标准教学目标词」时，才允许从中拆出子项。
 * - 子项仍须 ∈ vocabTargets；单字仅拆明确列入的汉字；多字仅拆白名单中的真子串（长度≥2）。
 * - 若对话单位未列入本课目标（仅偶然出现在句中），不拆，避免把白名单当成逐字开关。
 */
function expandDialogueUnitsWithControlledSplit(dialUnits, lessonSplitAllowlist) {
  if (!lessonSplitAllowlist || lessonSplitAllowlist.size === 0) {
    return dialUnits.slice();
  }
  const allow = lessonSplitAllowlist;
  const allowArr = [...allow].filter((t) => typeof t === "string" && String(t).trim());
  const out = [];
  const seen = new Set();

  for (const u of dialUnits) {
    const h = wordKey(u);
    if (!h) continue;
    if (!seen.has(h)) {
      seen.add(h);
      out.push({ hanzi: h });
    }
    if (h.length < 2) continue;

    if (!allow.has(h)) continue;

    const hanChars = Array.from(h).filter((ch) => /[\u4e00-\u9fff]/.test(ch));
    for (const ch of hanChars) {
      if (!allow.has(ch)) continue;
      if (seen.has(ch)) continue;
      seen.add(ch);
      out.push({ hanzi: ch });
    }

    for (const term of allowArr) {
      if (term.length < 2) continue;
      if (term === h) continue;
      if (!h.includes(term)) continue;
      if (seen.has(term)) continue;
      seen.add(term);
      out.push({ hanzi: term });
    }
  }
  return out;
}

/**
 * 普通新课：新单词区仅来自 lesson 定稿 dialogue；用 lesson.vocab 仅做拼音/释义 enrich。
 * 可选 lessonSplitAllowlist：本课 lessons.json vocabTargets；仅当「对话整单位」本身也在该集合中时，才允许向外出单字/子串卡（非逐字开关）。
 * @param {object} lessonData - 归一化后的 lesson
 * @param {Array} lessonVocabForEnrich - 通常为 startLesson 的 vocab 列表
 * @param {Set<string>} priorHanziSet - 前几课已学汉字（同规则派生）
 */
export function deriveRegularLessonPanelWordList(
  lessonData,
  lessonVocabForEnrich,
  priorHanziSet,
  opts = {}
) {
  const { diagnosticLog = true, lessonSplitAllowlist = null } = opts;
  const prior = priorHanziSet instanceof Set ? priorHanziSet : new Set();
  const enrich = Array.isArray(lessonVocabForEnrich) ? lessonVocabForEnrich : [];

  const baseUnits = collectDialogueTeachingUnitsInOrder(lessonData);
  const dialUnits = expandDialogueUnitsWithControlledSplit(baseUnits, lessonSplitAllowlist);
  const dialogueZhs = collectDialogueHanziSet(lessonData);
  const enriched = enrichPanelFromLessonVocab(dialUnits, enrich);

  const out = [];
  const seen = new Set();
  for (const w of enriched) {
    const h = wordKey(w);
    if (!h || seen.has(h)) continue;
    if (prior.has(h)) continue;
    if (isLikelyFullSentenceVocab(h, dialogueZhs, false)) continue;
    seen.add(h);
    out.push(w);
  }

  if (diagnosticLog && typeof console !== "undefined" && console.log) {
    console.log(
      "[HSK-WORD-SOURCE]",
      JSON.stringify({
        phase: "summary",
        baseLayerUsed: "lesson_dialogue_plus_controlled_split",
        lessonNo: Number(lessonData?.lessonNo) || 0,
        counts: {
          panelWordsFinal: out.length,
          dialogueTeachingUnits: baseUnits.length,
          afterControlledSplit: dialUnits.length,
          splitAllowlistSize: lessonSplitAllowlist?.size ?? 0,
          priorHanziExcluded: prior.size,
        },
      })
    );
  }

  return out;
}

/** 用于前几课「已学」集合：与 panel 派生规则一致（不含 prior 互斥） */
export function collectRegularLessonPanelHanziKeys(lessonData, lessonSplitAllowlist) {
  const list = deriveRegularLessonPanelWordList(
    lessonData,
    [],
    new Set(),
    {
      diagnosticLog: false,
      lessonSplitAllowlist: lessonSplitAllowlist || null,
    }
  );
  return new Set(list.map((w) => wordKey(w)).filter(Boolean));
}

function collectPriorLessonHanziSet(courseLessons, currentLessonNo) {
  const set = new Set();
  const cur = Number(currentLessonNo) || 0;
  if (!Array.isArray(courseLessons) || cur <= 1) return set;

  for (const lesson of courseLessons) {
    const no = getLessonListNo(lesson);
    if (no <= 0 || no >= cur) continue;
    for (const w of mergeListEntryCoreVocab(lesson)) {
      const h = wordKey(w);
      if (h) set.add(h);
    }
  }
  return set;
}

function lessonVocabLookupByHanzi(lessonVocabItems) {
  const map = new Map();
  const arr = Array.isArray(lessonVocabItems) ? lessonVocabItems : [];
  for (const x of arr) {
    const h = wordKey(x);
    if (h && !map.has(h)) map.set(h, x);
  }
  return map;
}

function enrichPanelFromLessonVocab(baseList, lessonVocabItems) {
  const byHan = lessonVocabLookupByHanzi(lessonVocabItems);
  return baseList.map((w) => {
    const h = wordKey(w);
    if (!h) return w;
    const full = byHan.get(h);
    return full && typeof full === "object" ? { ...full, ...w } : w;
  });
}

function isLikelyFullSentenceVocab(han, dialogueExactSet, isReviewLesson) {
  if (!han) return true;
  if (dialogueExactSet && dialogueExactSet.has(han)) {
    if (isReviewLesson) return han.length >= 8;
    return true;
  }
  if (/[。！？…]/.test(han)) return true;
  if (isReviewLesson) return han.length > 28;
  if (han.length >= 15) return true;
  const hanCount = Array.from(han).filter((ch) => /[\u4e00-\u9fff]/.test(ch)).length;
  if (hanCount >= 10) return true;
  if (han.includes("，") && hanCount >= 6) return true;
  return false;
}

function classifyListEntryBucket(h, listEntry) {
  if (!listEntry || !h) return null;
  const has = (arr) => Array.isArray(arr) && arr.some((w) => wordKey(w) === h);
  if (has(listEntry.coreWords)) return "listEntry.coreWords";
  if (has(listEntry.distributedWords)) return "listEntry.distributedWords";
  if (has(listEntry.extraWords)) return "listEntry.extraWords";
  const fb = listEntry.words ?? listEntry.originalWords;
  if (has(fb)) return "listEntry.words|originalWords";
  return null;
}

function lessonItemsHasHanzi(items, h) {
  return Array.isArray(items) && items.some((w) => wordKey(w) === h);
}

/**
 * 仅诊断：不改变取词结果
 */
function logHskWordSourceDiagnostics({
  lessonData,
  listEntry,
  lessonNo,
  upstreamField,
  items,
  fromListMerged,
  baseFromList,
  isReview,
  dialogueZhs,
  prior,
  usedRelaxedFallback,
  out,
}) {
  const exprLen = Array.isArray(lessonData?.expressions) ? lessonData.expressions.length : 0;
  const extLen = Array.isArray(lessonData?.extension) ? lessonData.extension.length : 0;
  const listMergeLenAlways = mergeListEntryCoreVocab(listEntry).length;

  console.log(
    "[HSK-WORD-SOURCE]",
    JSON.stringify({
      phase: "summary",
      lessonNo: Number(lessonNo) || 0,
      lessonType: lessonData?.type ?? "",
      isReview,
      upstreamLessonWordsField: upstreamField || "unknown",
      counts: {
        lessonVocabItemsInput: items.length,
        mergeListEntryCoreVocab: fromListMerged.length,
        mergeListEntryCoreVocab_listEntryOnly: listMergeLenAlways,
        lessonDataVocab: Array.isArray(lessonData?.vocab) ? lessonData.vocab.length : 0,
        lessonDataWords: Array.isArray(lessonData?.words) ? lessonData.words.length : 0,
        dialogueLinesForFilter: dialogueZhs.size,
        priorHanziExcludedInStrictPass: prior.size,
        panelWordsFinal: out.length,
        lessonExpressions: exprLen,
        lessonExtensionBlocks: extLen,
      },
      baseLayerUsed: isReview
        ? "review:lessonVocabItems_only"
        : baseFromList
        ? "mergeListEntryCoreVocab(listEntry)"
        : "lessonVocabItems (no list merge)",
      relaxedFallbackPass: usedRelaxedFallback,
      pipelineNotes: [
        "dialogue|expressions|extension are not merged into vocab inside selectHskWordPanelVocabulary",
        "cross_lesson set is prior lessons mergeListEntryCoreVocab only; used to drop tokens in strict pass",
      ],
    })
  );

  const byHan = lessonVocabLookupByHanzi(items);
  for (const w of out) {
    const h = wordKey(w);
    if (!h) continue;
    const listBucket = classifyListEntryBucket(h, listEntry);
    const inInputItems = lessonItemsHasHanzi(items, h);
    const enrichedFromLessonJson = inInputItems && !!(byHan.get(h) && typeof byHan.get(h) === "object");

    let primaryTrack = "unknown";
    if (isReview) {
      primaryTrack = inInputItems ? "lessonVocabItems.review_vocab" : "review_item_not_in_input?";
    } else if (baseFromList) {
      primaryTrack = listBucket || "list_merge_order_but_unclassified";
    } else {
      primaryTrack = upstreamField || "lessonVocabItems.fallback_no_list";
    }

    console.log(
      "[HSK-WORD-SOURCE]",
      JSON.stringify({
        phase: "word",
        hanzi: h,
        primaryTrack,
        listEntryBucket: listBucket,
        inLessonVocabItems: inInputItems,
        metadataEnrichedFromLessonJson: enrichedFromLessonJson,
        strictVsRelaxed: usedRelaxedFallback ? "relaxed_rebuild_skipped_prior_filter" : "strict_pass",
        renderTarget: "renderWordCards(panelWords)",
      })
    );
  }
}

/**
 * HSK 学习页「单词区」：优先本课教学目标词（目录项 core/extra），去掉会话整句与前几课已学词；复习课保留复习逻辑。
 */
export function selectHskWordPanelVocabulary(lessonVocabItems, ctx = {}) {
  const { lessonData, listEntry, courseLessons, lessonNo, upstreamField } = ctx;
  const items = Array.isArray(lessonVocabItems) ? lessonVocabItems : [];

  if (!lessonData) return items;

  const isReview = String(lessonData.type || "") === "review";
  const dialogueZhs = collectDialogueHanziSet(lessonData);
  const prior = isReview ? new Set() : collectPriorLessonHanziSet(courseLessons, lessonNo);

  const fromListMerged = !isReview ? mergeListEntryCoreVocab(listEntry) : [];
  let base;
  let baseFromList = false;
  if (isReview) {
    base = items;
  } else {
    base = fromListMerged.length ? fromListMerged : items;
    baseFromList = fromListMerged.length > 0;
  }

  const enriched = enrichPanelFromLessonVocab(base, items);
  const out = [];
  const seen = new Set();

  for (const w of enriched) {
    const h = wordKey(w);
    if (!h || seen.has(h)) continue;
    if (!isReview && prior.has(h)) continue;
    if (isLikelyFullSentenceVocab(h, dialogueZhs, isReview)) continue;
    seen.add(h);
    out.push(w);
  }

  let usedRelaxedFallback = false;
  if (!out.length && !isReview && items.length) {
    usedRelaxedFallback = true;
    const seen2 = new Set();
    for (const w of enriched) {
      const h = wordKey(w);
      if (!h || seen2.has(h)) continue;
      if (isLikelyFullSentenceVocab(h, dialogueZhs, false)) continue;
      seen2.add(h);
      out.push(w);
    }
  }

  logHskWordSourceDiagnostics({
    lessonData,
    listEntry,
    lessonNo,
    upstreamField,
    items,
    fromListMerged,
    baseFromList,
    isReview,
    dialogueZhs,
    prior,
    usedRelaxedFallback,
    out,
  });

  return out;
}

export function renderLessonList(containerEl, lessons, { lang, currentLessonNo = 0 } = {}) {
  if (!containerEl) return;
  const list = Array.isArray(lessons) ? lessons : [];
  const arrow = "›";
  const displayLang = normalizeLang(lang ?? getLang());

  const rows = list.map((it) => {
    const lessonNo = Number(it.lessonNo || it.no || it.lesson || it.id || 0) || 0;
    const file = it.file || it.path || it.url || "";

    const titleDisplay = getLessonDisplayTitle(it, displayLang) || "-";

    const lessonNoFormatted = i18n.t("hsk.lesson_no_format", { n: lessonNo });
    const isActive = currentLessonNo > 0 && lessonNo === currentLessonNo;

    return `
      <button class="hsk-directory-row${isActive ? " is-active" : ""}"
        data-open-lesson="1"
        data-lesson-no="${lessonNo}"
        data-file="${escapeHtmlAttr(file)}"
        ${isActive ? ' aria-current="true"' : ""}
      >
        <span class="hsk-directory-no">${lessonNo || ""}</span>
        <span class="hsk-directory-title">${escapeHtml(lessonNoFormatted)} / ${escapeHtml(titleDisplay)}</span>
        <span class="hsk-directory-arrow">${arrow}</span>
      </button>
    `;
  }).join("");

  const emptyMsg = i18n.t("hsk.empty_lessons");
  containerEl.innerHTML = `<div class="hsk-directory-rows">${rows || `<div class="hsk-directory-empty">${escapeHtml(emptyMsg)}</div>`}</div>`;
}

/** 构建单个词卡 HTML（与课程单词页相同组件） */
function buildWordCard(x, { currentLang, glossaryScope } = {}) {
  try {
    const normalized = normalizeWordForCard(x);
    if (!normalized) return "";
    const raw = normalized;
    const han = wordKey(raw) || String(raw.hanzi || raw.han || raw.word || raw.zh || raw.cn || raw.simplified || raw.trad || "").trim();
    let pinyinStr = wordPinyin(raw);
    if (!pinyinStr && han) pinyinStr = resolvePinyin(han, pinyinStr);

    let mainStr = getMeaningByLang(raw, currentLang, han, glossaryScope);
    if (mainStr && mainStr.includes("object Object")) mainStr = "";
    if (!mainStr) mainStr = i18n.t("hsk.meaning_empty");

    const posStr = getPosByLang(raw, currentLang, glossaryScope);

    const learnLabel = i18n.t("action.learn");
    const strokeLabel = i18n.t("action.trace");
    const audioLabel = i18n.t("action.speak");
    const strokeDisabled = !han ? " disabled" : "";
    const hanziChars = han ? Array.from(han).map((ch) =>
      `<span class="word-hanzi-char" data-char="${escapeHtmlAttr(ch)}" data-word="${escapeHtmlAttr(han)}" role="button" tabindex="0">${escapeHtml(ch)}</span>`
    ).join("") : escapeHtml(han);

    const imgUrl = getWordImageUrl(raw);
    const imgHtml = imgUrl
      ? `<img class="word-card-image" src="${escapeHtmlAttr(imgUrl)}" alt="${escapeHtmlAttr(han)}" loading="lazy" onerror="this.style.display='none'" />`
      : "";

    return `
    <div class="word-card lesson-vocab-card lesson-card" data-word-hanzi="${escapeHtmlAttr(han)}">
      ${imgHtml}
      <div class="word-hanzi">${hanziChars}</div>
      <div class="word-pinyin">${escapeHtml(pinyinStr)}</div>
      ${posStr ? `<div class="word-pos text-sm opacity-75">${escapeHtml(posStr)}</div>` : ""}
      <div class="word-meaning">
        <div class="word-meaning-main">${escapeHtml(mainStr)}</div>
      </div>
      <div class="word-actions">
        <button type="button" class="btn btn-learn" data-action="learn" data-hanzi="${escapeHtmlAttr(han)}">${escapeHtml(learnLabel)}</button>
        <button type="button" class="btn btn-stroke" data-action="stroke" data-hanzi="${escapeHtmlAttr(han)}"${strokeDisabled}>${escapeHtml(strokeLabel)}</button>
        <button type="button" class="btn btn-audio" data-action="speak" data-hanzi="${escapeHtmlAttr(han)}" data-pinyin="${escapeHtmlAttr(pinyinStr)}">${escapeHtml(audioLabel)}</button>
      </div>
    </div>
  `;
  } catch (e) {
    console.warn("[buildWordCard] failed for item:", x, e);
    return `<div class="word-card" style="border:1px solid #fecaca;color:#dc2626;"><div class="word-meaning">Error rendering word</div></div>`;
  }
}

export function renderWordCards(gridEl, items, onClickWord, { lang, scope } = {}) {
  if (!gridEl) return;
  const arr = Array.isArray(items) ? items : [];
  const currentLang = normalizeLang(lang ?? getLang());
  const glossaryScope = scope || "";

  const cards = arr.map((x) => buildWordCard(x, { currentLang, glossaryScope }));

  const hero = `<section class="lesson-section-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.words"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.vocab_subtitle"))}</p>
  ${arr.length ? '<span class="lesson-section-count">' + escapeHtml(i18n.t("hsk.vocab_count", { n: arr.length })) + "</span>" : ""}
</section>`;
  gridEl.innerHTML = `<div class="lesson-vocab-wrap">${hero}<div class="lesson-card-grid word-grid">${cards.join("")}</div></div>`;

  if (typeof window !== "undefined") {
    window.__HSK_WORD_ITEMS_BY_HANZI = window.__HSK_WORD_ITEMS_BY_HANZI || new Map();
    arr.forEach((x) => {
      const h = wordKey(x);
      if (h) window.__HSK_WORD_ITEMS_BY_HANZI.set(h, x);
    });
    window.__HSK_ON_CLICK_WORD = typeof onClickWord === "function" ? onClickWord : null;
  }

  bindWordCardActions();
}

/** 复习课紧凑行：汉字、拼音、释义，无按钮 */
function buildReviewCompactRow(x, { currentLang, glossaryScope } = {}) {
  const raw = typeof x === "string" ? { hanzi: x.trim() } : (x || {});
  const han = wordKey(raw) || String(raw.hanzi || raw.word || raw.zh || "").trim();
  if (!han) return "";
  let pinyinStr = wordPinyin(raw);
  if (!pinyinStr && han) pinyinStr = resolvePinyin(han, pinyinStr);
  let meaningStr = getMeaningByLang(raw, currentLang, han, glossaryScope);
  if (meaningStr && meaningStr.includes("object Object")) meaningStr = "";
  if (!meaningStr) meaningStr = i18n.t("hsk.meaning_empty");
  const speakText = han || pinyinStr;
  const dataSpeak = speakText ? ` data-speak-text="${escapeHtmlAttr(speakText)}"` : "";
  return `<div class="review-compact-row"${dataSpeak} role="button" tabindex="0">
  <span class="review-compact-hanzi">${escapeHtml(han)}</span>
  <span class="review-compact-pinyin">${escapeHtml(pinyinStr)}</span>
  <span class="review-compact-meaning">${escapeHtml(meaningStr)}</span>
</div>`;
}

/**
 * 复习课专用：紧凑布局（每词一行，便于快速扫读）
 * - 有 wordsByLesson 时：按来源课程分组，每组紧凑列表
 * - 无 wordsByLesson 时：扁平紧凑列表（兼容旧逻辑）
 * 数据仍使用完整课程词汇（core+extra），仅 UI 改为紧凑模式
 */
export function renderReviewWords(gridEl, items, { lang, scope, wordsByLesson } = {}) {
  if (!gridEl) return;
  const arr = Array.isArray(items) ? items : [];
  const currentLang = normalizeLang(lang ?? getLang());
  const glossaryScope = scope || "";

  let bodyHtml = "";
  const allItems = [];

  if (wordsByLesson && typeof wordsByLesson === "object" && Object.keys(wordsByLesson).length > 0) {
    const keys = Object.keys(wordsByLesson).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    const sections = keys.map((lessonKey) => {
      const raw = wordsByLesson[lessonKey];
      const words = Array.isArray(raw) ? raw.filter((w) => w != null) : [];
      const no = Number(lessonKey) || 0;
      const lessonLabel = i18n.t("hsk.lesson_no_format", { n: no }) || `第${no}课`;
      const validWords = words.map((w) => (typeof w === "string" ? { hanzi: w.trim() } : w)).filter((w) => w && (w.hanzi || w.word || w.zh));
      if (typeof console !== "undefined" && console.debug) {
        console.debug(`[ReviewWords] lesson ${no} count: ${validWords.length}`);
        console.debug(`[ReviewWords] lesson ${no} source: core+extra`);
        if (validWords.length > 0 && (no === 1 || no === 2 || no === 3 || no === 4)) {
          console.debug(`[ReviewWords] lesson ${no} first item:`, validWords[0]);
        }
      }
      const rows = validWords.map((x) => {
        allItems.push(x);
        return buildReviewCompactRow(x, { currentLang, glossaryScope });
      }).filter(Boolean).join("");
      return `<section class="review-lesson-group">
  <h4 class="review-lesson-group-title">${escapeHtml(lessonLabel)}</h4>
  <div class="review-compact-list">${rows}</div>
</section>`;
    }).filter(Boolean).join("");
    bodyHtml = `<div class="review-words-by-lesson">${sections}</div>`;
  } else {
    const validArr = arr.filter((w) => w != null).map((w) => (typeof w === "string" ? { hanzi: w.trim() } : w)).filter((w) => w && (wordKey(w) || (w.hanzi || w.word || w.zh)));
    const rows = validArr.map((x) => buildReviewCompactRow(x, { currentLang, glossaryScope })).filter(Boolean);
    allItems.push(...validArr);
    bodyHtml = `<div class="review-compact-list">${rows.join("")}</div>`;
  }

  const totalCount = allItems.length;
  const hero = `<section class="lesson-section-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.words"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_words_subtitle") || "复习课词汇列表")}</p>
  ${totalCount ? '<span class="lesson-section-count">' + escapeHtml(i18n.t("hsk.vocab_count", { n: totalCount })) + "</span>" : ""}
</section>`;
  gridEl.innerHTML = `<div class="lesson-vocab-wrap review-vocab-wrap">${hero}${bodyHtml}</div>`;

  if (typeof window !== "undefined") {
    window.__HSK_WORD_ITEMS_BY_HANZI = window.__HSK_WORD_ITEMS_BY_HANZI || new Map();
    allItems.forEach((x) => {
      const h = wordKey(x);
      if (h) window.__HSK_WORD_ITEMS_BY_HANZI.set(h, x);
    });
  }
  bindWordCardActions();
}

let _wordCardBound = false;

/** 文档级事件委托，确保 rerender 后点击仍有效 */
export function bindWordCardActions() {
  if (_wordCardBound) return;
  _wordCardBound = true;

  document.addEventListener("click", async (e) => {
    const reviewRow = e.target.closest(".review-dialogue-row, .review-extension-row, .review-compact-row");
    if (reviewRow) {
      const text = (reviewRow.dataset?.speakText || "").trim();
      if (text) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const { AUDIO_ENGINE } = await import("../../platform/index.js");
          if (AUDIO_ENGINE?.playText) {
            AUDIO_ENGINE.stop();
            AUDIO_ENGINE.playText(text, { lang: "zh-CN", rate: 0.95 });
          }
        } catch (err) {
          console.warn("[AUDIO] review speak failed:", err);
        }
      }
      return;
    }

    const card = e.target.closest(".word-card");
    if (!card) return;

    const charSpan = e.target.closest(".word-hanzi-char");
    if (charSpan) {
      e.preventDefault();
      e.stopPropagation();
      const char = (charSpan.dataset.char || "").trim();
      const wordId = (charSpan.dataset.word || "").trim();
      if (!char) return;
      const lessonId = (window.__HSK_PAGE_CTX && window.__HSK_PAGE_CTX.lessonNo) || window.__HSK_CURRENT_LESSON_ID || "";
      try {
        await openStrokePlayer(char, {
          ctx: { from: "hsk", lessonId, wordId },
        });
      } catch (err) {
        console.warn("[stroke] openStrokePlayer failed:", err);
      }
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const hanzi = (btn.dataset.hanzi || "").trim();
    const pinyin = (btn.dataset.pinyin || "").trim();

    if (!hanzi && action !== "learn") return;
    if (action === "stroke" && btn.disabled) return;

    if (action === "speak" || action === "audio") {
      e.preventDefault();
      e.stopPropagation();
      const text = hanzi || pinyin || "";
      if (!text) return;
      try {
        const { AUDIO_ENGINE } = await import("../../platform/index.js");
        if (!(AUDIO_ENGINE && typeof AUDIO_ENGINE.isSpeechSupported === "function" && AUDIO_ENGINE.isSpeechSupported())) {
          if (typeof console !== "undefined" && console.warn) console.warn("[AUDIO] speechSynthesis not supported");
          return;
        }
        AUDIO_ENGINE.stop();
        document.querySelectorAll(".word-card.is-speaking").forEach((c) => c.classList.remove("is-speaking"));
        const cardEl = btn.closest(".word-card");
        if (cardEl) cardEl.classList.add("is-speaking");
        AUDIO_ENGINE.playText(text, {
          lang: "zh-CN",
          rate: 0.95,
          onEnd: function() { if (cardEl) cardEl.classList.remove("is-speaking"); },
          onError: function() { if (cardEl) cardEl.classList.remove("is-speaking"); },
        });
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) console.warn("[AUDIO] speak failed:", err);
      }
    }

    if (action === "stroke") {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("btn-stroke-active");
      const ctx = {
        version: (window.__HSK_PAGE_CTX && window.__HSK_PAGE_CTX.version) || (typeof localStorage !== "undefined" ? localStorage.getItem("hsk_vocab_version") : null) || "hsk2.0",
        level: (window.__HSK_PAGE_CTX && window.__HSK_PAGE_CTX.level) != null ? window.__HSK_PAGE_CTX.level : 1,
        lessonId: (window.__HSK_PAGE_CTX && window.__HSK_PAGE_CTX.lessonNo) || window.__HSK_CURRENT_LESSON_ID || "",
        wordId: hanzi,
      };
      try {
        await openStrokeInModal(hanzi, ctx);
      } catch (err) {
        console.warn("[Stroke] modal failed, fallback to new tab:", err);
        const { resolveStrokeUrl, buildReturnParams } = await import("./strokeModal.js");
        const baseUrl = resolveStrokeUrl(hanzi);
        const sep = baseUrl.includes("?") ? "&" : "?";
        window.open(`${baseUrl}${sep}${buildReturnParams(ctx)}`, "_blank", "noopener");
      } finally {
        setTimeout(() => btn.classList.remove("btn-stroke-active"), 200);
      }
    }

    if (action === "learn") {
      e.preventDefault();
      e.stopPropagation();
      const map = window.__HSK_WORD_ITEMS_BY_HANZI;
      const item = (map && typeof map.get === "function" ? map.get(hanzi) : null) || { hanzi: hanzi, pinyin: pinyin };
      const fn = window.__HSK_ON_CLICK_WORD;
      if (typeof fn === "function") fn(item);
      else if (window.LEARN_PANEL && typeof window.LEARN_PANEL.open === "function") window.LEARN_PANEL.open(item);
    }
  });
}

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#96;");
}

/** 复习课会话：简洁列表，每条 中文 | 拼音 | 释义 */
export function renderReviewDialogue(containerEl, cards, { lang } = {}) {
  if (!containerEl) return;
  const list = Array.isArray(cards) ? cards : [];
  const l = normalizeLang(lang ?? getLang());
  const hero = `<section class="lesson-section-hero lesson-dialogue-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_dialogue_subtitle") || "复习课主要会话")}</p>
</section>`;
  if (!list.length) {
    containerEl.innerHTML = `${hero}<div class="lesson-empty-state">${i18n.t("hsk.empty_dialogue")}</div>`;
    return;
  }
  
 const dialogLang = normalizeLang(lang ?? getLang());

const pickTrans = (line, lang) => {
  if (!line || typeof line !== "object") return "";
  return line.translation?.[lang] || "";
};

const rows = [];
for (const card of list) {
  const lines = Array.isArray(card?.lines) ? card.lines : [];
  for (const line of lines) {
    const zh = String((line?.text ?? line?.zh ?? line?.cn ?? line?.line ?? "")).trim();
    const py = String((line?.pinyin ?? line?.py ?? "")).trim();
    const trans = pickTrans(line, "ko");
      if (!zh) continue;
      const pyResolved = py || resolvePinyin(zh, "");
      const zhEsc = escapeHtml(zh).replaceAll('"', "&quot;");
      rows.push(`<div class="review-dialogue-row" data-speak-text="${zhEsc}" data-speak-kind="dialogue">
  <span class="review-dialogue-zh">${escapeHtml(zh)}</span>
  <span class="review-dialogue-pinyin">${escapeHtml(pyResolved)}</span>
  <span class="review-dialogue-trans">${escapeHtml(trans)}</span>
  <button type="button" class="review-dialogue-speak" data-speak-text="${zhEsc}">🔊</button>
</div>`);
    }
  }
  containerEl.innerHTML = `${hero}<div class="review-dialogue-list">${rows.join("")}</div>`;
}

/**
 * 复习课专用：语法点 list-style 渲染（一条一条纵向列表，紧凑讲义式）
 * 内容顺序：pattern → pinyin → meaning → explain → example → examplePinyin → exampleMeaning
 */
function renderReviewGrammarRows(grammarArr, { lang, vocab = [] } = {}) {
  const arr = Array.isArray(grammarArr) ? grammarArr : [];
  const l = normalizeLang(lang ?? getLang());
  const vocabList = Array.isArray(vocab) ? vocab : [];
  const vocabByHanzi = new Map();
  vocabList.forEach((v) => {
    const h = (v?.hanzi ?? v?.word ?? "").trim();
    if (h) vocabByHanzi.set(h, v);
  });

  const pickByLang = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    const keys = l === "kr" ? ["kr", "ko"] : l === "cn" ? ["zh", "cn"] : l === "jp" ? ["jp", "ja"] : ["en"];
    for (const k of keys) {
      const v = obj[k];
      if (v && typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  const getExpl = (g) => {
    const ex = g?.explain ?? g?.explanation;
    if (ex && typeof ex === "object") return pickByLang(ex);
    const flatByLang = { kr: g?.explanation_kr ?? g?.explanationKr, zh: g?.explanation_zh ?? g?.explanationZh, en: g?.explanation_en ?? g?.explanationEn, jp: g?.explanation_jp ?? g?.explanationJp };
    return pickByLang(flatByLang);
  };
  const getExampleZh = (g) => {
    const ex = g?.example ?? g?.examples;
    if (Array.isArray(ex)) return ex.map((e) => (e?.zh ?? e?.cn ?? e?.line ?? e) || "").filter(Boolean)[0] || "";
    if (ex && typeof ex === "object") return (ex.zh ?? ex.cn ?? ex.line ?? "") || "";
    return typeof ex === "string" ? ex : "";
  };
  const getExamplePinyin = (g) => {
    const py = g?.examplePinyin;
    if (typeof py === "string" && py.trim()) return py.trim();
    const ex = g?.example ?? g?.examples;
    const first = Array.isArray(ex) ? ex[0] : ex;
    if (first && typeof first === "object") return String(first?.pinyin ?? first?.py ?? "").trim();
    return "";
  };
  const getExampleMeaning = (g) => {
    const em = g?.exampleMeaning;
    if (em && typeof em === "object") return pickByLang(em);
    if (typeof em === "string") return em.trim() || "";
    const ex = g?.example ?? g?.examples;
    const first = Array.isArray(ex) ? ex[0] : ex;
    if (first && typeof first === "object") {
      const trans = first.translation;
      if (trans && typeof trans === "object") return pickByLang(trans);
      return pickByLang(first);
    }
    return "";
  };
  const getMeaningFromVocab = (hanzi) => {
    const v = vocabByHanzi.get(hanzi);
    if (!v) return "";
    const m = v?.meaning;
    if (m && typeof m === "object") return (m[l] ?? m.kr ?? m.ko ?? m.en ?? m.zh ?? "") || "";
    return "";
  };

  return arr.map((g, i) => {
    const rawPattern = String(g?.pattern ?? g?.title ?? g?.name ?? "").trim() || "#" + (i + 1);
    const patternParts = rawPattern.split(/[—–\-]\s*/);
    const hanziPart = (patternParts[0] || rawPattern).trim();
    const meaningFromPattern = (patternParts[1] || "").trim();
    const pattern = hanziPart;
    const keyForVocab = hanziPart.replace(/\s*[\+\-].*$/, "").trim() || hanziPart.slice(0, 1);
    let meaning = "";
    if (meaningFromPattern) meaning = meaningFromPattern;
    else if (g?.meaning) meaning = typeof g.meaning === "object" ? pickByLang(g.meaning) : String(g.meaning).trim();
    else if (g?.category) meaning = typeof g.category === "object" ? pickByLang(g.category) : String(g.category).trim();
    else meaning = getMeaningFromVocab(keyForVocab);

    let pinyin = "";
    const grammarPinyin = String(g?.pinyin ?? g?.py ?? "").trim();
    if (grammarPinyin) {
      pinyin = grammarPinyin.split(/[—–\-]\s*/)[0]?.trim() || grammarPinyin;
    } else {
      const manualPy = maybeGetManualPinyin(g, "grammarTitle");
      if (hanziPart && manualPy) pinyin = manualPy;
      else if (hanziPart) pinyin = resolvePinyin(hanziPart, "");
    }

    const expl = getExpl(g);
    const exZh = getExampleZh(g);
    const exPinyin = getExamplePinyin(g);
    const exMeaning = getExampleMeaning(g);
    const zhEsc = escapeHtml(hanziPart).replaceAll('"', "&quot;");

    return `<div class="review-grammar-row">
  <div class="review-grammar-pattern" data-speak-text="${zhEsc}" data-speak-kind="grammar">${escapeHtml(pattern)}</div>
  ${pinyin ? `<div class="review-grammar-pinyin">${escapeHtml(pinyin)}</div>` : ""}
  ${meaning ? `<div class="review-grammar-meaning">${escapeHtml(meaning)}</div>` : ""}
  ${expl ? `<div class="review-grammar-explain">${escapeHtml(expl)}</div>` : ""}
  ${exZh ? `<div class="review-grammar-example">${escapeHtml(exZh)}</div>` : ""}
  ${exPinyin ? `<div class="review-grammar-example-pinyin">${escapeHtml(exPinyin)}</div>` : ""}
  ${exMeaning ? `<div class="review-grammar-example-meaning">${escapeHtml(exMeaning)}</div>` : ""}
</div>`;
  }).join("");
}

/** 复习课语法：list-style 纵向列表，紧凑讲义式，仅影响 type===review 的 lesson */
export function renderReviewGrammar(containerEl, grammarArr, { lang, vocab = [] } = {}) {
  if (!containerEl) return;
  const arr = Array.isArray(grammarArr) ? grammarArr : [];

  const hero = `<section class="lesson-section-hero lesson-grammar-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.grammar_title"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_grammar_subtitle") || "复习课语法点")}</p>
</section>`;
  if (!arr.length) {
    containerEl.innerHTML = `${hero}<div class="lesson-grammar-empty">${i18n.t("hsk.empty_grammar")}</div>`;
    return;
  }

  const rowsHtml = renderReviewGrammarRows(arr, { lang, vocab });
  containerEl.innerHTML = `${hero}<div class="review-grammar-list">${rowsHtml}</div>`;
}

/** 复习课扩展：紧凑列表，中文 | 拼音 | 释义 */
export function renderReviewExtension(containerEl, extArr, { lang } = {}) {
  if (!containerEl) return;
  const arr = Array.isArray(extArr) ? extArr : [];
  const l = normalizeLang(lang ?? getLang());
  const hero = `<section class="lesson-section-hero lesson-extension-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.section.extension") || i18n.t("hsk.extension_title"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_extension_subtitle") || "复习课扩展表达")}</p>
</section>`;
  if (!arr.length) {
    containerEl.innerHTML = `${hero}<div class="lesson-extension-empty">${i18n.t("hsk.extension_empty")}</div>`;
    return;
  }
  const getExpl = (item) => {
    const ex = item?.explain ?? item?.explanation;
    if (ex && typeof ex === "object") return (ex[l] ?? ex.kr ?? ex.ko ?? ex.en ?? ex.zh ?? "") || "";
    return "";
  };
  const rows = arr.map((item) => {
    const phrase = String((item?.phrase ?? item?.hanzi ?? item?.zh ?? item?.cn ?? "")).trim();
    const pinyin = String((item?.pinyin ?? item?.py ?? "")).trim();
    const expl = getExpl(item);
    if (!phrase) return "";
    const zhEsc = escapeHtml(phrase).replaceAll('"', "&quot;");
    return `<div class="review-extension-row" data-speak-text="${zhEsc}">
  <span class="review-extension-zh">${escapeHtml(phrase)}</span>
  <span class="review-extension-pinyin">${escapeHtml(pinyin)}</span>
  <span class="review-extension-meaning">${escapeHtml(expl)}</span>
  <button type="button" class="review-extension-speak" data-speak-text="${zhEsc}">🔊</button>
</div>`;
  }).filter(Boolean);
  containerEl.innerHTML = `${hero}<div class="review-extension-list">${rows.join("")}</div>`;
}
