// /ui/platform/classroom/classroomRenderer.js
// 负责将当前课堂步骤渲染到 .classroom-stage

import { i18n } from "../../i18n.js";
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
  const core = String(lesson?.coreSentence || lesson?.title || "").trim();
  if (!core) {
    return `<section class="classroom-panel"><p class="classroom-empty">${escapeHtml(t("classroom_no_words", "暂无词汇内容"))}</p></section>`;
  }
  return `
    <section class="classroom-panel classroom-panel-words">
      <h3 class="classroom-panel-title">${escapeHtml(t("classroom_words", "单词 / 核心句"))}</h3>
      <div class="classroom-words-main">${escapeHtml(core)}</div>
      <p class="classroom-panel-sub">${escapeHtml(t("classroom_words_hint", "可带读本课核心句和关键词。"))}</p>
    </section>
  `;
}

function renderDialogueStep(lesson, lang) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  const rawDia = Array.isArray(lesson?.dialogues) ? lesson.dialogues : [];
  if (!cards.length && !rawDia.length) {
    return `<section class="classroom-panel"><p class="classroom-empty">${escapeHtml(t("classroom_no_dialogue", "暂无对话内容"))}</p></section>`;
  }
  return `
    <section class="classroom-panel classroom-panel-dialogue">
      <h3 class="classroom-panel-title">${escapeHtml(t("classroom_dialogue", "课堂对话"))}</h3>
      <p class="classroom-panel-sub">${escapeHtml(t("classroom_dialogue_hint", "按句点读，带学生跟读。"))}</p>
    </section>
  `;
}

function renderPracticeStep(lesson, lang) {
  const hasPractice = Array.isArray(lesson?.practice) && lesson.practice.length;
  if (!hasPractice) {
    return `<section class="classroom-panel"><p class="classroom-empty">${escapeHtml(t("classroom_no_practice", "本课暂未配置课堂练习。"))}</p></section>`;
  }
  return `
    <section class="classroom-panel classroom-panel-practice">
      <h3 class="classroom-panel-title">${escapeHtml(t("classroom_practice", "课堂练习"))}</h3>
      <p class="classroom-panel-sub">${escapeHtml(t("classroom_practice_hint", "可让学生口头作答或配合作业系统。"))}</p>
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
  else if (step === "game") html = renderGameStep(lesson, lang);
  else if (step === "ai") html = renderAIStep(lesson, lang);

  rootEl.innerHTML = html;
}

