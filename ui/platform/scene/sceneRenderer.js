/**
 * Scene Engine v1 - 场景 UI 渲染
 * 稳定结构化渲染，无复杂动画
 */

import { getLocalizedSceneText } from "./sceneUtils.js";
import { getSceneDialogueMap } from "./sceneEngine.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function resolveMediaUrl(path) {
  if (!path || !path.startsWith("/")) return path;
  try {
    const base = window.DATA_PATHS?.getBase?.();
    if (base && str(base)) return String(base).replace(/\/+$/, "") + path;
  } catch {}
  return path;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pickLang(obj, lang) {
  return getLocalizedSceneText(obj, lang);
}

/**
 * 渲染 Scene Header（封面 + 标题 + 摘要）
 */
export function renderSceneHeader(scene, lang = "ko") {
  if (!scene) return "";
  const title = pickLang(scene.title, lang);
  const summary = pickLang(scene.summary, lang);
  const cover = str(scene.cover);
  const coverSrc = cover ? resolveMediaUrl(cover) : "";

  const coverHtml = coverSrc
    ? `<img class="scene-cover-image" src="${escapeHtml(coverSrc)}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.style.display='none';if(this.parentElement)this.parentElement.style.display='none'" />`
    : "";

  return `
    <div class="scene-header">
      ${coverHtml ? `<div class="scene-cover-wrap">${coverHtml}</div>` : ""}
      <div class="scene-header-text">
        ${title ? `<h3 class="scene-title">${escapeHtml(title)}</h3>` : ""}
        ${summary ? `<p class="scene-summary">${escapeHtml(summary)}</p>` : ""}
      </div>
    </div>`;
}

/**
 * 渲染场景学习目标（1~3 条）
 */
export function renderSceneGoals(scene, lang = "ko") {
  if (!scene?.goal?.length) return "";
  const goals = scene.goal.slice(0, 3);
  const items = goals.map((g) => {
    const text = pickLang(g, lang);
    return text ? `<li class="scene-goal-item">${escapeHtml(text)}</li>` : "";
  }).filter(Boolean);
  if (!items.length) return "";
  return `
    <div class="scene-goals">
      <div class="scene-goals-title">${lang === "zh" ? "学习目标" : lang === "en" ? "Learning Goals" : "학습 목표"}</div>
      <ul class="scene-goals-list">${items.join("")}</ul>
    </div>`;
}

/**
 * 渲染角色卡
 */
export function renderSceneCharacters(scene, lang = "ko") {
  if (!scene?.characters?.length) return "";
  const cards = scene.characters.map((c) => {
    const name = pickLang(c.name, lang) || c.id;
    const avatar = str(c.avatar);
    const avatarSrc = avatar ? resolveMediaUrl(avatar) : "";
    const avatarHtml = avatarSrc
      ? `<img class="scene-character-avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none';var w=this.closest('.scene-character-avatar-wrap');if(w)w.style.display='none'" />`
      : `<span class="scene-character-placeholder">${escapeHtml(c.id)}</span>`;
    return `
      <div class="scene-character-card">
        <div class="scene-character-avatar-wrap">${avatarHtml}</div>
        <div class="scene-character-name">${escapeHtml(name)}</div>
      </div>`;
  }).join("");
  return `
    <div class="scene-characters">
      <div class="scene-characters-title">${lang === "zh" ? "角色" : lang === "en" ? "Characters" : "등장인물"}</div>
      <div class="scene-characters-grid">${cards}</div>
    </div>`;
}

/**
 * 渲染分镜（frame 图 + 对应对话）
 */
export function renderSceneFrames(scene, lesson, lang = "ko") {
  if (!scene?.frames?.length) return "";
  const dialogue = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const map = getSceneDialogueMap(scene, lesson);

  const blocks = scene.frames.map((frame) => {
    const pair = map.get(frame.id);
    const line = pair?.line;
    const zh = str(line?.zh ?? line?.cn ?? line?.line ?? "");
    const py = str(line?.pinyin ?? line?.py ?? "");
    const spk = str(line?.speaker ?? line?.spk ?? "");
    const trans = line ? pickLang({ zh: line.zh ?? line.line ?? line.cn, kr: line.kr ?? line.ko, en: line.en }, lang) : "";
    const showTrans = trans && trans !== zh;

    const frameSrc = frame.image ? resolveMediaUrl(frame.image) : "";
    const imgHtml = frameSrc
      ? `<img class="scene-frame-image" src="${escapeHtml(frameSrc)}" alt="" loading="lazy" onerror="this.style.display='none';var w=this.closest('.scene-frame-image-wrap');if(w){w.style.display='none'}" />`
      : "";

    const dialogueHtml = zh
      ? `
        <div class="scene-frame-dialogue">
          ${spk ? `<div class="scene-frame-speaker">${escapeHtml(spk)}</div>` : ""}
          <div class="scene-frame-zh">${escapeHtml(zh)}</div>
          ${py ? `<div class="scene-frame-pinyin">${escapeHtml(py)}</div>` : ""}
          ${showTrans ? `<div class="scene-frame-trans">${escapeHtml(trans)}</div>` : ""}
        </div>`
      : "";

    return `
      <article class="scene-frame">
        ${imgHtml ? `<div class="scene-frame-image-wrap">${imgHtml}</div>` : ""}
        ${dialogueHtml}
      </article>`;
  });

  return `
    <div class="scene-frames">
      <div class="scene-frames-title">${lang === "zh" ? "对话分镜" : lang === "en" ? "Dialogue Frames" : "대화 분镜"}</div>
      <div class="scene-frames-list">${blocks.join("")}</div>
    </div>`;
}

/**
 * 渲染完整 scene 区块（header + goals + characters）
 */
export function renderSceneSection(scene, lesson, lang = "ko") {
  if (!scene) return "";
  const header = renderSceneHeader(scene, lang);
  const goals = renderSceneGoals(scene, lang);
  const chars = renderSceneCharacters(scene, lang);
  const frames = renderSceneFrames(scene, lesson, lang);

  return `
    <div class="scene-section">
      ${header}
      ${goals}
      ${chars}
      ${frames}
    </div>`;
}
