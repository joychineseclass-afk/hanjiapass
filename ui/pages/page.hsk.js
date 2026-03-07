// /ui/pages/page.hsk.js ✅ FINAL (Study Tabs)
// ✅ Clean HSK page: no mountGlobalComponents()
// ✅ Directory <-> Study mode
// ✅ Study Tabs: words/dialogue/grammar/ai

import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { ensureHSKDeps } from "../modules/hsk/hskDeps.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";
import { renderLessonList, renderWordCards, bindWordCardActions, wordKey, wordPinyin, wordMeaning, normalizeLang } from "../modules/hsk/hskRenderer.js";
import { resolvePinyin, maybeGetManualPinyin, shouldShowPinyin } from "../utils/pinyinEngine.js";
import { loadGlossary } from "../utils/glossary.js";
import { LESSON_ENGINE, AI_CAPABILITY, mountPractice, IMAGE_ENGINE, SCENE_ENGINE, PROGRESS_ENGINE, PROGRESS_SELECTORS, TTS_ENGINE } from "../platform/index.js";
import * as SceneRenderer from "../platform/scene/sceneRenderer.js";

const state = {
  lv: 1,
  version: "hsk2.0",
  lessons: [],
  current: null,        // { lessonNo, file, lessonData, lessonWords }
  tab: "words",         // words | dialogue | grammar | practice | ai
};

function getLang() {
  return normalizeLang(i18n?.getLang?.()); // ko | zh | en
}

function getCourseId() {
  return `${state.version}_hsk${state.lv}`;
}

function $(id) { return document.getElementById(id); }

function updateProgressBlock() {
  const el = $("hskProgressText");
  if (!el) return;
  const courseId = getCourseId();
  const total = state.lessons?.length ?? 0;
  const stats = PROGRESS_SELECTORS?.getCourseStats?.(courseId, total) ?? {};
  const { completedLessonCount, dueReviewCount, lastLessonNo, lastActivityAt } = stats;
  const parts = [];
  parts.push(total > 0 ? `已完成 ${completedLessonCount} / ${total} 课` : "—");
  if (lastLessonNo > 0) parts.push(`当前第 ${lastLessonNo} 课`);
  if (dueReviewCount > 0) parts.push(`待复习 ${dueReviewCount} 词`);
  if (lastActivityAt > 0) {
    const d = new Date(lastActivityAt);
    parts.push(`最近 ${d.toLocaleDateString()}`);
  }
  el.textContent = parts.join(" · ");
}

function setError(msg = "") {
  const err = $("hskError");
  if (!err) return;
  if (!msg) { err.classList.add("hidden"); err.textContent = ""; return; }
  err.classList.remove("hidden");
  err.textContent = msg;
}

function setSubTitle() {
  const el = $("hskSubTitle");
  if (!el) return;
  el.textContent = `HSK ${state.lv} · ${state.version}`;
}

function showStudyMode(titleText = "") {
  $("hskLessonListWrap")?.classList.add("hidden");
  $("hskStudyBar")?.classList.remove("hidden");
  $("hskStudyPanels")?.classList.remove("hidden");
  if ($("hskStudyTitle")) $("hskStudyTitle").textContent = titleText || "";
}

function showListMode() {
  $("hskStudyBar")?.classList.add("hidden");
  $("hskStudyPanels")?.classList.add("hidden");

  $("hskLessonListWrap")?.classList.remove("hidden");

  // clear panels
  $("hskPanelWords") && ($("hskPanelWords").innerHTML = "");
  $("hskDialogueBody") && ($("hskDialogueBody").innerHTML = "");
  $("hskGrammarBody") && ($("hskGrammarBody").innerHTML = "");
  $("hskPracticeBody") && ($("hskPracticeBody").innerHTML = "");
  $("hskAIResult") && ($("hskAIResult").innerHTML = "");
  $("hskAIContext")?.classList.add("hidden");
  $("hskSceneSection") && ($("hskSceneSection").innerHTML = "") && $("hskSceneSection").classList.add("hidden");

  state.current = null;
  state.tab = "words";
  updateTabsUI();
}

function updateTabsUI() {
  const ids = [
    ["words", "hskTabWords", "hskPanelWords"],
    ["dialogue", "hskTabDialogue", "hskPanelDialogue"],
    ["grammar", "hskTabGrammar", "hskPanelGrammar"],
    ["practice", "hskTabPractice", "hskPanelPractice"],
    ["ai", "hskTabAI", "hskPanelAI"],
  ];

  ids.forEach(([tab, btnId, panelId]) => {
    const btn = $(btnId);
    const panel = $(panelId);
    const active = state.tab === tab;

    btn?.classList.toggle("active", active);
    // simple active style without CSS dependency
    if (btn) {
      btn.style.background = active ? "rgba(34,197,94,0.10)" : "";
      btn.style.borderColor = active ? "rgba(34,197,94,0.55)" : "";
    }

    if (!panel) return;
    panel.classList.toggle("hidden", !active);
  });
}

/** 按系统语言取对话翻译。KR: kr/ko, CN: zh, EN: en，缺失时回退 */
function pickDialogueTranslation(line, lang, zhMain = "") {
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const t = line?.translation;
  let out = "";
  if (lang === "ko") out = str(line?.kr ?? line?.ko ?? t?.kr ?? t?.ko ?? line?.zh ?? line?.cn);
  else if (lang === "en") out = str(line?.en ?? t?.en ?? line?.zh ?? line?.cn);
  else out = str(line?.zh ?? line?.cn ?? t?.zh ?? line?.kr ?? line?.ko ?? line?.en);
  if (out && zhMain && out === zhMain) return "";
  return out;
}

/** 取会话标题：card.title[currentLang] 或 card.title.zh，否则生成 会话1/会话2 */
function pickCardTitle(obj, lang, cardIndex = 1) {
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  if (obj != null) {
    if (typeof obj === "string") return str(obj);
    const key = lang === "ko" ? "kr" : (lang === "en" ? "en" : "zh");
    const v = str(obj[key] ?? obj.zh ?? obj.cn ?? obj.kr ?? obj.ko ?? obj.en);
    if (v) return v;
  }
  const n = String(cardIndex);
  if (lang === "ko") return `회화 ${n}`;
  if (lang === "en") return `Dialogue ${n}`;
  return `会话${n}`;
}

/** 统一获取会话卡片：优先 dialogueCards，否则兼容 dialogue（嵌套/扁平） */
function getDialogueCards(lesson) {
  if (Array.isArray(lesson?.dialogueCards) && lesson.dialogueCards.length) {
    return lesson.dialogueCards;
  }

  if (Array.isArray(lesson?.dialogue) && lesson.dialogue.length) {
    const first = lesson.dialogue[0];
    if (first && first.lines && Array.isArray(first.lines)) {
      return lesson.dialogue;
    }
    return [{ title: null, lines: lesson.dialogue }];
  }

  return [];
}

/** 渲染单条对话行，输出完整 HTML（lesson-dialogue-line / lesson-dialogue-speaker / lesson-dialogue-zh / lesson-dialogue-pinyin / lesson-dialogue-translation） */
function renderDialogueLine(line, lang, showPinyin) {
  const spk = String(line?.spk ?? line?.speaker ?? "").trim();
  const zh = String(line?.zh ?? line?.cn ?? line?.line ?? "").trim();
  let py = maybeGetManualPinyin(line, "dialogue");
  if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
  const trans = pickDialogueTranslation(line, lang, zh);

  const zhAttrs = zh ? ` data-speak-text="${escapeHtml(zh).replaceAll('"', "&quot;")}" data-speak-kind="dialogue"` : "";
  return `<article class="lesson-dialogue-line">
  ${spk ? `<div class="lesson-dialogue-speaker">${escapeHtml(spk)}</div>` : ""}
  <div class="lesson-dialogue-zh"${zhAttrs}>${escapeHtml(zh)}</div>
  ${py ? `<div class="lesson-dialogue-pinyin">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="lesson-dialogue-translation">${escapeHtml(trans)}</div>` : ""}
</article>`;
}

/** 对话渲染：优先 dialogueCards，回退 dialogue；每张卡单独渲染，不合并。lessonData 可能为归一化对象，需用 _raw 取原始 dialogueCards */
function buildDialogueHTML(lessonData) {
  const raw = lessonData?._raw ?? lessonData;
  const cards = getDialogueCards(raw);
  if (!cards.length) return `<div class="lesson-dialogue-empty">${i18n.t("hsk_empty_dialogue", {})}</div>`;

  const lang = getLang();
  if (SCENE_ENGINE?.hasScene?.(lessonData)) {
    const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);
    const framesHtml = SceneRenderer.renderSceneFrames(scene, lessonData, lang);
    if (framesHtml) return framesHtml;
  }

  const showPinyin = shouldShowPinyin({ level: lessonData?.level, version: lessonData?.version });

  return `<div class="lesson-dialogue-list">
${cards.map((card, index) => {
  const lines = Array.isArray(card?.lines) ? card.lines : [];
  if (!lines.length) return "";
  const titleText = pickCardTitle(card?.title, lang, index + 1);
  const lineHtml = lines.map((line) => renderDialogueLine(line, lang, showPinyin)).join("");
  return `  <section class="lesson-dialogue-card">
    <h4 class="lesson-dialogue-card-title">${escapeHtml(titleText)}</h4>
    <div class="lesson-dialogue-lines">${lineHtml}</div>
  </section>`;
}).filter(Boolean).join("\n")}
</div>`;
}

/** 语法：取当前语言解释，缺失时 kr -> en -> zh 回退 */
function pickGrammarExplanation(pt, lang) {
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const kr = str(pt?.explanation_kr ?? pt?.kr ?? pt?.ko);
  const en = str(pt?.explanation_en ?? pt?.en);
  const zh = str(pt?.explanation_zh ?? pt?.zh ?? pt?.cn);
  if (lang === "ko") return kr || en || zh;
  if (lang === "en") return en || kr || zh;
  return zh || kr || en;
}

/** 语法：取例句，兼容 example 为字符串或 {zh, pinyin, kr, en} */
function pickGrammarExample(pt, lang) {
  const ex = pt?.example ?? pt?.examples;
  if (!ex) return { zh: "", pinyin: "", trans: "" };
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  if (typeof ex === "string") return { zh: ex, pinyin: "", trans: "" };
  const zh = str(ex?.zh ?? ex?.cn ?? ex?.line);
  const pinyin = str(ex?.pinyin ?? ex?.py);
  const kr = str(ex?.kr ?? ex?.ko);
  const en = str(ex?.en);
  let trans = "";
  if (lang === "ko") trans = kr || en || str(ex?.zh ?? ex?.cn);
  else if (lang === "en") trans = en || kr || str(ex?.zh ?? ex?.cn);
  else trans = str(ex?.zh ?? ex?.cn) || kr || en;
  return { zh, pinyin, trans };
}

/** 语法渲染：教学型结构化 HTML。每个 item：编号+标题 / 拼音 / 解释 / 例句块 */
function buildGrammarHTML(lessonData) {
  const g = lessonData?.grammar;
  if (!g) return `<div class="hsk-grammar-empty text-sm opacity-70">${i18n.t("hsk_empty_grammar", {})}</div>`;

  const lang = getLang();
  const arr = Array.isArray(g) ? g : (Array.isArray(g?.points) ? g.points : []);
  if (!arr.length) return `<div class="hsk-grammar-empty text-sm opacity-70">${i18n.t("hsk_empty_grammar", {})}</div>`;

  const showPinyin = shouldShowPinyin({ level: lessonData?.level, version: lessonData?.version });
  const exLabel = lang === "ko" ? "예문" : lang === "zh" ? "例句" : "Example";

  const blocks = [];
  for (let i = 0; i < arr.length; i++) {
    const pt = arr[i];
    const titleZh = typeof pt?.title === "object"
      ? (pt.title?.zh ?? pt.title?.kr ?? pt.title?.en ?? "")
      : (pt?.title ?? pt?.name ?? pt?.pattern ?? `#${i + 1}`);
    let titlePy = maybeGetManualPinyin(pt, "grammarTitle");
    if (showPinyin && titleZh && !titlePy) titlePy = resolvePinyin(titleZh, titlePy);

    const expl = pickGrammarExplanation(pt, lang);
    const ex = pickGrammarExample(pt, lang);
    let exPy = ex.pinyin;
    if (showPinyin && ex.zh && !exPy) exPy = resolvePinyin(ex.zh, exPy);

    blocks.push(`
<article class="hsk-grammar-item border border-slate-200 rounded-xl p-5 mb-4 last:mb-0 bg-white">
  <div class="hsk-grammar-title text-base font-bold text-slate-800 mb-1">${i + 1}. ${escapeHtml(titleZh)}</div>
  ${titlePy ? `<div class="hsk-grammar-title-pinyin text-sm italic text-slate-600 mb-2">${escapeHtml(titlePy)}</div>` : ""}
  ${expl ? `<div class="hsk-grammar-explanation text-sm text-slate-700 mb-4">${escapeHtml(expl)}</div>` : ""}
  ${ex.zh ? `
  <div class="hsk-grammar-example mt-3 pt-4 border-t border-slate-100 bg-slate-50/80 rounded-lg p-4">
    <div class="hsk-grammar-example-label text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">${escapeHtml(exLabel)}：</div>
    <div class="hsk-grammar-example-zh text-base font-semibold text-slate-800">${escapeHtml(ex.zh)}</div>
    ${exPy ? `<div class="hsk-grammar-example-pinyin text-sm italic text-slate-600 mt-1">${escapeHtml(exPy)}</div>` : ""}
    ${ex.trans ? `<div class="hsk-grammar-example-trans text-sm text-slate-600 mt-2 opacity-90">${escapeHtml(ex.trans)}</div>` : ""}
  </div>
  ` : ""}
</article>`);
  }
  return `<div class="hsk-grammar-list">${blocks.join("")}</div>`;
}

function buildAIContext() {
  if (!state.current?.lessonData) return "";
  const lang = getLang();
  const ld = state.current.lessonData;
  const no = state.current.lessonNo;

  const titleObj = state.lessons?.find(x => Number(x.lessonNo) === Number(no))?.title;
  const title = titleObj ? stringifyMaybe(titleObj) : "";

  const words = Array.isArray(state.current.lessonWords) ? state.current.lessonWords : [];
  const wordsLine = words.slice(0, 12).map(w => {
    const han = wordKey(w);
    const py = wordPinyin(w);
    const mean = wordMeaning(w, lang);
    return `${han}${py ? `(${py})` : ""}${mean ? `: ${mean}` : ""}`;
  }).join("\n");

  return [
    `Lesson ${no}`,
    title ? `Title: ${title}` : "",
    wordsLine ? `Words:\n${wordsLine}` : "",
    "",
    "질문(Question):",
  ].filter(Boolean).join("\n");
}

/** 获取 vocab-distribution.json：distribution 键顺序 + lessonThemes 主题标题
 *  返回 { order: string[], lessonThemes: Record<string, string> } 或 null */
const _vocabDistCache = new Map();
async function getVocabDistribution(lv, version) {
  const key = `${version}:hsk${lv}`;
  if (_vocabDistCache.has(key)) return _vocabDistCache.get(key);
  const base = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  const root = base ? base + "/" : "/";
  const url = `${root}data/courses/${version}/hsk${lv}/vocab-distribution.json`;
  try {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) return null;
    const data = await res.json();
    const dist = data?.distribution;
    const order = dist && typeof dist === "object" ? Object.keys(dist) : null;
    const lessonThemes = data?.lessonThemes && typeof data.lessonThemes === "object" ? data.lessonThemes : null;
    const out = { order, lessonThemes };
    _vocabDistCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

/** 按 vocab-distribution 的 distribution 键顺序排序课程 */
function sortLessonsByDistributionOrder(lessons, order) {
  if (!Array.isArray(lessons) || !Array.isArray(order) || order.length === 0) return lessons;
  const idxMap = new Map(order.map((k, i) => [k, i]));
  return [...lessons].sort((a, b) => {
    const noA = Number(a?.lessonNo ?? a?.lesson ?? a?.id ?? a?.no ?? 0) || 0;
    const noB = Number(b?.lessonNo ?? b?.lesson ?? b?.id ?? b?.no ?? 0) || 0;
    const keyA = noA ? `lesson${noA}` : "";
    const keyB = noB ? `lesson${noB}` : "";
    const iA = idxMap.has(keyA) ? idxMap.get(keyA) : Infinity;
    const iB = idxMap.has(keyB) ? idxMap.get(keyB) : Infinity;
    return iA - iB;
  });
}

/** vocab-distribution 主题的韩语/英语翻译（供课程卡片显示） */
const HSK1_THEME_TRANSLATIONS = {
  "打招呼": { ko: "인사하기", en: "Greetings" },
  "介绍名字": { ko: "이름 소개하기", en: "Introducing names" },
  "国籍/国家": { ko: "국적 / 국가", en: "Nationality" },
  "家庭": { ko: "가족", en: "Family" },
  "数字与数量": { ko: "숫자와 수량", en: "Numbers and quantity" },
  "年龄": { ko: "나이 묻기", en: "Age" },
  "日期": { ko: "날짜", en: "Date" },
  "时间": { ko: "시간", en: "Time" },
  "打电话": { ko: "전화하기", en: "Making calls" },
  "问地点/在哪儿": { ko: "장소 묻기 / 어디에", en: "Asking location" },
  "学校生活": { ko: "학교 생활", en: "School life" },
  "工作": { ko: "직업", en: "Work" },
  "爱好": { ko: "취미", en: "Hobbies" },
  "饮食1": { ko: "음식 1", en: "Food 1" },
  "饮食2": { ko: "음식 2", en: "Food 2" },
  "位置/方向": { ko: "위치 / 방향", en: "Location / direction" },
  "交通/出行": { ko: "교통 / 출행", en: "Transport" },
  "购物": { ko: "쇼핑", en: "Shopping" },
  "天气": { ko: "날씨", en: "Weather" },
  "看病/综合应用": { ko: "병원 / 종합 활용", en: "Doctor visit" },
  "复习1": { ko: "복습 1", en: "Review 1" },
  "复习2": { ko: "복습 2", en: "Review 2" },
};

/** 用 vocab-distribution 的 lessonThemes 覆盖课程标题，并附加翻译（与顺序来源保持一致） */
function applyVocabDistributionTitles(lessons, lessonThemes) {
  if (!Array.isArray(lessons) || !lessonThemes || typeof lessonThemes !== "object") return lessons;
  return lessons.map((l) => {
    const no = Number(l?.lessonNo ?? l?.lesson ?? l?.id ?? l?.no ?? 0) || 0;
    const theme = no ? (lessonThemes[String(no)] ?? lessonThemes[no]) : null;
    if (!theme || typeof theme !== "string") return l;
    const tr = HSK1_THEME_TRANSLATIONS[theme];
    return {
      ...l,
      title: theme,
      titleKo: tr?.ko ?? "",
      titleEn: tr?.en ?? "",
    };
  });
}

async function loadLessons() {
  setError("");
  setSubTitle();

  const lang = getLang();
  const listEl = $("hskLessonList");
  if (listEl) listEl.innerHTML = `<div class="text-sm opacity-70">${i18n.t("common_loading")}</div>`;

  try {
    let lessons = [];
    if (LESSON_ENGINE?.loadCourseIndex) {
      try {
        const index = await LESSON_ENGINE.loadCourseIndex({
          courseType: state.version,
          level: `hsk${state.lv}`,
        });
        lessons = Array.isArray(index?.lessons) ? index.lessons : [];
      } catch (engineErr) {
        console.warn("[HSK] Lesson Engine loadCourseIndex failed, fallback to HSK_LOADER:", engineErr?.message);
      }
    }
    if (!lessons.length && window.HSK_LOADER?.loadLessons) {
      lessons = await window.HSK_LOADER.loadLessons(state.lv, { version: state.version });
    }
    lessons = Array.isArray(lessons) ? lessons : [];

    const vocabDist = await getVocabDistribution(state.lv, state.version);
    let result = sortLessonsByDistributionOrder(lessons, vocabDist?.order ?? null);
    result = applyVocabDistributionTitles(result, vocabDist?.lessonThemes ?? null);

    state.lessons = result;
    renderLessonList(listEl, state.lessons, { lang });
    updateProgressBlock();
  } catch (e) {
    console.error(e);
    setError(`Lessons load failed: ${e?.message || e}`);
  }
}

async function openLesson({ lessonNo, file }) {
  setError("");
  const lang = getLang();
  const no = Number(lessonNo || 1);

  try {
    let lessonData = null;
    if (LESSON_ENGINE?.loadLessonDetail) {
      try {
        const { lesson } = await LESSON_ENGINE.loadLessonDetail({
          courseType: state.version,
          level: `hsk${state.lv}`,
          lessonNo: no,
          file: file || "",
        });
        lessonData = lesson;
      } catch (engineErr) {
        console.warn("[HSK] Lesson Engine loadLessonDetail failed, fallback to HSK_LOADER:", engineErr?.message);
      }
    }
    if (!lessonData && window.HSK_LOADER?.loadLessonDetail) {
      lessonData = await window.HSK_LOADER.loadLessonDetail(state.lv, no, {
        version: state.version,
        file: file || "",
      });
    }
    if (!lessonData) throw new Error("Failed to load lesson");

    const lessonWordsRaw = Array.isArray(lessonData?.words) ? lessonData.words : (Array.isArray(lessonData?.vocab) ? lessonData.vocab : []);
    const needsVocabEnrichment = lessonWordsRaw.some((w) => typeof w === "string");
    let vocab = [];
    if (needsVocabEnrichment && window.HSK_LOADER?.loadVocab) {
      vocab = await window.HSK_LOADER.loadVocab(state.lv, { version: state.version });
    }

    const vocabArr = Array.isArray(vocab) ? vocab : [];
    const vocabByKey = new Map(vocabArr.map((v) => [wordKey(v), v]).filter(([k]) => k));

    const lessonWords = lessonWordsRaw.map((w) => {
      if (typeof w === "string") {
        const key = String(w ?? "").trim();
        return vocabByKey.get(key) || { hanzi: key };
      }
      return w || {};
    }).filter((w) => wordKey(w));

    state.current = { lessonNo: no, file: file || "", lessonData, lessonWords };

    const courseId = lessonData?.courseId ?? getCourseId();
    const lessonId = lessonData?.id ?? `${courseId}_lesson${no}`;
    PROGRESS_ENGINE?.markLessonStarted?.({ courseId, lessonId, lessonNo: no });

    const lessonCoverUrl = IMAGE_ENGINE?.getLessonImage?.(lessonData, {
      courseType: state.version,
      level: `hsk${state.lv}`,
    });
    const coverWrap = $("hskLessonCoverWrap");
    const coverImg = $("hskLessonCover");
    if (coverWrap && coverImg) {
      if (lessonCoverUrl) {
        coverImg.src = lessonCoverUrl;
        coverImg.alt = typeof lessonData?.title === "object" ? (lessonData.title?.zh ?? lessonData.title?.en ?? "") : String(lessonData?.title ?? "");
        coverImg.onerror = () => { coverWrap.classList.add("hidden"); };
        coverWrap.classList.remove("hidden");
    } else {
      coverWrap.classList.add("hidden");
      }
    }

    const sceneSection = $("hskSceneSection");
    if (sceneSection) {
      if (SCENE_ENGINE?.hasScene?.(lessonData)) {
        const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);
        sceneSection.innerHTML = SceneRenderer.renderSceneHeader(scene, lang) +
          SceneRenderer.renderSceneGoals(scene, lang) +
          SceneRenderer.renderSceneCharacters(scene, lang);
        sceneSection.classList.remove("hidden");
      } else {
        sceneSection.innerHTML = "";
        sceneSection.classList.add("hidden");
      }
    }

    const titleObj = lessonData?.title;
    const titleStr = typeof titleObj === "object"
      ? (titleObj?.[lang] || titleObj?.kr || titleObj?.zh || titleObj?.en || "")
      : (typeof titleObj === "string" ? titleObj : "");
    const headerTitle = titleStr ? `Lesson ${no} / ${titleStr}` : `Lesson ${no}`;
    showStudyMode(headerTitle, ""); // 详情区只显示 Lesson N / title，不再重复 HSK N · version
    $("hskStudyBar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    updateProgressBlock();

    // 供 Stroke 弹窗 / fallback 使用的上下文
    window.__HSK_PAGE_CTX = {
      version: state.version,
      level: state.lv,
      lessonNo: no,
      from: typeof location !== "undefined" ? location.pathname : "/pages/hsk.html",
    };

    // Default tab: words
    state.tab = "words";
    PROGRESS_ENGINE?.markStepCompleted?.({ courseId, lessonId, step: "vocab" });
    updateTabsUI();

    // Render panels
    const isReview = lessonData?.type === "review";
    const reviewRange = lessonData?.review?.lessonRange;
    if (isReview && (!lessonWords || lessonWords.length === 0) && Array.isArray(reviewRange) && reviewRange.length >= 2) {
      const reviewTitle = (() => { const r = i18n?.t?.("hsk_review_range"); return (r && r !== "hsk_review_range") ? r : (lang === "zh" ? "复习范围" : lang === "en" ? "Review Range" : "복습 범위"); })();
      const reviewDesc = (() => { const r = i18n?.t?.("hsk_review_desc"); return (r && r !== "hsk_review_desc") ? r : (lang === "zh" ? "请回顾前面学过的词汇和对话。" : lang === "en" ? "Please review the vocabulary and dialogue from previous lessons." : "앞서 배운 단어와 대화를 복습해 주세요."); })();
      $("hskPanelWords").innerHTML = `
        <div class="rounded-xl border border-slate-200 p-4 bg-slate-50">
          <div class="font-semibold mb-2 text-slate-800">${escapeHtml(reviewTitle)}</div>
          <p class="text-slate-700">第 ${reviewRange[0]}–${reviewRange[1]} 课 / 1–${reviewRange[1]}과 복습</p>
          <p class="text-sm opacity-70 mt-2 text-slate-600">${escapeHtml(reviewDesc)}</p>
        </div>
      `;
    } else {
      renderWordCards($("hskPanelWords"), lessonWords, undefined, { lang, scope: `hsk${state.lv}` });
      PROGRESS_ENGINE?.touchLessonVocab?.({
        courseId,
        lessonId,
        vocabItems: lessonWords.map((w) => wordKey(w) || w),
      });
    }
    $("hskDialogueBody").innerHTML = buildDialogueHTML(lessonData);
    $("hskGrammarBody").innerHTML = buildGrammarHTML(lessonData);

    // Practice panel: 平台级 Practice Engine
    if (mountPractice && $("hskPracticeBody")) {
      try {
        mountPractice($("hskPracticeBody"), {
          lesson: lessonData,
          lang,
          onComplete: ({ total, correct, score, lesson }) => {
            PROGRESS_ENGINE?.recordPracticeResult?.({
              courseId,
              lessonId,
              total,
              correct,
              score,
              vocabItems: (lesson?.vocab ?? lesson?.words ?? []).map((w) => (typeof w === "string" ? w : w?.hanzi ?? w?.word ?? "")).filter(Boolean),
            });
            updateProgressBlock();
          },
        });
      } catch (e) {
        console.warn("[HSK] Practice mount failed:", e?.message);
        $("hskPracticeBody").innerHTML = `<div class="text-sm opacity-70">(练习加载失败)</div>`;
      }
    }

    // AI panel: 平台级 AI 对话训练入口
    $("hskAIInput").value = "";
    $("hskAIContext")?.classList.add("hidden");
    if (AI_CAPABILITY?.mountAIPanel && $("hskAIResult")) {
      try {
        AI_CAPABILITY.mountAIPanel($("hskAIResult"), {
          lesson: lessonData,
          lang,
          wordsWithMeaning: (w) => wordMeaning(w, lang),
        });
      } catch (e) {
        console.warn("[HSK] AI panel mount failed, fallback:", e?.message);
        $("hskAIResult").innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("hsk_ai_tip", {}))}</div>`;
      }
    } else {
      $("hskAIResult").innerHTML = "";
    }

  } catch (e) {
    console.error(e);
    setError(`Lesson load failed: ${e?.message || e}`);
  }
}

function bindEvents() {
  const controller = new AbortController();
  const { signal } = controller;

  $("hskLevel")?.addEventListener("change", async (e) => {
    state.lv = Number(e.target.value || 1);
    showListMode();
    await loadLessons();
    updateProgressBlock();
  }, { signal });

  $("hskVersion")?.addEventListener("change", async (e) => {
    const ver = window.HSK_LOADER?.normalizeVersion?.(e.target.value) || (e.target.value === "hsk3.0" ? "hsk3.0" : "hsk2.0");
    state.version = ver;
    try { window.HSK_LOADER?.setVersion?.(ver); } catch {}
    await loadLessons();
    updateProgressBlock();
    if (state.current?.lessonData) {
      const { lessonNo, file } = state.current;
      await openLesson({ lessonNo, file });
    } else {
      showListMode();
    }
  }, { signal });

  $("hskBackToList")?.addEventListener("click", () => {
    showListMode();
    $("hskLessonListWrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, { signal });

  // Lesson click (delegate)
  $("hskLessonList")?.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-open-lesson="1"]');
    if (!btn) return;
    const lessonNo = Number(btn.dataset.lessonNo || 1);
    const file = btn.dataset.file || "";
    openLesson({ lessonNo, file });
  }, { signal });

  // 点读：会话区点击中文句
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-speak-text][data-speak-kind='dialogue']");
    if (!el) return;
    const text = (el.dataset?.speakText || "").trim();
    if (!text || !TTS_ENGINE?.isSpeechSupported?.()) return;
    e.preventDefault();
    e.stopPropagation();
    TTS_ENGINE.stopSpeak();
    document.querySelectorAll(".is-speaking").forEach((x) => x.classList.remove("is-speaking"));
    const lineEl = el.closest(".lesson-dialogue-line");
    if (lineEl) lineEl.classList.add("is-speaking");
    TTS_ENGINE.speakText(text, {
      lang: "zh-CN",
      onEnd: () => lineEl?.classList.remove("is-speaking"),
      onError: () => lineEl?.classList.remove("is-speaking"),
    });
  }, { signal });

  // Tabs
  $("hskStudyTabs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    updateTabsUI();

    const step = state.tab === "ai" ? "aiPractice" : state.tab;
    if (state.current?.lessonData) {
      const courseId = getCourseId();
      const lessonId = state.current.lessonData?.id ?? `${courseId}_lesson${state.current.lessonNo}`;
      PROGRESS_ENGINE?.markStepCompleted?.({ courseId, lessonId, step });
      updateProgressBlock();
    }

    if (state.tab === "ai") {
      // keep it light; user can click copy
    }
  }, { signal });

  // Search filter (client-side)
  $("hskSearch")?.addEventListener("input", () => {
    const q = String($("hskSearch")?.value || "").trim().toLowerCase();
    const lang = getLang();
    const listEl = $("hskLessonList");
    if (!listEl) return;

    const filtered = !q
      ? state.lessons
      : state.lessons.filter((it) => {
          const title = JSON.stringify(it?.title || it?.name || "").toLowerCase();
          const pinyin = String(it?.pinyinTitle || it?.pinyin || "").toLowerCase();
          const file = String(it?.file || "").toLowerCase();
          return title.includes(q) || pinyin.includes(q) || file.includes(q);
        });

    renderLessonList(listEl, filtered, { lang });
  }, { signal });

  // AI: copy context
  $("hskAICopyContext")?.addEventListener("click", async () => {
    const ctx = buildAIContext();
    const pre = $("hskAIContext");
    if (pre) {
      pre.textContent = ctx;
      pre.classList.remove("hidden");
    }
    try { await navigator.clipboard.writeText(ctx); } catch {}
  }, { signal });

  // AI: send (placeholder – integrate later with your AI backend / step runner)
  $("hskAISend")?.addEventListener("click", async () => {
  const input = String($("hskAIInput")?.value || "").trim();
  const out = $("hskAIResult");
  if (!out) return;

  if (!input) {
    out.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("hsk_ai_empty"))}</div>`;
    return;
  }

  const lang = getLang(); // "ko" | "zh"
  const context = buildAIContext();

  // UI: loading
  out.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("common_loading"))}</div>`;

  try {
    if (!window.JOY_RUNNER?.askAI) {
      throw new Error("JOY_RUNNER.askAI not found. (Did you patch lessonStepRunner.js?)");
    }

    // ✅ Call StepRunner AI
    const res = await window.JOY_RUNNER.askAI({
      prompt: input,
      context,
      lang,
      mode: "Kids",
    });

    const text = res?.text ?? "";

    out.innerHTML = `
      <div class="border rounded-xl p-3">
        <div class="text-xs opacity-60 mb-2">AI</div>
        <div class="text-sm whitespace-pre-wrap">${escapeHtml(text)}</div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    out.innerHTML = `
      <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
        AI error: ${escapeHtml(e?.message || e)}
      </div>
      <div class="text-xs opacity-60 mt-2">
        체크: ① lessonStepRunner.js에 JOY_RUNNER.askAI 추가했는지
        ② aiAsk/AI.ask/JOY_AI.ask 중 하나가 실제로 존재하는지
        ③ 또는 /api/ai-chat 엔드포인트가 있는지
      </div>
    `;
  }
});

  // Language changed
  window.addEventListener("joy:langchanged", () => {
    try { i18n.apply(document); } catch {}
    setSubTitle();

    const lang = getLang();
    renderLessonList($("hskLessonList"), state.lessons, { lang });

    if (state.current?.lessonData) {
      const ld = state.current.lessonData;
      const lw = state.current.lessonWords || [];
      const isReview = ld?.type === "review";
      const rr = ld?.review?.lessonRange;
      if (isReview && lw.length === 0 && Array.isArray(rr) && rr.length >= 2) {
        const reviewTitle = (() => { const r = i18n?.t?.("hsk_review_range"); return (r && r !== "hsk_review_range") ? r : (lang === "zh" ? "复习范围" : lang === "en" ? "Review Range" : "복습 범위"); })();
        const reviewDesc = (() => { const r = i18n?.t?.("hsk_review_desc"); return (r && r !== "hsk_review_desc") ? r : (lang === "zh" ? "请回顾前面学过的词汇和对话。" : lang === "en" ? "Please review the vocabulary and dialogue from previous lessons." : "앞서 배운 단어와 대화를 복습해 주세요."); })();
        $("hskPanelWords").innerHTML = `
          <div class="rounded-xl border border-slate-200 p-4 bg-slate-50">
            <div class="font-semibold mb-2 text-slate-800">${escapeHtml(reviewTitle)}</div>
            <p class="text-slate-700">第 ${rr[0]}–${rr[1]} 课 / 1–${rr[1]}과 복습</p>
            <p class="text-sm opacity-70 mt-2 text-slate-600">${escapeHtml(reviewDesc)}</p>
          </div>
        `;
      } else {
        renderWordCards($("hskPanelWords"), lw, undefined, { lang, scope: `hsk${state.lv}` });
      }
      $("hskDialogueBody").innerHTML = buildDialogueHTML(ld);
      $("hskGrammarBody").innerHTML = buildGrammarHTML(ld);
      if (AI_CAPABILITY?.mountAIPanel && $("hskAIResult")) {
        try {
          AI_CAPABILITY.mountAIPanel($("hskAIResult"), {
            lesson: ld,
            lang,
            wordsWithMeaning: (w) => wordMeaning(w, lang),
          });
        } catch {}
      }
      updateTabsUI();
    }
  }, { signal });

  // i18n bus
  try {
    i18n?.on?.("change", () => window.dispatchEvent(new CustomEvent("joy:langchanged")));
  } catch {}
}

export async function mount() {
  const navRoot = $("siteNav");
  const app = $("app");
  if (!navRoot || !app) {
    console.error("HSK Page Error: missing #siteNav or #app");
    return false;
  }

  await ensureHSKDeps();

  // ✅ 预加载 glossary（HSK1 的 kr/en），供词卡释义回退
  const scope = `hsk${state.lv}`;
  loadGlossary("kr", scope).catch(() => {});
  loadGlossary("en", scope).catch(() => {});

  // ✅ mini nav: Home + Lang only
  navRoot.dataset.mode = "mini";
  mountNavBar(navRoot);

  app.innerHTML = getHSKLayoutHTML();

  // init controls — sync version from localStorage（仅允许 hsk2.0 / hsk3.0）
  const savedVer = localStorage.getItem("hsk_vocab_version") || state.version;
  state.version = (window.HSK_LOADER?.normalizeVersion?.(savedVer)) || (savedVer === "hsk3.0" ? "hsk3.0" : "hsk2.0");
  $("hskLevel") && ($("hskLevel").value = String(state.lv));
  $("hskVersion") && ($("hskVersion").value = String(state.version));

  try { i18n.apply(document); } catch {}

  bindWordCardActions();
  bindEvents();
  await loadLessons();
  showListMode();
  return true;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stringifyMaybe(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}
