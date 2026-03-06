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

const state = {
  lv: 1,
  version: "hsk2.0",
  lessons: [],
  current: null,        // { lessonNo, file, lessonData, lessonWords }
  tab: "words",         // words | dialogue | grammar | ai
};

function getLang() {
  return normalizeLang(i18n?.getLang?.()); // ko | zh | en
}

function $(id) { return document.getElementById(id); }

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
  $("hskAIResult") && ($("hskAIResult").innerHTML = "");
  $("hskAIContext")?.classList.add("hidden");

  state.current = null;
  state.tab = "words";
  updateTabsUI();
}

function updateTabsUI() {
  const ids = [
    ["words", "hskTabWords", "hskPanelWords"],
    ["dialogue", "hskTabDialogue", "hskPanelDialogue"],
    ["grammar", "hskTabGrammar", "hskPanelGrammar"],
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

/** 按系统语言取对话翻译，缺失时 kr -> en -> zh 回退。line/zh/cn 为中文原文，kr/ko、en 为译文 */
function pickDialogueTranslation(line, lang, zhMain = "") {
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const kr = str(line?.kr ?? line?.ko);
  const en = str(line?.en);
  const zhTr = str(line?.zh ?? line?.cn);
  let out = "";
  if (lang === "ko") out = kr || en || zhTr;
  else if (lang === "en") out = en || kr || zhTr;
  else out = zhTr || kr || en;
  if (out && zhMain && out === zhMain) return "";
  return out;
}

/** 对话渲染：教学型结构化 HTML。每句：speaker / 中文 / 拼音 / 当前语言翻译 */
function buildDialogueHTML(lessonData) {
  const d = lessonData?.dialogue;
  if (!d) return `<div class="hsk-dialogue-empty text-sm opacity-70">${i18n.t("hsk_empty_dialogue", {})}</div>`;

  const lang = getLang();
  const arr = Array.isArray(d) ? d : (Array.isArray(d?.lines) ? d.lines : []);
  if (!arr.length) return `<div class="hsk-dialogue-empty text-sm opacity-70">${i18n.t("hsk_empty_dialogue", {})}</div>`;

  const showPinyin = shouldShowPinyin({ level: lessonData?.level, version: lessonData?.version });

  const blocks = [];
  for (const line of arr) {
    const spk = String(line?.spk ?? line?.speaker ?? "").trim();
    const zh = String(line?.zh ?? line?.cn ?? line?.line ?? "").trim();
    let py = maybeGetManualPinyin(line, "dialogue");
    if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
    const trans = pickDialogueTranslation(line, lang, zh);
    const isA = spk.toUpperCase() === "A";

    blocks.push(`
<article class="hsk-dialogue-line rounded-xl border border-slate-200 p-4 mb-3 last:mb-0 ${isA ? "bg-slate-50/60" : "bg-white"}">
  ${spk ? `<div class="hsk-dialogue-speaker text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">${escapeHtml(spk)}</div>` : ""}
  <div class="hsk-dialogue-zh text-lg font-semibold text-slate-800">${escapeHtml(zh)}</div>
  ${py ? `<div class="hsk-dialogue-pinyin text-base italic text-slate-600 mt-1">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="hsk-dialogue-trans text-sm text-slate-600 mt-2 opacity-90">${escapeHtml(trans)}</div>` : ""}
</article>`);
  }
  return `<div class="hsk-dialogue-list space-y-0">${blocks.join("")}</div>`;
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

/** 获取 vocab-distribution.json 中 distribution 的键顺序（lesson1, lesson2, ...）用于课程排序 */
const _vocabDistOrderCache = new Map();
async function getVocabDistributionOrder(lv, version) {
  const key = `${version}:hsk${lv}`;
  if (_vocabDistOrderCache.has(key)) return _vocabDistOrderCache.get(key);
  const base = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  const root = base ? base + "/" : "/";
  const url = `${root}data/courses/${version}/hsk${lv}/vocab-distribution.json`;
  try {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) return null;
    const data = await res.json();
    const dist = data?.distribution;
    const order = dist && typeof dist === "object" ? Object.keys(dist) : null;
    _vocabDistOrderCache.set(key, order);
    return order;
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

async function loadLessons() {
  setError("");
  setSubTitle();

  const lang = getLang();
  const listEl = $("hskLessonList");
  if (listEl) listEl.innerHTML = `<div class="text-sm opacity-70">${i18n.t("common_loading")}</div>`;

  try {
    if (!window.HSK_LOADER?.loadLessons) throw new Error("HSK_LOADER.loadLessons not found");
    let lessons = await window.HSK_LOADER.loadLessons(state.lv, { version: state.version });
    lessons = Array.isArray(lessons) ? lessons : [];

    const order = await getVocabDistributionOrder(state.lv, state.version);
    state.lessons = sortLessonsByDistributionOrder(lessons, order);

    renderLessonList(listEl, state.lessons, { lang });
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
    if (!window.HSK_LOADER?.loadLessonDetail) throw new Error("HSK_LOADER.loadLessonDetail not found");

    const lessonData = await window.HSK_LOADER.loadLessonDetail(state.lv, no, {
      version: state.version,
      file: file || "",
    });

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

    const titleObj = lessonData?.title;
    const titleStr = typeof titleObj === "object"
      ? (titleObj?.[lang] || titleObj?.kr || titleObj?.zh || titleObj?.en || "")
      : (typeof titleObj === "string" ? titleObj : "");
    const headerTitle = titleStr ? `Lesson ${no} / ${titleStr}` : `Lesson ${no}`;
    showStudyMode(headerTitle, ""); // 详情区只显示 Lesson N / title，不再重复 HSK N · version
    $("hskStudyBar")?.scrollIntoView({ behavior: "smooth", block: "start" });

    // 供 Stroke 弹窗 / fallback 使用的上下文
    window.__HSK_PAGE_CTX = {
      version: state.version,
      level: state.lv,
      lessonNo: no,
      from: typeof location !== "undefined" ? location.pathname : "/pages/hsk.html",
    };

    // Default tab: words
    state.tab = "words";
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
      renderWordCards($("hskPanelWords"), lessonWords, undefined, { lang });
    }
    $("hskDialogueBody").innerHTML = buildDialogueHTML(lessonData);
    $("hskGrammarBody").innerHTML = buildGrammarHTML(lessonData);

    // AI panel reset
    $("hskAIResult").innerHTML = "";
    $("hskAIInput").value = "";
    $("hskAIContext")?.classList.add("hidden");

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
  }, { signal });

  $("hskVersion")?.addEventListener("change", async (e) => {
    const ver = window.HSK_LOADER?.normalizeVersion?.(e.target.value) || (e.target.value === "hsk3.0" ? "hsk3.0" : "hsk2.0");
    state.version = ver;
    try { window.HSK_LOADER?.setVersion?.(ver); } catch {}
    await loadLessons();
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

  // Tabs
  $("hskStudyTabs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    updateTabsUI();

    // when switching to AI: prepare context preview (optional)
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
        renderWordCards($("hskPanelWords"), lw, undefined, { lang });
      }
      $("hskDialogueBody").innerHTML = buildDialogueHTML(ld);
      $("hskGrammarBody").innerHTML = buildGrammarHTML(ld);
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
