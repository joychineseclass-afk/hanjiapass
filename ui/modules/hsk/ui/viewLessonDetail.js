// /ui/modules/hsk/ui/viewLessonDetail.js
// ✅ Lesson Detail (tabs) view renderer
// Keeps your original behavior, just moved out.

import {
  safeText,
  renderTopBar,
  renderEmptyHint,
  scrollToTop,
  setStatus,
} from "./hskDom.js";
import { buildAllMap, buildLessonWordList, filterWordList } from "./hskIndex.js";
import { getVersion, getLessonNo, loadLessonDetail, lessonDetailUrl } from "./hskData.js";

export async function openLessonDetailFlow(ctx, lesson, idxFallback = 0) {
  const { dom } = ctx;

  const lv = safeText(dom.hskLevel?.value || "1");
  const ver = getVersion(dom);
  const lessonNo = getLessonNo(lesson, idxFallback);

  ctx.viewMode = "lessonDetail";
  ctx.lessonTab = "vocab";
  ctx.currentLesson = lesson;
  ctx.inRecentView = false;

  // lightweight loading
  if (dom.hskGrid) {
    dom.hskGrid.innerHTML = "";
    const box = document.createElement("div");
    box.className = "bg-white rounded-2xl shadow p-4";
    box.innerHTML = `
      <div class="text-lg font-semibold">불러오는 중...</div>
      <div class="text-sm text-gray-600 mt-2 whitespace-pre-wrap">Lesson ${lessonNo} 데이터를 가져오고 있어요...</div>
    `;
    dom.hskGrid.appendChild(box);
  }
  setStatus(dom, "(loading...)");

  try {
    ctx.currentLessonDetail = await loadLessonDetail({
      level: lv,
      lessonNo,
      version: ver,
      detailCache: ctx.lessonDetailCache,
    });
    renderLessonDetailView(ctx);
    scrollToTop();
    ctx.focusSearch?.();
  } catch (e) {
    // fallback: keep exactly as your original
    console.warn("Lesson detail load failed, fallback to word list:", e);

    ctx.currentLessonDetail = null;
    ctx.viewMode = "auto";
    ctx.currentLesson = lesson;

    ctx.renderLessonWordsView?.();

    const msg =
      `⚠️ Lesson 상세 파일을 못 찾았어요.\n` +
      `경로: ${lessonDetailUrl(lv, lessonNo, ver)}\n` +
      `에러: ${e?.message || e}\n\n` +
      `대신 '이 수업 단어' 보기로 전환했어요.`;
    ctx.showError?.(msg);
    setStatus(dom, "");
  }
}

export function renderLessonDetailView(ctx) {
  const { dom } = ctx;

  if (!dom?.hskGrid) return;

  if (!ctx.currentLessonDetail) {
    ctx.viewMode = "auto";
    return ctx.renderAuto?.();
  }

  const lv = safeText(dom.hskLevel?.value || "1");
  const ver = getVersion(dom);
  const lessonNo =
    Number(ctx.currentLessonDetail?.lesson) || getLessonNo(ctx.currentLesson, 0);

  const title =
    safeText(ctx.currentLessonDetail?.title) ||
    safeText(ctx.currentLesson?.title) ||
    `Lesson ${lessonNo}`;

  const topic = safeText(ctx.currentLessonDetail?.topic);
  const subtitle = `HSK ${lv} · ${ver}` + (topic ? ` · ${topic}` : "");

  dom.hskGrid.innerHTML = "";

  const top = renderTopBar({
    title,
    subtitle,
    leftBtn: { key: "backLessons", text: "← 수업 목록" },
    rightBtns: [
      { key: "recent", text: "최근 학습" },
      { key: "goAll", text: "전체 단어" },
    ],
  });
  dom.hskGrid.appendChild(top);

  top.querySelector(`[data-key="backLessons"]`)?.addEventListener("click", () => {
    ctx.viewMode = "auto";
    ctx.currentLessonDetail = null;
    ctx.lessonTab = "vocab";
    ctx.currentLesson = null;
    ctx.renderLessonsView?.();
    scrollToTop();
    ctx.focusSearch?.();
  });

  top.querySelector(`[data-key="recent"]`)?.addEventListener("click", () => {
    ctx.viewMode = "auto";
    ctx.currentLessonDetail = null;
    ctx.currentLesson = null;
    ctx.renderRecentView?.();
    scrollToTop();
    ctx.focusSearch?.();
  });

  top.querySelector(`[data-key="goAll"]`)?.addEventListener("click", () => {
    ctx.viewMode = "auto";
    ctx.currentLessonDetail = null;
    ctx.currentLesson = null;
    ctx.renderAllWordsView?.();
    scrollToTop();
    ctx.focusSearch?.();
  });

  dom.hskGrid.appendChild(renderTabBar(ctx));

  const wrap = document.createElement("div");
  wrap.className = "bg-white rounded-2xl shadow p-4";
  dom.hskGrid.appendChild(wrap);

  if (ctx.lessonTab === "vocab") return renderLessonTabVocab(ctx, wrap);
  if (ctx.lessonTab === "dialogue") return renderLessonTabDialogue(ctx, wrap);
  if (ctx.lessonTab === "grammar") return renderLessonTabGrammar(ctx, wrap);
  if (ctx.lessonTab === "practice") return renderLessonTabPractice(ctx, wrap);
  if (ctx.lessonTab === "ai") return renderLessonTabAI(ctx, wrap);

  return renderLessonTabVocab(ctx, wrap);
}

function renderTabBar(ctx) {
  const tabs = [
    { key: "vocab", text: "단어" },
    { key: "dialogue", text: "회화" },
    { key: "grammar", text: "문법" },
    { key: "practice", text: "연습" },
    { key: "ai", text: "AI" },
  ];

  const bar = document.createElement("div");
  bar.className = "bg-white rounded-2xl shadow p-2 mb-3 flex flex-wrap gap-2";

  bar.innerHTML = tabs
    .map((t) => {
      const active = t.key === ctx.lessonTab;
      return `<button type="button" data-tab="${t.key}"
        class="px-3 py-2 rounded-xl text-sm ${
          active ? "bg-blue-600 text-white" : "bg-slate-100"
        }">${t.text}</button>`;
    })
    .join("");

  bar.querySelectorAll("button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ctx.lessonTab = btn.getAttribute("data-tab") || "vocab";
      renderLessonDetailView(ctx);
      scrollToTop();
      ctx.focusSearch?.();
    });
  });

  return bar;
}

function renderLessonTabVocab(ctx, container) {
  const { dom } = ctx;
  if (!container) return;

  if (!window.HSK_RENDER?.renderWordCards) {
    container.innerHTML = `<div class="text-sm text-red-600">HSK_RENDER.renderWordCards 가 없습니다.</div>`;
    return;
  }

  const q = safeText(dom.hskSearch?.value);
  const allMap = buildAllMap(ctx.ALL);

  const wordsRaw = Array.isArray(ctx.currentLessonDetail?.words)
    ? ctx.currentLessonDetail.words
    : Array.isArray(ctx.currentLesson?.words)
    ? ctx.currentLesson.words
    : [];

  const tmpLesson = { words: wordsRaw };
  const { list: lessonWords, missing } = buildLessonWordList(tmpLesson, allMap);
  const filtered = filterWordList(lessonWords, q);

  container.innerHTML = "";

  const meta = document.createElement("div");
  meta.className = "text-sm text-gray-600 mb-3";
  meta.textContent =
    (q ? `검색: "${q}" · ` : "") +
    `단어 ${filtered.length}개` +
    (missing ? ` · ⚠️ 누락 ${missing}개` : "");
  container.appendChild(meta);

  const cardWrap = document.createElement("div");
  cardWrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
  container.appendChild(cardWrap);

  if (filtered.length === 0) {
    renderEmptyHint(cardWrap, "단어가 없어요", "이 수업 words 목록을 확인해 주세요.");
    setStatus(dom, "(0)");
    return;
  }

  window.HSK_RENDER.renderWordCards(
    cardWrap,
    filtered,
    (item) => window.LEARN_PANEL?.open?.(item),
    { lang: ctx.LANG, query: q, showTag: "학습", compact: false }
  );

  setStatus(dom, `(${filtered.length})`);
}

function renderLessonTabDialogue(ctx, container) {
  const { dom } = ctx;
  const dia = Array.isArray(ctx.currentLessonDetail?.dialogue)
    ? ctx.currentLessonDetail.dialogue
    : [];

  container.innerHTML = "";

  if (dia.length === 0) {
    container.innerHTML = `<div class="text-sm text-gray-600">회화 데이터가 없어요. (dialogue: [])</div>`;
    setStatus(dom, "(0)");
    return;
  }

  const list = document.createElement("div");
  list.className = "space-y-2";
  container.appendChild(list);

  dia.forEach((it, idx) => {
    const speaker = safeText(it?.speaker || it?.role || `S${idx + 1}`);
    const line = safeText(it?.line || it?.text || it?.zh || it?.cn);

    const row = document.createElement("div");
    row.className = "p-3 rounded-xl bg-slate-50";
    row.innerHTML = `
      <div class="text-xs text-gray-500 mb-1">${speaker}</div>
      <div class="text-base">${line || ""}</div>
    `;
    list.appendChild(row);
  });

  setStatus(dom, `(${dia.length})`);
}

function renderLessonTabGrammar(ctx, container) {
  const { dom } = ctx;
  const gram = Array.isArray(ctx.currentLessonDetail?.grammar)
    ? ctx.currentLessonDetail.grammar
    : [];

  container.innerHTML = "";

  if (gram.length === 0) {
    container.innerHTML = `<div class="text-sm text-gray-600">문법 데이터가 없어요. (grammar: [])</div>`;
    setStatus(dom, "(0)");
    return;
  }

  const list = document.createElement("div");
  list.className = "space-y-3";
  container.appendChild(list);

  gram.forEach((g, idx) => {
    const title = safeText(g?.title || `문법 ${idx + 1}`);
    const kr = safeText(g?.explanation_kr || g?.kr || g?.explainKr);
    const zh = safeText(g?.explanation_zh || g?.zh || g?.explainZh);
    const ex = safeText(g?.example || g?.eg);

    const card = document.createElement("div");
    card.className = "p-4 rounded-2xl bg-slate-50";
    card.innerHTML = `
      <div class="text-base font-semibold">${title}</div>
      ${kr ? `<div class="text-sm text-gray-700 mt-2"><b>KR</b> ${kr}</div>` : ""}
      ${zh ? `<div class="text-sm text-gray-700 mt-2"><b>ZH</b> ${zh}</div>` : ""}
      ${ex ? `<div class="text-sm text-gray-500 mt-2"><b>예문</b> ${ex}</div>` : ""}
    `;
    list.appendChild(card);
  });

  setStatus(dom, `(${gram.length})`);
}

function renderLessonTabPractice(ctx, container) {
  const { dom } = ctx;
  const prac = Array.isArray(ctx.currentLessonDetail?.practice)
    ? ctx.currentLessonDetail.practice
    : [];

  container.innerHTML = "";

  if (prac.length === 0) {
    container.innerHTML = `<div class="text-sm text-gray-600">연습 데이터가 없어요. (practice: [])</div>`;
    setStatus(dom, "(0)");
    return;
  }

  const list = document.createElement("div");
  list.className = "space-y-3";
  container.appendChild(list);

  prac.forEach((p, idx) => {
    const type = safeText(p?.type || "practice");
    const q = safeText(p?.question || "");
    const options = Array.isArray(p?.options) ? p.options : [];
    const answer = safeText(p?.answer || "");

    const card = document.createElement("div");
    card.className = "p-4 rounded-2xl bg-slate-50";
    card.innerHTML = `
      <div class="text-xs text-gray-500 mb-2">${idx + 1}. ${type}</div>
      ${q ? `<div class="text-base font-medium">${q}</div>` : ""}
      ${
        options.length
          ? `<div class="mt-2 text-sm text-gray-700 space-y-1">
              ${options.map((x) => `<div>• ${safeText(x)}</div>`).join("")}
             </div>`
          : ""
      }
      ${answer ? `<div class="mt-2 text-sm text-gray-500"><b>정답</b> ${answer}</div>` : ""}
    `;
    list.appendChild(card);
  });

  setStatus(dom, `(${prac.length})`);
}

function renderLessonTabAI(ctx, container) {
  const { dom } = ctx;

  const lv = safeText(dom.hskLevel?.value || "1");
  const title =
    safeText(ctx.currentLessonDetail?.title) ||
    safeText(ctx.currentLesson?.title) ||
    "Lesson";

  const topic = safeText(ctx.currentLessonDetail?.topic);
  const words = Array.isArray(ctx.currentLessonDetail?.words)
    ? ctx.currentLessonDetail.words
    : [];

  const prompt =
    `당신은 한국 학생을 가르치는 중국어 선생님입니다.\n` +
    `오늘 수업: HSK${lv} / ${title}\n` +
    (topic ? `주제: ${topic}\n` : "") +
    (words.length ? `단어: ${words.join(", ")}\n` : "") +
    `\n요청:\n` +
    `1) 위 단어로 쉬운 회화 5문장 만들어 주세요.\n` +
    `2) 한국어 뜻 + 중국어 + 병음 같이 보여 주세요.\n` +
    `3) 마지막에 간단한 퀴즈 3개(객관식) 만들어 주세요.\n`;

  container.innerHTML = `
    <div class="text-sm text-gray-600 mb-2">
      아래 프롬프트를 복사해서 AI 패널/ChatGPT에 붙여넣으면 바로 연습할 수 있어요.
    </div>
    <textarea id="hskAiPrompt" class="w-full border rounded-xl p-3 text-sm" rows="10"></textarea>
    <div class="flex gap-2 mt-3">
      <button id="btnCopyAi" type="button" class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm">프롬프트 복사</button>
      <button id="btnOpenRecent" type="button" class="px-4 py-2 rounded-xl bg-slate-100 text-sm">최근 학습 보기</button>
    </div>
    <div class="text-xs text-gray-500 mt-2">
      (다음 단계) AI 패널에 "이 프롬프트로 시작" 버튼을 직접 연결해 줄 수도 있어요.
    </div>
  `;

  const ta = container.querySelector("#hskAiPrompt");
  if (ta) ta.value = prompt;

  container.querySelector("#btnCopyAi")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      try {
        ta?.select?.();
        document.execCommand("copy");
      } catch {}
    }
  });

  container.querySelector("#btnOpenRecent")?.addEventListener("click", () => {
    ctx.viewMode = "auto";
    ctx.currentLessonDetail = null;
    ctx.currentLesson = null;
    ctx.renderRecentView?.();
    scrollToTop();
    ctx.focusSearch?.();
  });

  setStatus(dom, "");
}
