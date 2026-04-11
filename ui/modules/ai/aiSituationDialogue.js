/**
 * 상황 대화：固定场景卡 + 逐轮对话练习（非 AI 长文回复区）
 * 数据优先来自 lesson.aiPractice.situationDialogue；缺省时从 dialogueCards 推导。
 */

import { i18n } from "../../i18n.js";
import { AUDIO_ENGINE } from "../../platform/index.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function t(key, fallback = "") {
  return (i18n && typeof i18n.t === "function" ? i18n.t(key, fallback) : null) || fallback || key;
}

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "kr").toLowerCase();
  const key = l === "zh" || l === "cn" ? "cn" : l === "ko" || l === "kr" ? "kr" : l === "jp" || l === "ja" ? "jp" : "en";
  const v = obj[key] || obj.zh || obj.cn || obj.kr || obj.jp || obj.en;
  return str(v != null ? v : "");
}

function lineText(line) {
  if (!line || typeof line !== "object") return "";
  return str(line.text != null ? line.text : line.zh != null ? line.zh : line.cn || "");
}

function lineSpeaker(line) {
  if (!line || typeof line !== "object") return "";
  return str(line.speaker != null ? line.speaker : "");
}

/** 仅朗读中文正文：去掉常见拼音括号，避免与汉字重复念 */
function chineseTtsText(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/[（(][^）)]*[）)]/g, (m) => (/[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńḿ]/.test(m) ? "" : m));
  s = s.replace(/\s+/g, " ").trim();
  return s || String(raw ?? "").trim();
}

/** 与 hskRenderer.ttsBcp47ForUiMeaningLang 一致：提示语按界面语言朗读 */
function ttsBcp47ForUiLang(uiLang) {
  const l = String(uiLang || "kr").toLowerCase();
  if (l === "kr" || l === "ko") return "ko-KR";
  if (l === "jp" || l === "ja") return "ja-JP";
  if (l === "cn" || l === "zh") return "zh-CN";
  if (l === "en") return "en-US";
  return "ko-KR";
}

/**
 * 当前轮完整朗读：先 zh-CN 读 AI 台词，再按系统语言读提示语（대화 시작 / 다음 / 다시 듣기 共用）
 */
function speakSituationRoundFull(zhLine, uiLang) {
  if (typeof window === "undefined") return;
  const zh = chineseTtsText(zhLine);
  const promptText = str(
    t("ai.situation_teacher_prompt", "제가 이렇게 말하면, 어떻게 대답할까요?"),
  );
  const promptLang = ttsBcp47ForUiLang(uiLang);

  const playPrompt = () => {
    if (!promptText) return;
    try {
      AUDIO_ENGINE.playText(promptText, { lang: promptLang, rate: 0.95 });
    } catch (_) {}
  };

  if (!zh) {
    playPrompt();
    return;
  }
  if (!promptText) {
    try {
      AUDIO_ENGINE.playText(zh, { lang: "zh-CN", rate: 0.95 });
    } catch (_) {}
    return;
  }

  try {
    AUDIO_ENGINE.playText(zh, {
      lang: "zh-CN",
      rate: 0.95,
      onEnd: playPrompt,
    });
  } catch (_) {
    playPrompt();
  }
}

/** 师生会话：学生先向老师问好 → 练习轮次用 (老师句, 学生句) */
function isTeacherStudentOpening(lines) {
  const t0 = lineText(lines[0]);
  return /老师|您好|您/.test(t0);
}

/**
 * 从 dialogueCard 推导 2 轮（每轮 AI 一句 + 学生 1～2 参考）
 */
function buildScenariosFromDialogueCard(card, lang) {
  const lines = Array.isArray(card?.lines) ? card.lines : [];
  if (lines.length < 4) return [];

  const situation = pickLang(card.title, lang) || pickLang(card.summary, lang) || t("ai.scenario_greeting", "인사하기");
  const teacherStudent = isTeacherStudentOpening(lines);
  const s0 = lineText(lines[0]);
  const s1 = lineText(lines[1]);
  const s2 = lineText(lines[2]);
  const s3 = lineText(lines[3]);

  let rounds;
  let aiRole;
  let studentRole;
  if (teacherStudent) {
    aiRole = lineSpeaker(lines[1]) || t("ai.role_teacher", "선생님");
    studentRole = lineSpeaker(lines[0]) || t("ai.role_student", "학생");
    rounds = [
      { aiLine: s1, studentRefs: [s0].filter(Boolean) },
      { aiLine: s3, studentRefs: [s2].filter(Boolean) },
    ];
  } else {
    aiRole = lineSpeaker(lines[0]) || t("ai.role_classmate", "친구");
    studentRole = lineSpeaker(lines[1]) || t("ai.role_me", "나");
    rounds = [
      { aiLine: s0, studentRefs: [s1].filter(Boolean) },
      { aiLine: s2, studentRefs: [s3].filter(Boolean) },
    ];
  }

  rounds = rounds
    .map((r) => ({
      aiLine: str(r.aiLine),
      studentRefs: (Array.isArray(r.studentRefs) ? r.studentRefs : []).map(str).filter(Boolean),
    }))
    .filter((r) => r.aiLine && r.studentRefs.length);

  if (rounds.length < 1) return [];

  const goal =
    pickLang(card.summary, lang) ||
    t("ai.situation_goal_fallback", "본과 회화 표현으로 짧은 대화를 연습합니다.");

  const exprSet = new Set();
  for (const r of rounds) {
    exprSet.add(r.aiLine);
    r.studentRefs.forEach((x) => exprSet.add(x));
  }
  const expressions = [...exprSet].slice(0, 4);

  return [
    {
      id: "derived",
      situation,
      aiRole,
      studentRole,
      goal,
      expressions,
      rounds: rounds.slice(0, 4),
    },
  ];
}

/**
 * @returns {{ scenarios: object[], defaultIndex: number } | null}
 */
export function buildSituationDialoguePlan(lesson, lang) {
  const ap = lesson?.aiPractice && typeof lesson.aiPractice === "object" ? lesson.aiPractice : {};
  const raw = ap.situationDialogue;

  if (raw && typeof raw === "object" && Array.isArray(raw.scenarios) && raw.scenarios.length) {
    const scenarios = raw.scenarios
      .map((sc, idx) => {
        const situation = typeof sc.situation === "string" ? sc.situation : pickLang(sc.situation, lang);
        const aiRole = typeof sc.aiRole === "string" ? sc.aiRole : pickLang(sc.aiRole, lang);
        const studentRole = typeof sc.studentRole === "string" ? sc.studentRole : pickLang(sc.studentRole, lang);
        const goal = typeof sc.goal === "string" ? sc.goal : pickLang(sc.goal, lang);
        const expressions = Array.isArray(sc.expressions) ? sc.expressions.map(str).filter(Boolean).slice(0, 6) : [];
        const rounds = Array.isArray(sc.rounds)
          ? sc.rounds
            .map((r) => ({
              aiLine: str(r.aiLine != null ? r.aiLine : r.ai),
              studentRefs: Array.isArray(r.studentRefs)
                ? r.studentRefs.map(str).filter(Boolean).slice(0, 2)
                : r.studentRef
                  ? [str(r.studentRef)]
                  : [],
            }))
            .filter((r) => r.aiLine && r.studentRefs.length)
            .slice(0, 4)
          : [];
        if (!situation || !rounds.length) return null;
        return {
          id: str(sc.id) || `sc_${idx}`,
          situation,
          aiRole: aiRole || t("ai.ai_role", "AI"),
          studentRole: studentRole || t("ai.student_role", "학생"),
          goal: goal || t("ai.situation_goal_fallback", "본과 회화 표현으로 짧은 대화를 연습합니다."),
          expressions: expressions.length ? expressions.slice(0, 4) : [],
          rounds,
        };
      })
      .filter(Boolean);

    if (!scenarios.length) return null;
    const defaultIndex = Math.min(Math.max(0, Number(raw.defaultScenarioIndex) || 0), scenarios.length - 1);
    return { scenarios, defaultIndex };
  }

  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  for (const card of cards) {
    const built = buildScenariosFromDialogueCard(card, lang);
    if (built.length) return { scenarios: built, defaultIndex: 0 };
  }

  return null;
}

function scenarioPickerHtml(scenarios, lang) {
  if (scenarios.length < 2) return "";
  const label = t("ai.situation_pick_label", "연습 장면");
  const buttons = scenarios
    .map((sc, i) => {
      const title = escapeHtml(sc.situation);
      return `<button type="button" class="ai-situation-scenario-chip${i === 0 ? " ai-situation-scenario-chip--active" : ""}" data-scenario-index="${i}" aria-pressed="${i === 0 ? "true" : "false"}">${title}</button>`;
    })
    .join("");
  return `
    <div class="ai-situation-picker" role="group" aria-label="${escapeHtml(label)}">
      <span class="ai-situation-picker-label">${escapeHtml(label)}</span>
      <div class="ai-situation-picker-chips">${buttons}</div>
    </div>
  `;
}

function scenarioCardHtml(sc, lang) {
  const situationL = t("ai.situation_field_situation", "상황");
  const aiL = t("ai.situation_field_ai", "AI 역할");
  const stL = t("ai.situation_field_student", "학생 역할");
  const goalL = t("ai.situation_field_goal", "연습 목표");
  const exprL = t("ai.situation_field_expressions", "사용 표현");

  const exprBlock =
    sc.expressions && sc.expressions.length
      ? `<ul class="ai-situation-expr-list">${sc.expressions.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
      : `<p class="ai-situation-card-muted">${escapeHtml(t("ai.situation_no_expressions", "본과 대화에서 표현을 확인해 보세요."))}</p>`;

  return `
    <div class="ai-situation-scenario-card" data-situation-card>
      <div class="ai-situation-card-row"><span class="ai-situation-card-k">${escapeHtml(situationL)}</span><span class="ai-situation-card-v">${escapeHtml(sc.situation)}</span></div>
      <div class="ai-situation-card-row"><span class="ai-situation-card-k">${escapeHtml(aiL)}</span><span class="ai-situation-card-v">${escapeHtml(sc.aiRole)}</span></div>
      <div class="ai-situation-card-row"><span class="ai-situation-card-k">${escapeHtml(stL)}</span><span class="ai-situation-card-v">${escapeHtml(sc.studentRole)}</span></div>
      <div class="ai-situation-card-block">
        <span class="ai-situation-card-k">${escapeHtml(goalL)}</span>
        <p class="ai-situation-card-goal">${escapeHtml(sc.goal)}</p>
      </div>
      <div class="ai-situation-card-block">
        <span class="ai-situation-card-k">${escapeHtml(exprL)}</span>
        ${exprBlock}
      </div>
    </div>
  `;
}

/**
 * 상황 대화 完整 HTML（含场景卡、开始、逐轮区、完成态容器）
 */
export function renderSituationDialogueShell(plan, lang) {
  const sc = plan.scenarios[plan.defaultIndex];
  const startLabel = t("ai.start_roleplay", "대화 시작");
  const practiceTitle = t("ai.situation_practice_block_title", "대화 연습");
  const replayLabel = t("ai.situation_replay", "다시 듣기");
  const teacherPrompt = t("ai.situation_teacher_prompt", "제가 이렇게 말하면, 어떻게 대답할까요?");
  const studentHint = t("ai.situation_student_refs_label", "학생 답변 예시");
  const nextLabel = t("ai.situation_next", "다음");
  const doneLine = t("ai.situation_complete", "대화 연습이 끝났어요.");
  const restartLabel = t("ai.situation_restart", "다시 시작");
  return `
    <div class="ai-tutor-mode-content ai-tutor-roleplay ai-situation-dialogue" data-situation-root>
      ${scenarioPickerHtml(plan.scenarios, lang)}
      ${scenarioCardHtml(sc, lang)}
      <div class="ai-situation-start-row">
        <button type="button" class="ai-btn ai-btn-primary ai-tutor-run ai-situation-start">${escapeHtml(startLabel)}</button>
      </div>
      <div class="ai-situation-practice hidden" data-situation-practice aria-live="polite">
        <div class="ai-situation-practice-head">${escapeHtml(practiceTitle)}</div>
        <div class="ai-situation-round-meta" data-round-meta></div>
        <div class="ai-situation-ai-line" data-ai-line></div>
        <div class="ai-situation-replay-row">
          <button type="button" class="ai-btn ai-btn-secondary ai-situation-replay" data-replay-btn>${escapeHtml(replayLabel)}</button>
        </div>
        <p class="ai-situation-teacher-prompt" data-teacher-prompt>${escapeHtml(teacherPrompt)}</p>
        <div class="ai-situation-student-block">
          <span class="ai-situation-student-k">${escapeHtml(studentHint)}</span>
          <ul class="ai-situation-student-refs" data-student-refs></ul>
        </div>
        <button type="button" class="ai-btn ai-btn-primary ai-situation-next" data-next-btn>${escapeHtml(nextLabel)}</button>
      </div>
      <div class="ai-situation-done hidden" data-situation-done>
        <p class="ai-situation-done-text">${escapeHtml(doneLine)}</p>
        <button type="button" class="ai-btn ai-btn-secondary ai-situation-restart">${escapeHtml(restartLabel)}</button>
      </div>
    </div>
  `;
}

function formatRoundLabel(n) {
  return t("ai.situation_round_n", "라운드 {n}").replace(/\{n\}/g, String(n));
}

/**
 * 挂载逐轮逻辑（不调用 AI API）
 */
export function mountSituationDialogue(rootEl, plan, lang) {
  if (!rootEl || !plan?.scenarios?.length) return;

  let scenarioIndex = plan.defaultIndex || 0;
  let roundIndex = 0;

  const practiceEl = rootEl.querySelector("[data-situation-practice]");
  const doneEl = rootEl.querySelector("[data-situation-done]");
  const startBtn = rootEl.querySelector(".ai-situation-start");
  const nextBtn = rootEl.querySelector("[data-next-btn]");
  const restartBtn = rootEl.querySelector(".ai-situation-restart");
  const metaEl = rootEl.querySelector("[data-round-meta]");
  const aiLineEl = rootEl.querySelector("[data-ai-line]");
  const teacherPromptEl = rootEl.querySelector("[data-teacher-prompt]");
  const replayBtn = rootEl.querySelector("[data-replay-btn]");
  const refsEl = rootEl.querySelector("[data-student-refs]");
  const chips = rootEl.querySelectorAll(".ai-situation-scenario-chip");

  function currentScenario() {
    return plan.scenarios[scenarioIndex] || plan.scenarios[0];
  }

  function renderRound() {
    const sc = currentScenario();
    const rounds = sc.rounds || [];
    if (!rounds.length || roundIndex >= rounds.length) return;

    const r = rounds[roundIndex];
    const n = roundIndex + 1;
    if (metaEl) metaEl.textContent = formatRoundLabel(n);
    if (aiLineEl) aiLineEl.innerHTML = `<span class="ai-situation-ai-k">AI：</span><span class="ai-situation-ai-zh">${escapeHtml(r.aiLine)}</span>`;
    if (teacherPromptEl) {
      teacherPromptEl.textContent = t("ai.situation_teacher_prompt", "제가 이렇게 말하면, 어떻게 대답할까요?");
    }
    if (refsEl) {
      refsEl.innerHTML = r.studentRefs.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    }

    if (nextBtn) nextBtn.textContent = t("ai.situation_next", "다음");

    speakSituationRoundFull(r.aiLine, lang);
  }

  function showPractice(show) {
    if (practiceEl) practiceEl.classList.toggle("hidden", !show);
  }

  function showDone(show) {
    if (doneEl) doneEl.classList.toggle("hidden", !show);
  }

  function resetRoundState() {
    try {
      AUDIO_ENGINE.stop();
    } catch (_) {}
    roundIndex = 0;
    showPractice(false);
    showDone(false);
    if (startBtn) startBtn.classList.remove("hidden");
  }

  function syncCardToScenario() {
    const sc = currentScenario();
    const oldCard = rootEl.querySelector("[data-situation-card]");
    if (!oldCard) return;
    const html = scenarioCardHtml(sc, lang);
    const tmp = document.createElement("div");
    tmp.innerHTML = html.trim();
    const nextCard = tmp.querySelector("[data-situation-card]");
    if (nextCard) oldCard.replaceWith(nextCard);
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const idx = Number(chip.dataset.scenarioIndex);
      if (Number.isNaN(idx) || idx === scenarioIndex) return;
      scenarioIndex = idx;
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle("ai-situation-scenario-chip--active", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      resetRoundState();
      syncCardToScenario();
    });
  });

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      roundIndex = 0;
      startBtn.classList.add("hidden");
      showDone(false);
      showPractice(true);
      renderRound();
    });
  }

  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      const sc = currentScenario();
      const rounds = sc.rounds || [];
      const r = rounds[roundIndex];
      if (r && r.aiLine) {
        try {
          AUDIO_ENGINE.stop();
        } catch (_) {}
        speakSituationRoundFull(r.aiLine, lang);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const sc = currentScenario();
      const rounds = sc.rounds || [];
      if (roundIndex < rounds.length - 1) {
        roundIndex += 1;
        renderRound();
      } else {
        try {
          AUDIO_ENGINE.stop();
        } catch (_) {}
        showPractice(false);
        showDone(true);
      }
    });
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      resetRoundState();
      const btn = rootEl.querySelector(".ai-situation-start");
      if (btn) btn.classList.remove("hidden");
    });
  }
}
