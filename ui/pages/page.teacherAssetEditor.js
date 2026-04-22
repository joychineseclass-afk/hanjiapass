// #teacher-asset-editor?id=<tasset_xxx> — 课件型课堂资产最小编辑（localStorage）
import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import {
  findAssetById,
  updateTeacherAsset,
  getEffectiveTeacherNote,
  defaultSlideOutline,
  ASSET_STATUS,
  ASSET_TYPE,
} from "../lumina-commerce/teacherAssetsStore.js";
import { i18n } from "../i18n.js";
import { teacherBackToWorkspaceHtml, teacherWorkspaceSubnavHtml } from "./teacherPathNav.js";

function tx(p, a) {
  return safeUiText(p, a);
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function parseIdFromHash() {
  const h = String(location.hash || "");
  const q = h.indexOf("?");
  if (q < 0) return "";
  return String(new URLSearchParams(h.slice(q + 1)).get("id") || "").trim();
}

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherSlideOutlineItemV1} item
 * @param {number} idx
 * @param {(k: string, p?: object) => string} t
 * @param {boolean} readOnly
 */
function outlineRowHtml(item, idx, t, readOnly) {
  const k = String(item.kind);
  const kindKey =
    { cover: "kind_cover", vocab: "kind_vocab", dialogue: "kind_dialogue", practice: "kind_practice", notes: "kind_notes" }[k] ||
    "kind_cover";
  const kindLabel = t(`teacher.asset_editor.${kindKey}`);
  return `<li class="teacher-asset-editor-outline-item" data-outline-row data-idx="${idx}" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">
    <div class="teacher-asset-editor-outline-readonly">
      <span class="teacher-asset-editor-outline-kind">${esc(kindLabel)}</span>
    </div>
    <label class="teacher-asset-editor-outline-title">
      <span class="visually-hidden">${esc(t("teacher.asset_editor.outline_item_title"))}</span>
      <input type="text" name="outline_title_${idx}" class="teacher-asset-editor-input" value="${esc(item.title)}" data-field="title"${readOnly ? " readonly" : ""} />
    </label>
    <label class="teacher-asset-editor-outline-en">
      <input type="checkbox" data-field="enabled" ${item.enabled !== false ? "checked" : ""}${readOnly ? " disabled" : ""} />
      <span class="teacher-asset-editor-en-label">${esc(t("teacher.asset_editor.outline_enable_label"))}</span>
    </label>
  </li>`;
}

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} a
 * @param {(k: string, p?: object) => string} t
 * @param {string} userId
 * @param {string} profileId
 * @param {boolean} canEdit
 * @param {boolean} isArchived
 */
function editorFormHtml(a, t, userId, profileId, canEdit, isArchived) {
  const src = a.source;
  const ro = canEdit && !isArchived ? "" : " readonly";
  const dis = canEdit && !isArchived ? "" : " disabled";
  const outline = (a.slide_outline && a.slide_outline.length ? a.slide_outline : defaultSlideOutline())
    .map((it, i) => outlineRowHtml(it, i, t, isArchived))
    .join("");
  const disHint = isArchived
    ? `<p class="teacher-asset-editor-banner teacher-asset-editor-banner--warn" role="status">${esc(t("teacher.asset_editor.readonly_archived"))}</p>`
    : "";
  return `
    <form id="teacherAssetEditorForm" class="teacher-asset-editor-form">
      ${disHint}
      <div class="teacher-asset-editor-section card">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_meta"))}</h2>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.title"))}</span>
          <input class="teacher-asset-editor-input" name="title" value="${esc(a.title)}"${ro} required />
        </label>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.subtitle"))}</span>
          <input class="teacher-asset-editor-input" name="subtitle" value="${esc(a.subtitle || "")}"${ro} />
        </label>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.summary"))}</span>
          <textarea class="teacher-asset-editor-textarea" name="summary" rows="3"${ro}>${esc(a.summary || "")}</textarea>
        </label>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.teacher_note"))}</span>
          <textarea class="teacher-asset-editor-textarea" name="teacher_note" rows="3"${ro}>${esc(getEffectiveTeacherNote(a))}</textarea>
        </label>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.cover_note"))}</span>
          <textarea class="teacher-asset-editor-textarea" name="cover_note" rows="2"${ro}>${esc(a.cover_note || "")}</textarea>
        </label>
      </div>
      <div class="teacher-asset-editor-section card">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.outline"))}</h2>
        <ol class="teacher-asset-editor-outline-list">${outline}</ol>
      </div>
      <div class="teacher-asset-editor-section card">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.source_readonly"))}</h2>
        <dl class="teacher-asset-editor-dl">
          <div><dt>${esc(t("teacher.asset_editor.source_course"))}</dt><dd>${esc(formatTeacherHubCourseDisplay(String(src.course)))}</dd></div>
          <div><dt>Level</dt><dd>${esc(String(src.level))}</dd></div>
          <div><dt>Lesson</dt><dd>${esc(String(src.lesson))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.asset_type"))}</dt><dd>${esc(t(`teacher.assets.type.${a.asset_type}`))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.status"))}</dt><dd>${esc(t(`teacher.assets.state.${a.status}`))}</dd></div>
        </dl>
      </div>
      <div class="teacher-asset-editor-actions">
        <button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetEditorSave" ${!canEdit || isArchived ? "disabled" : ""}>
          ${esc(t("teacher.asset_editor.save"))}
        </button>
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${esc(t("teacher.asset_editor.back_assets"))}</a>
        <a class="teacher-hub-cta teacher-hub-cta--accent" href="#classroom?assetId=${encodeURIComponent(a.id)}">${esc(t("teacher.asset_editor.to_classroom"))}</a>
      </div>
    </form>
  `;
}

function collectOutlineFromDom(root) {
  const items = root.querySelectorAll("[data-outline-row]");
  const out = [];
  items.forEach((el, idx) => {
    const id = el.getAttribute("data-id") || `slide_${idx}`;
    const kind = el.getAttribute("data-kind") || "cover";
    const titleInp = el.querySelector('input[data-field="title"]');
    const enCb = el.querySelector('input[data-field="enabled"]');
    out.push({
      id,
      kind,
      title: titleInp && "value" in titleInp ? String(/** @type {HTMLInputElement} */ (titleInp).value) : "",
      enabled: enCb && "checked" in enCb ? /** @type {HTMLInputElement} */ (enCb).checked : true,
    });
  });
  return out;
}

async function renderEditor(root) {
  const t = tx;
  const id = parseIdFromHash();
  if (!id) {
    root.innerHTML = `<div class="wrap teacher-asset-editor-page"><p class="card teacher-asset-editor-empty">${esc(
      t("teacher.asset_editor.missing_id"),
    )}</p></div>`;
    i18n.apply?.(root);
    return;
  }
  let ctx;
  try {
    ctx = await getTeacherPageContext();
  } catch {
    root.innerHTML = `<div class="wrap"><p>${esc(t("common.loading"))}</p></div>`;
    return;
  }
  if (!ctx.isLoggedIn) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.forbidden"))}</p></div>`;
    return;
  }
  if (!ctx.isTeacherRole || !ctx.isApproved || !ctx.profile) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.gated"))}</p></div>`;
    return;
  }
  const a = findAssetById(id);
  if (!a) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.not_found"))}</p></div>`;
    return;
  }
  const u = getCurrentUser();
  const sameProfile = String(a.teacher_profile_id) === String(ctx.profile.id);
  const sameOwner = String(a.owner_user_id) === String(u.id);
  if (!sameProfile && !sameOwner) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.forbidden_edit"))}</p></div>`;
    return;
  }
  if (a.asset_type !== ASSET_TYPE.lesson_slide_draft) {
    root.innerHTML = `<div class="wrap card teacher-asset-editor-denied"><p>${esc(t("teacher.asset_editor.not_lesson_draft"))}</p></div>`;
    return;
  }
  const isArchived = a.status === ASSET_STATUS.archived;
  const canEdit = !isArchived;

  root.innerHTML = `
    <div class="wrap teacher-asset-editor-page">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker">${esc(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("assets", t)}
      <header class="card teacher-asset-editor-hero">
        <h1 class="teacher-asset-editor-title">${esc(t("teacher.asset_editor.page_title"))}</h1>
        <p class="teacher-asset-editor-lead">${esc(t("teacher.asset_editor.lead"))}</p>
      </header>
      ${editorFormHtml(a, t, u.id, ctx.profile.id, canEdit, isArchived)}
    </div>
  `;
  i18n.apply?.(root);

  const form = root.querySelector("#teacherAssetEditorForm");
  root.querySelector("#teacherAssetEditorSave")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (!form || isArchived) return;
    const fd = new FormData(/** @type {HTMLFormElement} */ (form));
    const outline = collectOutlineFromDom(root);
    const next = updateTeacherAsset({
      id: a.id,
      title: String(fd.get("title") || a.title).trim() || a.title,
      subtitle: String(fd.get("subtitle") || ""),
      summary: String(fd.get("summary") || ""),
      teacher_note: String(fd.get("teacher_note") || ""),
      cover_note: String(fd.get("cover_note") || ""),
      slide_outline: outline,
    });
    if (next) {
      try {
        alert(t("teacher.asset_editor.save_ok"));
      } catch {
        /* */
      }
    }
  });
}

let __h = null;
let __e = null;
let __r = null;

export default function pageTeacherAssetEditor(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;
  __r = root;
  if (__h) window.removeEventListener("hashchange", __h);
  __h = () => {
    if (__r?.isConnected) void renderEditor(__r);
  };
  window.addEventListener("hashchange", __h);
  if (__e) window.removeEventListener("joy:langChanged", __e);
  __e = () => {
    if (__r?.isConnected) void renderEditor(__r);
  };
  window.addEventListener("joy:langChanged", __e);
  void renderEditor(root);
}
export function mount(c) {
  return pageTeacherAssetEditor(c);
}
export function render(c) {
  return pageTeacherAssetEditor(c);
}
