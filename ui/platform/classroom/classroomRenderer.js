// /ui/platform/classroom/classroomRenderer.js
// 负责将当前课堂步骤渲染到 .classroom-stage

import { i18n } from "../../i18n.js";
import { getEffectiveTeacherNote, ASSET_TYPE } from "../../lumina-commerce/teacherAssetsStore.js";
import { getClassroomState } from "./classroomState.js";

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    if (!v) return fallback;
    const s = String(v).trim();
    return s && s !== key ? s : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const STEP_TO_SECTION_KEY = {
  scene: "teacher.classroom.section_name_scene",
  words: "teacher.classroom.section_name_words",
  dialogue: "teacher.classroom.section_name_dialogue",
  practice: "teacher.classroom.section_name_practice",
  notes: "teacher.classroom.section_name_notes",
};

/**
 * 当前段“章节头”（老师课件，贴近主内容区顶部）
 * @param {string} step
 * @param {ReturnType<typeof getClassroomState>} state
 */
function renderCoursewareChapterHead(step, state) {
  if (!state.coursewareAsset) return "";
  const arr = state.availableSteps;
  const i = arr.indexOf(step);
  const n = i >= 0 ? i + 1 : 1;
  const total = arr.length || 1;
  const nameKey = /** @type {Record<string, string>} */ (STEP_TO_SECTION_KEY)[String(step)] || "classroom_scene";
  const name = t(nameKey, step);
  return `
<header class="classroom-current-section" aria-label="${escapeHtml(t("teacher.classroom.current_chapter_aria", "当前课堂章节"))}">
  <p class="classroom-current-section-kicker">${escapeHtml(t("teacher.classroom.chapter_kicker", "课堂章节"))}</p>
  <div class="classroom-current-section-row">
    <h2 class="classroom-current-section-title">${escapeHtml(name)}</h2>
    <span class="classroom-current-section-idx" aria-label="${escapeHtml(
    t("teacher.classroom.section_index_aria", { n: String(n), total: String(total) }),
  )}">${escapeHtml(
    t("teacher.classroom.chapter_badge", {
      n: String(n),
      total: String(total),
    }),
  )}</span>
  </div>
</header>`;
}

// 预留：场景元数据提取
export function getSceneMetaFromLesson(lessonData, lang) {
  const scene = lessonData?.scene || "";
  const fallbackTitle = t("classroom_scene", "场景");
  const fallbackDesc = t("classroom_no_scene", "场景准备中");
  return { scene, title: fallbackTitle, description: fallbackDesc };
}

// 预留：游戏元数据提取
export function getGameMetaFromLesson(lessonData, lang) {
  return {
    title: t("classroom_game", "课堂游戏"),
    description: t("classroom_game_coming", "课堂小游戏即将接入。")
  };
}

// 预留：AI 元数据提取
export function getAIMetaFromLesson(lessonData, lang) {
  return {
    title: t("classroom_ai", "AI 课堂助手"),
    description: t("classroom_ai_coming", "AI 课堂助手即将接入。")
  };
}

function renderSceneStep(lesson, lang) {
  const meta = getSceneMetaFromLesson(lesson, lang);
  const st = getClassroomState();
  const cw = st.coursewareAsset;
  const isSlide =
    cw && String(cw.asset_type) === String(ASSET_TYPE.lesson_slide_draft);
  if (isSlide) {
    const ctitle = String(cw?.title || "").trim() || meta.title;
    const csub = String(cw?.subtitle || "").trim();
    const csummary = String(cw?.summary || "").trim();
    const coverN = String(cw?.cover_note || "").trim();
    return `
    <section class="classroom-panel classroom-panel-scene classroom-panel--courseware-slide classroom-panel--cw-kind-cover">
      <div class="classroom-cw-cover-card">
        <p class="classroom-cw-cover-kicker">${escapeHtml(t("teacher.classroom.cw_kicker_cover", "本课结构 · 封面"))}</p>
        <h2 class="classroom-cw-cover-title">${escapeHtml(ctitle)}</h2>
        ${csub ? `<p class="classroom-cw-cover-sub">${escapeHtml(csub)}</p>` : ""}
        ${csummary ? `<p class="classroom-cw-cover-desc">${escapeHtml(csummary)}</p>` : ""}
        ${
          coverN
            ? `<div class="classroom-cw-cover-note" role="note">
          <span class="classroom-cw-cover-note-label">${escapeHtml(t("teacher.classroom.cw_label_cover_blurb", "封面说明"))}</span>
          <p class="classroom-cw-cover-note-t">${escapeHtml(coverN)}</p>
        </div>`
            : ""
        }
        <p class="classroom-cw-scene-embed-desc">${escapeHtml(
          t("teacher.classroom.cw_scene_fallback", "与课程底图/场景区联动（演示）。可在本课节内容中继续配置场景位。"),
        )}</p>
      </div>
    </section>
  `;
  }
  return `
    <section class="classroom-panel classroom-panel-scene">
      <div class="classroom-scene-card">
        <div class="classroom-scene-image">${escapeHtml(t("classroom_scene_image", "场景图片"))}</div>
        <div class="classroom-scene-text">
          <h3 class="classroom-scene-title">${escapeHtml(meta.title)}</h3>
          <p class="classroom-scene-desc">${escapeHtml(meta.description)}</p>
        </div>
      </div>
    </section>
  `;
}

function renderWordsStep(lesson, lang) {
  const st = getClassroomState();
  const isCw = Boolean(st.coursewareAsset);
  const wrap = (inner) => `
    <section class="classroom-panel classroom-panel-words${isCw ? " classroom-panel-words--courseware classroom-panel--cw-kind-vocab" : ""}">
      <p class="classroom-cw-struct-kicker">${escapeHtml(t("teacher.classroom.cw_kicker_vocab", "词汇与核心句"))}</p>
      ${inner}
    </section>`;
  const core = String(lesson?.coreSentence || lesson?.title || "").trim();
  if (!core) {
    return wrap(
      `<p class="classroom-empty">${escapeHtml(t("classroom_no_words", "暂无词汇内容"))}</p><p class="classroom-cw-missing-hint">${escapeHtml(
        t("teacher.classroom.cw_no_lesson_block", "本课节底层内容暂无；可在课程大纲中配置核心句，或先按结构过一遍。"),
      )}</p>`,
    );
  }
  return wrap(`<h3 class="classroom-panel-title">${escapeHtml(t("classroom_words", "单词 / 核心句"))}</h3>
      <div class="classroom-words-main">${escapeHtml(core)}</div>
      <p class="classroom-panel-sub">${escapeHtml(t("classroom_words_hint", "可带读本课核心句和关键词。"))}</p>`);
}

function renderDialogueStep(lesson, lang) {
  const st = getClassroomState();
  const isCw = Boolean(st.coursewareAsset);
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  const rawDia = Array.isArray(lesson?.dialogues) ? lesson.dialogues : [];
  if (!cards.length && !rawDia.length) {
    return `<section class="classroom-panel classroom-panel-dialogue${isCw ? " classroom-panel--courseware-block classroom-panel--cw-kind-dialogue" : ""}"><p class="classroom-cw-struct-kicker">${escapeHtml(
      t("teacher.classroom.cw_kicker_dialogue", "对话与场景"),
    )}</p><p class="classroom-empty">${escapeHtml(
      t("classroom_no_dialogue", "暂无对话内容"),
    )}</p><p class="classroom-cw-missing-hint">${escapeHtml(t("teacher.classroom.cw_no_lesson_block"))}</p></section>`;
  }
  return `
    <section class="classroom-panel classroom-panel-dialogue${isCw ? " classroom-panel--courseware-block classroom-panel--cw-kind-dialogue" : ""}">
      <p class="classroom-cw-struct-kicker">${escapeHtml(t("teacher.classroom.cw_kicker_dialogue", "对话与场景"))}</p>
      <h3 class="classroom-panel-title">${escapeHtml(t("classroom_dialogue", "课堂对话"))}</h3>
      <p class="classroom-panel-sub">${escapeHtml(t("classroom_dialogue_hint", "按句点读，带学生跟读。"))}</p>
    </section>
  `;
}

function renderPracticeStep(lesson, lang) {
  const st = getClassroomState();
  const isCw = Boolean(st.coursewareAsset);
  const hasPractice = Array.isArray(lesson?.practice) && lesson.practice.length;
  if (!hasPractice) {
    return `<section class="classroom-panel classroom-panel-practice${
      isCw ? " classroom-panel--courseware-block classroom-panel--cw-kind-practice" : ""
    }"><p class="classroom-cw-struct-kicker">${escapeHtml(t("teacher.classroom.cw_kicker_practice", "练习"))}</p><p class="classroom-empty">${escapeHtml(
      t("classroom_no_practice", "本课暂未配置课堂练习。"),
    )}</p><p class="classroom-cw-missing-hint">${escapeHtml(t("teacher.classroom.cw_no_lesson_block"))}</p></section>`;
  }
  return `
    <section class="classroom-panel classroom-panel-practice${isCw ? " classroom-panel--courseware-block classroom-panel--cw-kind-practice" : ""}">
      <p class="classroom-cw-struct-kicker">${escapeHtml(t("teacher.classroom.cw_kicker_practice", "练习"))}</p>
      <h3 class="classroom-panel-title">${escapeHtml(t("classroom_practice", "课堂练习"))}</h3>
      <p class="classroom-panel-sub">${escapeHtml(t("classroom_practice_hint", "可让学生口头作答或配合作业系统。"))}</p>
    </section>
  `;
}

/**
 * 教师备注 / 教学提示（课件结构中的 notes 段；数据来自教师资产）
 * @param {import('../../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset | null} asset
 */
function renderNotesStep(lesson, lang, asset) {
  const body = asset ? getEffectiveTeacherNote(asset) : "";
  if (!String(body).trim()) {
    return `<section class="classroom-panel classroom-panel-notes classroom-panel--cw-kind-notes"><p class="classroom-empty">${escapeHtml(
      t("teacher.classroom.notes_empty", "暂无教师备注。"),
    )}</p></section>`;
  }
  return `
    <section class="classroom-panel classroom-panel-notes classroom-panel--cw-kind-notes" role="complementary" aria-label="${escapeHtml(
      t("teacher.classroom.notes_aria", "教学提示与教师备注"),
    )}">
      <p class="classroom-notes-eyebrow">${escapeHtml(t("teacher.classroom.notes_eyebrow", "教学提示"))}</p>
      <h3 class="classroom-panel-title classroom-notes-title">${escapeHtml(
        t("teacher.classroom.notes_block_title_v2", "教学提示与授课参考"),
      )}</h3>
      <p class="classroom-notes-lead">${escapeHtml(t("teacher.classroom.notes_for_reference", "供老师授课参考，可与学生侧展示策略配合使用。"))}</p>
      <div class="classroom-notes-body">${escapeHtml(String(body))}</div>
    </section>
  `;
}

function renderGameStep(lesson, lang) {
  const meta = getGameMetaFromLesson(lesson, lang);
  return `
    <section class="classroom-panel classroom-panel-game">
      <h3 class="classroom-panel-title">${escapeHtml(meta.title)}</h3>
      <p class="classroom-panel-sub">${escapeHtml(meta.description)}</p>
    </section>
  `;
}

function renderAIStep(lesson, lang) {
  const meta = getAIMetaFromLesson(lesson, lang);
  return `
    <section class="classroom-panel classroom-panel-ai">
      <h3 class="classroom-panel-title">${escapeHtml(meta.title)}</h3>
      <p class="classroom-panel-sub">${escapeHtml(meta.description)}</p>
    </section>
  `;
}

export function renderClassroomStage(rootEl) {
  if (!rootEl) return;
  const state = getClassroomState();
  const step = state.currentStep || "scene";
  const lesson = state.lessonData || {};
  const lang = (i18n?.getLang?.() || "kr").toLowerCase();

  let html = "";
  if (step === "scene") html = renderSceneStep(lesson, lang);
  else if (step === "words") html = renderWordsStep(lesson, lang);
  else if (step === "dialogue") html = renderDialogueStep(lesson, lang);
  else if (step === "practice") html = renderPracticeStep(lesson, lang);
  else if (step === "notes") html = renderNotesStep(lesson, lang, state.coursewareAsset);
  else if (step === "game") html = renderGameStep(lesson, lang);
  else if (step === "ai") html = renderAIStep(lesson, lang);

  if (state.coursewareAsset) {
    const ch = renderCoursewareChapterHead(step, state);
    html = `<div class="classroom-cw-slide" data-cw-step="${escapeHtml(String(step))}">${ch}<div class="classroom-cw-slide-panel">${html}</div></div>`;
  }
  rootEl.innerHTML = html;
}

