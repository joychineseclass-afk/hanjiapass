/**
 * 상황 대화：固定场景卡 + 逐轮对话练习（非 AI 长文回复区）
 * 数据优先来自 lesson.aiPractice.situationDialogue；缺省时从 dialogueCards 推导。
 */

import { i18n } from "../../i18n.js";
import { AUDIO_ENGINE } from "../../platform/index.js";
import { buildAcceptableSet, judgeSituationRound } from "./aiSituationJudge.js";
import {
  createZhSituationRecognizer,
  isSituationZhSpeechSupported,
  SITUATION_ASR_CODE,
} from "./aiSituationZhSpeech.js";

/**
 * 상황 대화：음성 답변(녹음·Web Speech) 노출 여부.
 * false 이면 UI 에서 녹음/인식/피드백을 숨기고 다음 만 사용 — 실제 기기에서 ASR 이 불안정할 때 사용.
 * true 로 바꾸면 아래 마운트 로직·DOM 이 다시 활성화됨(코어 모듈 aiSituationZhSpeech.js 는 그대로 유지).
 */
const SITUATION_VOICE_ANSWER_ENABLED = false;

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
    .map((r) => {
      const studentRefs = (Array.isArray(r.studentRefs) ? r.studentRefs : []).map(str).filter(Boolean);
      const acceptable = buildAcceptableSet(studentRefs, r.acceptable);
      return {
        aiLine: str(r.aiLine),
        studentRefs,
        acceptable,
        closeAnswers: Array.isArray(r.closeAnswers) ? r.closeAnswers.map(str).filter(Boolean) : [],
      };
    })
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
            .map((r) => {
              const studentRefs = Array.isArray(r.studentRefs)
                ? r.studentRefs.map(str).filter(Boolean).slice(0, 2)
                : r.studentRef
                  ? [str(r.studentRef)]
                  : [];
              const acceptable = buildAcceptableSet(studentRefs, r.acceptable);
              return {
                aiLine: str(r.aiLine != null ? r.aiLine : r.ai),
                studentRefs,
                acceptable,
                closeAnswers: Array.isArray(r.closeAnswers) ? r.closeAnswers.map(str).filter(Boolean) : [],
              };
            })
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
        ${
          SITUATION_VOICE_ANSWER_ENABLED
            ? `
        <div class="ai-situation-speak-zone" data-speak-zone>
          <button type="button" class="ai-btn ai-btn-secondary ai-situation-record-btn" data-record-btn>${escapeHtml(t("ai.situation_record_start", "녹음 시작"))}</button>
          <p class="ai-situation-asr-unsupported hidden" data-asr-unsupported>${escapeHtml(t("ai.situation_speech_unsupported", "이 브라우저에서는 음성 인식을 사용할 수 없어요. 텍스트로 연습해 보세요."))}</p>
        </div>`
            : ""
        }
        <div class="ai-situation-student-block">
          <span class="ai-situation-student-k">${escapeHtml(studentHint)}</span>
          <ul class="ai-situation-student-refs" data-student-refs></ul>
        </div>
        ${
          SITUATION_VOICE_ANSWER_ENABLED
            ? `
        <div class="ai-situation-user-answer hidden" data-user-answer-wrap>
          <span class="ai-situation-user-answer-k">${escapeHtml(t("ai.situation_my_answer", "내 대답"))}</span>
          <span class="ai-situation-user-answer-zh" data-user-transcript></span>
        </div>
        <div class="ai-situation-feedback hidden" data-feedback-box role="status"></div>
        <div class="ai-situation-actions-row">
          <button type="button" class="ai-btn ai-btn-secondary ai-situation-retry-speak hidden" data-retry-speak-btn>${escapeHtml(t("ai.situation_retry_speak", "다시 말하기"))}</button>
          <button type="button" class="ai-btn ai-btn-primary ai-situation-next" data-next-btn>${escapeHtml(nextLabel)}</button>
        </div>`
            : `
        <div class="ai-situation-actions-row">
          <button type="button" class="ai-btn ai-btn-primary ai-situation-next" data-next-btn>${escapeHtml(nextLabel)}</button>
        </div>`
        }
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

const ASR_LOG = "[SituationASR]";

function logSituationAsr(...args) {
  if (typeof console !== "undefined" && console.log) console.log(ASR_LOG, ...args);
}

function buildSituationFeedback(tier, round, heard) {
  const expected = str(round.studentRefs?.[0]) || str(round.acceptable?.[0]) || "—";
  const h = str(heard) || t("ai.situation_asr_empty", "(인식 없음)");
  if (tier === "correct") {
    return t("ai.situation_fb_ok", '잘했어요! 「{answer}」라고 자연스럽게 말했어요.').replace("{answer}", expected);
  }
  if (tier === "close") {
    return t(
      "ai.situation_fb_close",
      '좋아요. 뜻은 비슷하지만, 이 과에서는 「{expected}」를 먼저 익혀요. (들은 말: 「{heard}」)',
    )
      .replace("{expected}", expected)
      .replace("{heard}", h);
  }
  return t(
    "ai.situation_fb_bad",
    '이 상황에서는 「{expected}」라고 말하면 더 자연스러워요. (들은 말: 「{heard}」)',
  )
    .replace("{expected}", expected)
    .replace("{heard}", h);
}

/**
 * 录音/识别失败类 UI（与 judge 的「识别到但不匹配」区分）
 */
function messageForAsrSystemFailure(code, stopPayload) {
  const err = stopPayload && stopPayload.speechError;

  if (code === SITUATION_ASR_CODE.PERMISSION_DENIED) {
    return t("ai.situation_asr_err_permission", "마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요.");
  }
  if (code === SITUATION_ASR_CODE.MIC_OPEN_FAILED) {
    return t("ai.situation_asr_err_mic", "마이크를 열 수 없어요. 장치 연결을 확인해 주세요.");
  }
  if (code === SITUATION_ASR_CODE.NO_AUDIO_INPUT) {
    return t(
      "ai.situation_asr_err_no_audio",
      "소리가 거의 들리지 않았어요. 마이크를 가까이 두고 다시 말해 보세요.",
    );
  }
  if (code === SITUATION_ASR_CODE.NOT_SUPPORTED) {
    return t("ai.situation_speech_unsupported", "이 브라우저에서는 음성 인식을 사용할 수 없어요.");
  }
  if (code === SITUATION_ASR_CODE.NO_RESULT) {
    return t("ai.situation_asr_err_no_hear", "잘 들리지 않았어요. 조금 더 크게 말해 보세요.");
  }
  if (code === SITUATION_ASR_CODE.RECOGNITION_ERROR && err && err.error === "network") {
    return t(
      "ai.situation_asr_err_service",
      "음성 인식 서비스에 일시적으로 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (code === SITUATION_ASR_CODE.RECOGNITION_ERROR) {
    return t(
      "ai.situation_asr_err_recognition",
      "음성 인식 중 오류가 났어요. 다시 말하기를 눌러 주세요.",
    );
  }
  return t("ai.situation_asr_err_generic", "문제가 발생했어요. 다시 말하기를 눌러 주세요.");
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
  const recordBtn = rootEl.querySelector("[data-record-btn]");
  const userAnswerWrap = rootEl.querySelector("[data-user-answer-wrap]");
  const userTranscriptEl = rootEl.querySelector("[data-user-transcript]");
  const feedbackBox = rootEl.querySelector("[data-feedback-box]");
  const retrySpeakBtn = rootEl.querySelector("[data-retry-speak-btn]");
  const asrUnsupportedEl = rootEl.querySelector("[data-asr-unsupported]");
  const chips = rootEl.querySelectorAll(".ai-situation-scenario-chip");

  const recognizer = SITUATION_VOICE_ANSWER_ENABLED ? createZhSituationRecognizer() : null;
  let recording = false;

  function abortSituationRecognizer() {
    if (!recognizer) return;
    try {
      recognizer.abort();
    } catch (_) {}
  }

  function currentScenario() {
    return plan.scenarios[scenarioIndex] || plan.scenarios[0];
  }

  function clearUserAnswerUi() {
    if (userAnswerWrap) userAnswerWrap.classList.add("hidden");
    if (userTranscriptEl) userTranscriptEl.textContent = "";
    if (feedbackBox) {
      feedbackBox.classList.add("hidden");
      feedbackBox.textContent = "";
    }
    if (retrySpeakBtn) retrySpeakBtn.classList.add("hidden");
  }

  function renderRound() {
    abortSituationRecognizer();
    recording = false;

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

    clearUserAnswerUi();
    if (SITUATION_VOICE_ANSWER_ENABLED && recordBtn) {
      const sup = isSituationZhSpeechSupported();
      recordBtn.disabled = !sup;
      recordBtn.textContent = t("ai.situation_record_start", "녹음 시작");
    }
    if (SITUATION_VOICE_ANSWER_ENABLED && asrUnsupportedEl) {
      asrUnsupportedEl.classList.toggle("hidden", isSituationZhSpeechSupported());
    }

    if (nextBtn) nextBtn.textContent = t("ai.situation_next", "다음");

    speakSituationRoundFull(r.aiLine, lang);
  }

  function showAnswerAndFeedback(transcriptRaw, tier, round) {
    const text = str(transcriptRaw);
    if (userAnswerWrap) userAnswerWrap.classList.remove("hidden");
    if (userTranscriptEl) userTranscriptEl.textContent = text || "—";
    if (feedbackBox) {
      feedbackBox.classList.remove("hidden");
      feedbackBox.textContent = buildSituationFeedback(tier, round, text);
    }
    if (retrySpeakBtn) retrySpeakBtn.classList.remove("hidden");
  }

  /** 有识别文本但与本轮参考不匹配（与系统层失败区分） */
  function showRecognizedMismatch(transcriptRaw, round) {
    const text = str(transcriptRaw);
    logSituationAsr("failure_layer", "recognized_but_not_matched", "raw_text=", JSON.stringify(text));
    if (userAnswerWrap) userAnswerWrap.classList.remove("hidden");
    if (userTranscriptEl) userTranscriptEl.textContent = text || "—";
    if (feedbackBox) {
      feedbackBox.classList.remove("hidden");
      const lead = t(
        "ai.situation_asr_mismatch_lead",
        "음성은 인식됐지만, 이번 표현과는 조금 달라요.",
      );
      feedbackBox.textContent = `${lead}\n${buildSituationFeedback("bad", round, text)}`;
    }
    if (retrySpeakBtn) retrySpeakBtn.classList.remove("hidden");
  }

  function showAsrSystemFailure(code, stopPayload) {
    if (userAnswerWrap) userAnswerWrap.classList.add("hidden");
    if (userTranscriptEl) userTranscriptEl.textContent = "";
    if (feedbackBox) {
      feedbackBox.classList.remove("hidden");
      feedbackBox.textContent = messageForAsrSystemFailure(code, stopPayload);
    }
    if (retrySpeakBtn) retrySpeakBtn.classList.remove("hidden");
  }

  function showPractice(show) {
    if (practiceEl) practiceEl.classList.toggle("hidden", !show);
  }

  function showDone(show) {
    if (doneEl) doneEl.classList.toggle("hidden", !show);
  }

  function resetRoundState() {
    abortSituationRecognizer();
    recording = false;
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

  if (SITUATION_VOICE_ANSWER_ENABLED && recordBtn && isSituationZhSpeechSupported()) {
    recordBtn.addEventListener("click", async () => {
      const sc = currentScenario();
      const rounds = sc.rounds || [];
      const r = rounds[roundIndex];
      if (!r) return;

      if (!recording) {
        try {
          AUDIO_ENGINE.stop();
        } catch (_) {}
        const started = await recognizer.start();
        if (!started.ok) {
          recording = false;
          recordBtn.textContent = t("ai.situation_record_start", "녹음 시작");
          logSituationAsr(
            "start_failed",
            started.code,
            started.error && started.error.name,
            started.error && started.error.message,
          );
          showAsrSystemFailure(started.code || SITUATION_ASR_CODE.RECOGNITION_ERROR, {
            speechError: started.error
              ? {
                  error: String(started.error.name || "Error"),
                  message: String(started.error.message || ""),
                }
              : null,
          });
          return;
        }
        recording = true;
        recordBtn.textContent = t("ai.situation_record_stop", "녹음 종료");
        return;
      }

      recording = false;
      recordBtn.textContent = t("ai.situation_record_start", "녹음 시작");
      const stopRes = await recognizer.stop();
      logSituationAsr(
        "stop_summary",
        "finalCode=",
        stopRes.finalCode,
        "recognition.lang=",
        stopRes.recognitionLang,
        "micStreamAcquired=",
        stopRes.micStreamAcquired,
        "maxAudioLevel=",
        stopRes.maxAudioLevel,
      );

      const trimmed = str(stopRes.rawText).trim();
      if (!trimmed) {
        if (stopRes.finalCode === SITUATION_ASR_CODE.OK) {
          logSituationAsr("unexpected empty with OK code");
        }
        showAsrSystemFailure(stopRes.finalCode, stopRes);
        return;
      }

      const { tier } = judgeSituationRound(trimmed, r);
      if (tier === "bad") {
        showRecognizedMismatch(trimmed, r);
        return;
      }
      showAnswerAndFeedback(trimmed, tier, r);
    });
  }

  if (SITUATION_VOICE_ANSWER_ENABLED && retrySpeakBtn) {
    retrySpeakBtn.addEventListener("click", () => {
      abortSituationRecognizer();
      recording = false;
      if (recordBtn) {
        recordBtn.disabled = !isSituationZhSpeechSupported();
        recordBtn.textContent = t("ai.situation_record_start", "녹음 시작");
      }
      clearUserAnswerUi();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      abortSituationRecognizer();
      recording = false;
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
