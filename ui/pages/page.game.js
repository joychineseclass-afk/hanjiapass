// /ui/pages/page.game.js
// 教师端：课堂小游戏展示页（#/game/{id}）

import { i18n } from "../i18n.js";
import { getGameById } from "../modules/games/gamesRegistry.js";
import { loadGameData } from "../modules/games/gamesEngine.js";

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

function getGameIdFromHash() {
  const raw = String(location.hash || "").trim();
  // patterns: #game/hello-ball, /index.html#game/hello-ball
  const idx = raw.indexOf("#game");
  if (idx < 0) return "";
  const sub = raw.slice(idx + "#game".length);
  if (!sub.startsWith("/")) return "";
  return sub.slice(1).split(/[?#]/)[0];
}

export default async function pageGame(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  const id = getGameIdFromHash();
  const meta = getGameById(id);

  root.innerHTML = `
    <div class="teacher-page wrap">
      <section class="teacher-hero card">
        <div class="hero">
          <h2 class="title">${escapeHtml(t("teacher_game_view", "课堂小游戏"))}</h2>
          <p class="desc">${escapeHtml(t("teacher_game_view_desc", "用于课堂投屏的游戏说明页。"))}</p>
        </div>
      </section>
      <section class="card">
        <div class="hero">
          <p class="desc">${escapeHtml(t("common_loading", "加载中..."))}</p>
        </div>
      </section>
    </div>
  `;

  if (!meta) {
    root.innerHTML = `
      <div class="teacher-page wrap">
        <section class="card">
          <div class="hero">
            <h2 class="title">${escapeHtml(t("teacher_game_not_found", "未找到小游戏"))}</h2>
            <p class="desc">${escapeHtml(id || "-")}</p>
          </div>
        </section>
      </div>
    `;
    return;
  }

  const { detail } = await loadGameData(id);
  const title = meta.title || id;
  const type = meta.type || "";

  const steps = Array.isArray(detail?.steps) ? detail.steps : [];
  const desc = (detail && detail.description && (detail.description.cn || detail.description.kr || detail.description.en || detail.description.jp)) || "";

  root.innerHTML = `
    <div class="teacher-page wrap">
      <section class="teacher-hero card">
        <div class="hero">
          <h2 class="title">${escapeHtml(title)}</h2>
          <p class="desc">${escapeHtml(type ? `${type}` : "")}</p>
        </div>
      </section>

      <section class="card">
        <div class="hero">
          ${desc ? `<p class="desc">${escapeHtml(desc)}</p>` : ""}
        </div>
        <div class="p-4">
          ${steps.length
            ? `<ol class="list-decimal pl-5 space-y-2 text-sm text-slate-700">
              ${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
            </ol>`
            : `<p class="text-sm text-slate-500">${escapeHtml(t("teacher_game_no_steps", "暂未配置详细步骤"))}</p>`}
        </div>
      </section>
    </div>
  `;

  i18n.apply?.(root);
}

export function mount(ctxOrRoot) {
  return pageGame(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageGame(ctxOrRoot);
}

