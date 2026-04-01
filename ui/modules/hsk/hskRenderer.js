// /ui/modules/hsk/hskRenderer.js — Lumina Language Engine v1
// 统一使用 i18n.t() + languageEngine.pick/getContentText，禁止散乱 item.kr/item.en 判断

import { i18n } from "../../i18n.js";
import { getContentText, getLang, getLessonDisplayTitle } from "../../core/languageEngine.js";
import { openStrokeInModal } from "./strokeModal.js";
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

/** 与 hskLoader.normalizeVocabHanziKey 一致：面板 enrich 与课内 vocab 按去尾标点键对齐 */
export function normalizeVocabHanziKeyForPanel(h) {
  const s = String(h ?? "").trim();
  if (!s) return "";
  return s.replace(/[\s\u3002\uFF01\uFF0C\uFF1F\uFF1A\uFF1B!?,。；：]+$/u, "");
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
  const walkLine = (line) => {
    if (!line || typeof line !== "object") return;
    const zh = String(line.zh ?? line.cn ?? line.line ?? line.text ?? "").trim();
    if (zh) set.add(zh);
  };
  const lines = Array.isArray(lessonData?.dialogue) ? lessonData.dialogue : [];
  for (const item of lines) {
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item.lines) && item.lines.length) {
      for (const line of item.lines) walkLine(line);
    } else {
      walkLine(item);
    }
  }
  return set;
}

function countCjkChars(s) {
  return Array.from(String(s || "")).filter((ch) => /[\u4e00-\u9fff]/.test(ch)).length;
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

/** @param {string[]|Set<string>|null|undefined} allowlist */
function coerceTargetsOrder(allowlist) {
  if (!allowlist) return [];
  const seq =
    allowlist instanceof Set
      ? [...allowlist]
      : Array.isArray(allowlist)
      ? allowlist
      : [];
  const out = [];
  const seen = new Set();
  for (const t of seq) {
    const s = typeof t === "string" ? t.trim() : String(t || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
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
  const ordered = coerceTargetsOrder(lessonSplitAllowlist);
  if (!ordered.length) {
    return dialUnits.slice();
  }
  const allow = new Set(ordered);
  const allowArr = ordered;
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
 * 普通课单词面板（lesson1~20）：
 * - 显示集合唯一来源：panelWordsFromLoader（上游由 distribution -> loader 收口后的结果）
 * - 渲染层不再猜测 lessonData.vocab / lessonData.words 等字段
 * - 仅做稳定去重与最小兜底，不再做二次过滤
 * - lesson 元数据补充发生在 loader 阶段；本函数不以元数据存在与否作为显示门槛
 */
export function deriveRegularLessonPanelWordList(
  lessonData,
  panelWordsFromLoader,
  priorHanziSet,
  opts = {}
) {
  const { diagnosticLog = true } = opts;
  const upstream = Array.isArray(panelWordsFromLoader) ? panelWordsFromLoader : [];

  const out = [];
  const seen = new Set();
  for (const w of upstream) {
    const h = wordKey(w);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    if (typeof w === "string") {
      out.push({
        hanzi: h,
        word: h,
        pinyin: "",
        meaning: { ko: "", en: "", zh: h },
      });
      continue;
    }
    out.push(w && typeof w === "object" ? w : { hanzi: h, word: h });
  }

  if (diagnosticLog && typeof console !== "undefined" && console.log) {
    console.log(
      "[HSK-WORD-SOURCE]",
      JSON.stringify({
        phase: "summary",
        baseLayerUsed: "distribution_upstream_no_secondary_filter",
        lessonNo: Number(lessonData?.lessonNo) || 0,
        counts: {
          panelWordsFinal: out.length,
          upstreamItems: upstream.length,
        },
      })
    );
  }

  return out;
}

/** 从普通课正式输入（panelWordsFromLoader）提取汉字键；不做任何字段猜测。 */
export function collectRegularLessonPanelHanziKeys(panelWordsFromLoader) {
  const list = deriveRegularLessonPanelWordList(null, panelWordsFromLoader, new Set(), {
    diagnosticLog: false,
  });
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
    if (!h) continue;
    const norm = normalizeVocabHanziKeyForPanel(h);
    if (norm && !map.has(norm)) map.set(norm, x);
    if (h !== norm && !map.has(h)) map.set(h, x);
  }
  return map;
}

function enrichPanelFromLessonVocab(baseList, lessonVocabItems) {
  const byHan = lessonVocabLookupByHanzi(lessonVocabItems);
  return baseList.map((w) => {
    const h = wordKey(w);
    if (!h) return w;
    const norm = normalizeVocabHanziKeyForPanel(h);
    const full = byHan.get(norm) || byHan.get(h);
    return full && typeof full === "object" ? { ...full, ...w } : w;
  });
}

function isLikelyFullSentenceVocab(han, dialogueExactSet, isReviewLesson) {
  if (!han) return true;
  const t = String(han).trim();
  const cjk = countCjkChars(t);

  if (isReviewLesson) {
    if (/[。！？…]/.test(t)) return true;
    if (/[，、；：]/.test(t) && cjk >= 4) return true;
    if (cjk >= 6) return true;
    if (t.length > 28) return true;
    if (dialogueExactSet && dialogueExactSet.has(t)) {
      if (/[。！？…，、；：]/.test(t)) return true;
      if (cjk >= 7) return true;
      return false;
    }
    return false;
  }

  if (dialogueExactSet && dialogueExactSet.has(t)) return true;
  if (/[。！？…]/.test(t)) return true;
  if (t.length > 28) return true;
  if (t.length >= 15) return true;
  if (cjk >= 10) return true;
  if (t.includes("，") && cjk >= 6) return true;
  return false;
}

/**
 * 复习课合并 vocab 后剔除「整句/表达条」：供 hskLoader 在无 distribution 时兜底，及面板逻辑共用同一标准。
 * @param {unknown[]} vocabList
 * @param {object} lessonData - 需含 dialogue / dialogueCards（可与合并后课程一致）
 */
export function filterMergedVocabForReviewLesson(vocabList, lessonData) {
  const arr = Array.isArray(vocabList) ? vocabList : [];
  const dz = collectDialogueHanziSet(lessonData || {});
  const out = [];
  const seen = new Set();
  for (const w of arr) {
    const h = wordKey(w);
    if (!h || seen.has(h)) continue;
    if (isLikelyFullSentenceVocab(h, dz, true)) continue;
    seen.add(h);
    out.push(w);
  }
  return out;
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
    if (lessonNo >= 1 && lessonNo <= 3) {
      try {
        console.log("[HSK-TITLE-DIAG]", {
          phase: "renderLessonList",
          lessonNo,
          engineGetLang: getLang(),
          normalizedLangForList: displayLang,
          title: it?.title ?? null,
          displayTitle: it?.displayTitle ?? null,
          titleJp: it?.title?.jp ?? it?.title?.ja ?? null,
          hasTitleJp: !!String(it?.title?.jp ?? it?.title?.ja ?? "").trim(),
          displayTitleType:
            typeof it?.displayTitle === "string"
              ? "string"
              : it?.displayTitle && typeof it.displayTitle === "object"
                ? "object"
                : typeof it?.displayTitle,
          picked: titleDisplay,
          lessonsDataSource:
            typeof window !== "undefined" ? window.__HSK_LESSONS_DATA_SOURCE__ : "",
          source: {
            file,
            hasBlueprintTitle: it?.blueprintTitle != null,
            hasOriginalTitle: it?.originalTitle != null,
          },
        });
      } catch {}
    }

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

    const strokeLabel = i18n.t("action.trace");
    const speakAria = i18n.t("action.speak");
    const strokeDisabled = !han ? " disabled" : "";
    const speakIconSvg = `<svg class="word-speak-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07M17.83 6.17a8 8 0 010 11.66"/></svg>`;
    const wordSpeakHtml = han
      ? `<button type="button" class="word-speak-zone" data-speak-text="${escapeHtmlAttr(han)}" aria-label="${escapeHtmlAttr(`${speakAria} ${han}`)}"><span class="word-hanzi">${escapeHtml(han)}</span><span class="word-speak-icon">${speakIconSvg}</span></button>`
      : `<div class="word-hanzi word-hanzi--empty">${escapeHtml(han)}</div>`;

    const imgUrl = getWordImageUrl(raw);
    const imgHtml = imgUrl
      ? `<img class="word-card-image" src="${escapeHtmlAttr(imgUrl)}" alt="${escapeHtmlAttr(han)}" loading="lazy" onerror="this.style.display='none'" />`
      : "";

    return `
    <div class="word-card lesson-vocab-card lesson-card" data-word-hanzi="${escapeHtmlAttr(han)}">
      ${imgHtml}
      ${wordSpeakHtml}
      <div class="word-pinyin">${escapeHtml(pinyinStr)}</div>
      ${posStr ? `<div class="word-pos text-sm opacity-75">${escapeHtml(posStr)}</div>` : ""}
      <div class="word-meaning">
        <div class="word-meaning-main">${escapeHtml(mainStr)}</div>
      </div>
      <div class="word-actions">
        <button type="button" class="btn btn-stroke" data-action="open-stroke" data-hanzi="${escapeHtmlAttr(han)}"${strokeDisabled}>${escapeHtml(strokeLabel)}</button>
      </div>
    </div>
  `;
  } catch (e) {
    console.warn("[buildWordCard] failed for item:", x, e);
    return `<div class="word-card" style="border:1px solid #fecaca;color:#dc2626;"><div class="word-meaning">Error rendering word</div></div>`;
  }
}

export function renderWordCards(gridEl, items, _onClickWord, opts = {}) {
  if (!gridEl) return;
  const { lang, scope } = opts;
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

  bindWordCardActions();
}

/** 复习课紧凑行：与课内复习 tab 同一套 hsk-lr-* / lesson-review-item 结构 */
function buildReviewCompactRow(x, { currentLang, glossaryScope } = {}) {
  const raw = typeof x === "string" ? { hanzi: x.trim() } : (x || {});
  const han = wordKey(raw) || String(raw.hanzi || raw.word || raw.zh || "").trim();
  if (!han) return "";
  let pinyinStr = wordPinyin(raw);
  if (!pinyinStr && han) pinyinStr = resolvePinyin(han, pinyinStr);
  let meaningStr = getMeaningByLang(raw, currentLang, han, glossaryScope);
  if (meaningStr && meaningStr.includes("object Object")) meaningStr = "";
  if (!meaningStr) meaningStr = i18n.t("hsk.meaning_empty");
  const posStr = getPosByLang(raw, currentLang, glossaryScope) || "";
  const sep = ` <span class="hsk-lr-sep">/</span> `;
  let inner = `<span class="hsk-lr-line-zh">${escapeHtml(han)}</span>`;
  if (pinyinStr) inner += ` <span class="hsk-lr-pinyin">${escapeHtml(pinyinStr)}</span>`;
  if (posStr) inner += `${sep}<span class="hsk-lr-pos">${escapeHtml(posStr)}</span>`;
  inner += `${sep}<span class="hsk-lr-mean">${escapeHtml(meaningStr)}</span>`;
  const zhEsc = escapeHtmlAttr(han);
  return `<li class="lesson-review-item review-item hsk-lr-compact" role="listitem" tabindex="0" data-speak-text="${zhEsc}" data-speak-kind="dialogue">${inner}</li>`;
}

/**
 * 复习课专用：紧凑布局（每词一行，便于快速扫读）
 * - 有 wordsByLesson 时：按来源课程分组，每组紧凑列表
 * - 无 wordsByLesson 时：扁平紧凑列表（兼容旧逻辑）
 * 数据仍使用完整课程词汇（core+extra），仅 UI 改为紧凑模式
 */
export function renderReviewWords(gridEl, items, opts = {}) {
  const { lang, scope, wordsByLesson } = opts;
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
  <div class="hsk-review-compact-dir"><ul class="hsk-lesson-review-list review-list" role="list">${rows}</ul></div>
</section>`;
    }).filter(Boolean).join("");
    bodyHtml = `<div class="review-words-by-lesson">${sections}</div>`;
  } else {
    const validArr = arr.filter((w) => w != null).map((w) => (typeof w === "string" ? { hanzi: w.trim() } : w)).filter((w) => w && (wordKey(w) || (w.hanzi || w.word || w.zh)));
    const rows = validArr.map((x) => buildReviewCompactRow(x, { currentLang, glossaryScope })).filter(Boolean);
    allItems.push(...validArr);
    bodyHtml = `<div class="hsk-review-compact-dir"><ul class="hsk-lesson-review-list review-list" role="list">${rows.join("")}</ul></div>`;
  }

  const totalCount = allItems.length;
  const hero = `<section class="lesson-section-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.words"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_words_subtitle") || "复习课词汇列表")}</p>
  ${totalCount ? '<span class="lesson-section-count">' + escapeHtml(i18n.t("hsk.vocab_count", { n: totalCount })) + "</span>" : ""}
</section>`;
  gridEl.innerHTML = `<div class="lesson-vocab-wrap review-vocab-wrap">${hero}${bodyHtml}</div>`;

  bindWordCardActions();
}

let _wordCardBound = false;

async function playWordCardSpeak(text, cardEl) {
  const t = String(text || "").trim();
  if (!t) return;
  try {
    const { AUDIO_ENGINE } = await import("../../platform/index.js");
    if (!(AUDIO_ENGINE && typeof AUDIO_ENGINE.isSpeechSupported === "function" && AUDIO_ENGINE.isSpeechSupported())) {
      if (typeof console !== "undefined" && console.warn) console.warn("[AUDIO] speechSynthesis not supported");
      return;
    }
    AUDIO_ENGINE.stop();
    document.querySelectorAll(".word-card.is-speaking").forEach((c) => c.classList.remove("is-speaking"));
    if (cardEl) cardEl.classList.add("is-speaking");
    AUDIO_ENGINE.playText(t, {
      lang: "zh-CN",
      rate: 0.95,
      onEnd: function() { if (cardEl) cardEl.classList.remove("is-speaking"); },
      onError: function() { if (cardEl) cardEl.classList.remove("is-speaking"); },
    });
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) console.warn("[AUDIO] word speak failed:", err);
  }
}

/** 文档级事件委托，确保 rerender 后点击仍有效 */
export function bindWordCardActions() {
  if (_wordCardBound) return;
  _wordCardBound = true;

  document.addEventListener("click", async (e) => {
    const reviewRow = e.target.closest(
      ".review-dialogue-row, .review-extension-row, .review-compact-row, .lesson-review-item[data-speak-text]"
    );
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

    const speakZone = e.target.closest(".word-speak-zone");
    if (speakZone && card.contains(speakZone)) {
      e.preventDefault();
      e.stopPropagation();
      const text = (speakZone.dataset.speakText || "").trim();
      await playWordCardSpeak(text, card);
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const hanzi = (btn.dataset.hanzi || "").trim();

    if (!hanzi) return;
    if (action === "open-stroke" && btn.disabled) return;

    if (action === "open-stroke") {
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

function normalizeReviewDialogueDedupeKey(zh) {
  return String(zh || "")
    .trim()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[。！？!.?\s]+$/g, "");
}

function collectFlatDialogueLinesForReview(lessonData) {
  const raw = lessonData?._raw || lessonData;
  const arr =
    raw && Array.isArray(raw.generatedDialogues) && raw.generatedDialogues.length
      ? raw.generatedDialogues
      : raw && Array.isArray(raw.structuredDialogues) && raw.structuredDialogues.length
        ? raw.structuredDialogues
        : raw && Array.isArray(raw.dialogueCards) && raw.dialogueCards.length
          ? raw.dialogueCards
          : raw && Array.isArray(raw.dialogue) && raw.dialogue.length
            ? raw.dialogue
            : [];
  if (!arr.length) return [];
  const out = [];
  const walkLine = (line) => {
    if (!line || typeof line !== "object") return;
    const zh = String(line.text ?? line.zh ?? line.cn ?? line.line ?? "").trim();
    if (!zh) return;
    const pinyin = String(line.pinyin ?? line.py ?? "").trim();
    out.push({ zh, pinyin, line });
  };
  const first = arr[0];
  const isCard = first && first.lines && Array.isArray(first.lines);
  const isLine =
    first &&
    (first.speaker != null ||
      first.spk != null ||
      first.cn != null ||
      first.zh != null ||
      first.text != null);
  if (isCard) {
    for (const card of arr) {
      const lines = Array.isArray(card?.lines) ? card.lines : [];
      for (const line of lines) walkLine(line);
    }
  } else if (isLine) {
    for (const line of arr) walkLine(line);
  }
  return out;
}

/**
 * 复习课对话区：扁平抽取全部台词 → 归一化 key 去重 → 紧凑目录行（无 A/B、无角色、无情景卡标题）。
 * 去重与抽取逻辑见 collectFlatDialogueLinesForReview + normalizeReviewDialogueDedupeKey。
 */
export function buildDedupedReviewDialogueLines(lessonData, lang) {
  const l = normalizeLang(lang ?? getLang());
  const flat = collectFlatDialogueLinesForReview(lessonData || {});
  const pickTrans = (line) => {
    if (!line || typeof line !== "object") return "";
    const tr = line.translation || line.translations;
    if (tr && typeof tr === "object") {
      const keys = l === "kr" ? ["kr", "ko"] : l === "cn" ? ["zh", "cn"] : l === "jp" ? ["jp", "ja"] : ["en"];
      for (const k of keys) {
        const v = tr[k];
        if (v && typeof v === "string" && v.trim()) return v.trim();
      }
    }
    return "";
  };
  const seen = new Set();
  const out = [];
  for (const row of flat) {
    const k = normalizeReviewDialogueDedupeKey(row.zh);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const py = row.pinyin || resolvePinyin(row.zh, "");
    out.push({ zh: row.zh, pinyin: py, trans: pickTrans(row.line) });
  }
  return out;
}

/** 复习课会话：与单词区同一套紧凑目录列表（第二参数为整课 lessonData，非 cards 数组） */
export function renderReviewDialogue(containerEl, lessonData, { lang } = {}) {
  if (!containerEl) return;
  const l = normalizeLang(lang ?? getLang());
  const lines = buildDedupedReviewDialogueLines(lessonData || {}, l);
  const hero = `<section class="lesson-section-hero lesson-dialogue-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_dialogue_subtitle") || "复习课主要会话")}</p>
</section>`;
  if (!lines.length) {
    containerEl.innerHTML = `${hero}<div class="lesson-empty-state">${i18n.t("hsk.empty_dialogue")}</div>`;
    return;
  }
  const sep = ` <span class="hsk-lr-sep">/</span> `;
  const lis = lines.map((row) => {
    const zhEsc = escapeHtmlAttr(row.zh);
    const inner = `<span class="hsk-lr-line-zh">${escapeHtml(row.zh)}</span> <span class="hsk-lr-pinyin">${escapeHtml(row.pinyin)}</span>${sep}<span class="hsk-lr-mean">${escapeHtml(row.trans)}</span>`;
    return `<li class="lesson-review-item review-item hsk-lr-compact review-dialogue-compact" role="listitem" tabindex="0" data-speak-text="${zhEsc}" data-speak-kind="dialogue">${inner}</li>`;
  });
  containerEl.innerHTML = `${hero}<div class="hsk-review-compact-dir dialogue-review-compact"><ul class="hsk-lesson-review-list review-list" role="list">${lis.join("")}</ul></div>`;
}

/** 复习课语法：单行一条（句型加粗 / 拼音 / 释义·说明），与单词、对话区同一紧凑目录样式 */
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
  const getMeaningFromVocab = (hanzi) => {
    const v = vocabByHanzi.get(hanzi);
    if (!v) return "";
    const m = v?.meaning;
    if (m && typeof m === "object") return (m[l] ?? m.kr ?? m.ko ?? m.en ?? m.zh ?? "") || "";
    return "";
  };

  const sep = ` <span class="hsk-lr-sep">/</span> `;
  return arr
    .map((g, i) => {
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
      const tail = [meaning, expl].filter(Boolean).join(" · ");
      const zhEsc = escapeHtmlAttr(pattern);
      let inner = `<span class="hsk-lr-line-zh">${escapeHtml(pattern)}</span>`;
      if (pinyin) inner += ` <span class="hsk-lr-pinyin">${escapeHtml(pinyin)}</span>`;
      if (tail) inner += `${sep}<span class="hsk-lr-mean">${escapeHtml(tail)}</span>`;
      return `<li class="lesson-review-item review-item hsk-lr-compact review-grammar-compact" role="listitem" tabindex="0" data-speak-text="${zhEsc}" data-speak-kind="grammar">${inner}</li>`;
    })
    .join("");
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
  containerEl.innerHTML = `${hero}<div class="hsk-review-compact-dir grammar-review-compact"><ul class="hsk-lesson-review-list review-list" role="list">${rowsHtml}</ul></div>`;
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
    const translation = item.translation?.[l] || "";
    return translation;
  };
  const sep = ` <span class="hsk-lr-sep">/</span> `;
  const rows = arr
    .map((item) => {
      const phrase = String((item?.phrase ?? item?.hanzi ?? item?.zh ?? item?.cn ?? "")).trim();
      const pinyin = String((item?.pinyin ?? item?.py ?? "")).trim();
      const expl = getExpl(item);
      if (!phrase) return "";
      const zhEsc = escapeHtmlAttr(phrase);
      let inner = `<span class="hsk-lr-line-zh">${escapeHtml(phrase)}</span>`;
      if (pinyin) inner += ` <span class="hsk-lr-pinyin">${escapeHtml(pinyin)}</span>`;
      inner += `${sep}<span class="hsk-lr-mean">${escapeHtml(expl)}</span>`;
      return `<li class="lesson-review-item review-item hsk-lr-compact review-extension-compact" role="listitem" tabindex="0" data-speak-text="${zhEsc}" data-speak-kind="extension">${inner}</li>`;
    })
    .filter(Boolean);
  containerEl.innerHTML = `${hero}<div class="hsk-review-compact-dir extension-review-compact"><ul class="hsk-lesson-review-list review-list" role="list">${rows.join("")}</ul></div>`;
}
