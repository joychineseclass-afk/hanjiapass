// /ui/pages/page.hsk.js ✅ FINAL (Study Tabs)
// ✅ Clean HSK page: no mountGlobalComponents()
// ✅ Directory <-> Study mode
// ✅ Study Tabs: words/dialogue/grammar/ai

import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";
import { renderLessonList, renderWordCards } from "../modules/hsk/hskRenderer.js";

const state = {
  lv: 1,
  version: "hsk2.0",
  lessons: [],
  current: null,        // { lessonNo, file, lessonData, lessonWords }
  tab: "words",         // words | dialogue | grammar | ai
};

function getLang() {
  const l = (i18n?.getLang?.() || "kr").toLowerCase();
  return (l === "cn" || l === "zh") ? "zh" : "ko";
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

function showStudyMode(titleText = "", metaText = "") {
  $("hskLessonListWrap")?.classList.add("hidden");

  $("hskStudyBar")?.classList.remove("hidden");
  $("hskStudyPanels")?.classList.remove("hidden");

  if ($("hskStudyTitle")) $("hskStudyTitle").textContent = titleText || "";
  if ($("hskStudyMeta")) $("hskStudyMeta").textContent = metaText || "";
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

function buildDialogueHTML(lessonData) {
  // Accept: lessonData.dialogue could be array of lines or object.
  const d = lessonData?.dialogue;
  if (!d) return `<div class="text-sm opacity-70">${i18n.t("hsk_empty_dialogue", {})}</div>`;

  const lang = getLang();
  const arr = Array.isArray(d) ? d : (Array.isArray(d?.lines) ? d.lines : []);

  if (!arr.length) return `<div class="text-sm opacity-70">${i18n.t("hsk_empty_dialogue", {})}</div>`;

  return arr.map((line) => {
    // line could be {spk, zh, ko, pinyin} etc
    const spk = line?.spk || line?.speaker || "";
    const zh = line?.zh || line?.cn || "";
    const ko = line?.ko || line?.kr || "";
    const py = line?.pinyin || line?.py || "";

    const main = (lang === "zh") ? zh : ko;
    const sub = (lang === "zh") ? ko : zh;

    return `
      <div class="border rounded-xl p-3">
        ${spk ? `<div class="text-xs opacity-60 mb-1">${escapeHtml(spk)}</div>` : ``}
        ${main ? `<div class="text-base font-semibold">${escapeHtml(main)}</div>` : ``}
        ${sub ? `<div class="text-sm opacity-70 mt-1">${escapeHtml(sub)}</div>` : ``}
        ${py ? `<div class="text-sm italic opacity-70 mt-1">${escapeHtml(py)}</div>` : ``}
      </div>
    `;
  }).join("");
}

function buildGrammarHTML(lessonData) {
  const g = lessonData?.grammar;
  if (!g) return `<div class="text-sm opacity-70">${i18n.t("hsk_empty_grammar", {})}</div>`;

  const lang = getLang();
  const arr = Array.isArray(g) ? g : (Array.isArray(g?.points) ? g.points : []);

  if (!arr.length) return `<div class="text-sm opacity-70">${i18n.t("hsk_empty_grammar", {})}</div>`;

  return arr.map((pt, idx) => {
    const title = pt?.title || pt?.name || `#${idx + 1}`;
    const zh = pt?.zh || pt?.cn || "";
    const ko = pt?.ko || pt?.kr || "";
    const ex = pt?.example || pt?.examples || "";

    const main = (lang === "zh") ? zh : ko;
    const sub = (lang === "zh") ? ko : zh;

    return `
      <div class="border rounded-xl p-3">
        <div class="text-sm font-bold">${escapeHtml(title)}</div>
        ${main ? `<div class="text-sm mt-2">${escapeHtml(main)}</div>` : ``}
        ${sub ? `<div class="text-sm opacity-70 mt-1">${escapeHtml(sub)}</div>` : ``}
        ${ex ? `<div class="text-sm mt-2 bg-slate-50 border rounded-lg p-2">${escapeHtml(stringifyMaybe(ex))}</div>` : ``}
      </div>
    `;
  }).join("");
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
    const han = w?.word || w?.han || w?.zh || w?.cn || "";
    const py  = w?.pinyin || w?.py || "";
    const mean = (lang === "zh") ? (w?.meaningZh || w?.zhMeaning || w?.meaning || "") : (w?.meaning || w?.ko || w?.kr || "");
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

async function loadLessons() {
  setError("");
  setSubTitle();

  const lang = getLang();
  const listEl = $("hskLessonList");
  if (listEl) listEl.innerHTML = `<div class="text-sm opacity-70">${i18n.t("common_loading")}</div>`;

  try {
    if (!window.HSK_LOADER?.loadLessons) throw new Error("HSK_LOADER.loadLessons not found");
    const lessons = await window.HSK_LOADER.loadLessons(state.lv, { version: state.version });
    state.lessons = Array.isArray(lessons) ? lessons : [];
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
    showStudyMode(`Lesson ${no}`, `HSK ${state.lv} · ${state.version}`);
    $("hskStudyBar")?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (!window.HSK_LOADER?.loadLessonDetail) throw new Error("HSK_LOADER.loadLessonDetail not found");

    const lessonData = await window.HSK_LOADER.loadLessonDetail(state.lv, no, {
      version: state.version,
      file: file || "",
    });

    let vocab = [];
    if (window.HSK_LOADER?.loadVocab) {
      vocab = await window.HSK_LOADER.loadVocab(state.lv, { version: state.version });
    }

    const lessonWordsRaw = Array.isArray(lessonData?.words) ? lessonData.words : [];
    const set = new Set(lessonWordsRaw.map((w) => String(w ?? "").trim()).filter(Boolean));

    const lessonWords =
      Array.isArray(vocab)
        ? vocab.filter((x) => {
            const word = String(x?.word ?? x?.han ?? x?.zh ?? x?.cn ?? "").trim();
            return word && set.has(word);
          })
        : [];

    state.current = { lessonNo: no, file: file || "", lessonData, lessonWords };

    // Default tab: words
    state.tab = "words";
    updateTabsUI();

    // Render panels
    renderWordCards($("hskPanelWords"), lessonWords, undefined, { lang });
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
    state.version = String(e.target.value || "hsk2.0");
    showListMode();
    await loadLessons();
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
  $("hskAISend")?.addEventListener("click", () => {
    const input = String($("hskAIInput")?.value || "").trim();
    const out = $("hskAIResult");
    if (!out) return;

    if (!input) {
      out.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("hsk_ai_empty"))}</div>`;
      return;
    }

    // ✅ For now: show a structured prompt (later you can wire to your API)
    const ctx = buildAIContext();
    out.innerHTML = `
      <div class="border rounded-xl p-3 bg-slate-50">
        <div class="text-xs opacity-60 mb-2">${escapeHtml(i18n.t("hsk_ai_prompt_preview"))}</div>
        <pre class="text-xs whitespace-pre-wrap">${escapeHtml(ctx + "\n" + input)}</pre>
      </div>
      <div class="text-sm opacity-70 mt-2">${escapeHtml(i18n.t("hsk_ai_next_tip"))}</div>
    `;
  }, { signal });

  // Language changed
  window.addEventListener("joy:langchanged", () => {
    try { i18n.apply(document); } catch {}
    setSubTitle();

    const lang = getLang();
    renderLessonList($("hskLessonList"), state.lessons, { lang });

    // Re-render current lesson in the new language
    if (state.current?.lessonData) {
      renderWordCards($("hskPanelWords"), state.current.lessonWords || [], undefined, { lang });
      $("hskDialogueBody").innerHTML = buildDialogueHTML(state.current.lessonData);
      $("hskGrammarBody").innerHTML = buildGrammarHTML(state.current.lessonData);
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

  // ✅ mini nav: Home + Lang only
  navRoot.dataset.mode = "mini";
  mountNavBar(navRoot);

  app.innerHTML = getHSKLayoutHTML();

  // init controls
  $("hskLevel") && ($("hskLevel").value = String(state.lv));
  $("hskVersion") && ($("hskVersion").value = String(state.version));

  try { i18n.apply(document); } catch {}

  bindEvents();
  await loadLessons();
  showListMode();
  return true;
}

// Auto mount
try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mount());
  } else {
    mount();
  }
} catch {}

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
