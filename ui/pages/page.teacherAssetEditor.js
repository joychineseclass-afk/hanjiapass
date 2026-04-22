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
import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import {
  findListingByAssetId,
  ensureListingForTeacherAsset,
  submitTeacherAssetListingForReview,
  setClassroomAssetListingToPublic,
  syncClassroomAssetListingFromAsset,
  getAssetEditorPublishingModel,
} from "../lumina-commerce/teacherListingBridge.js";
import { LISTING_STATUS, VISIBILITY } from "../lumina-commerce/enums.js";
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
  const isNotes = k === "notes";
  const on = item.enabled !== false;
  return `<li class="teacher-asset-editor-outline-item ${isNotes ? "teacher-asset-editor-outline-item--notes" : ""} teacher-asset-editor-outline-item--${esc(k)}" data-outline-row data-idx="${idx}" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">
    <div class="teacher-asset-editor-outline-head">
      <span class="teacher-asset-editor-kind-pill" title="${esc(kindLabel)}">${esc(kindLabel)}</span>
    </div>
    <div class="teacher-asset-editor-outline-body">
      <label class="teacher-asset-editor-outline-title">
        <span class="teacher-asset-editor-sublabel">${esc(t("teacher.asset_editor.outline_item_title"))}</span>
        <input type="text" name="outline_title_${idx}" class="teacher-asset-editor-input" value="${esc(item.title)}" data-field="title"${readOnly ? " readonly" : ""} />
      </label>
      <div class="teacher-asset-editor-outline-en-wrap">
        <span class="teacher-asset-editor-sublabel" id="teacherOutlineEnL_${idx}">${esc(t("teacher.asset_editor.outline_enable_label"))}</span>
        <label class="teacher-asset-editor-en-toggle${readOnly ? " is-disabled" : ""}">
          <input type="checkbox" class="teacher-asset-editor-en-input" data-field="enabled" ${on ? "checked" : ""}${readOnly ? " disabled" : ""} aria-labelledby="teacherOutlineEnL_${idx}" />
          <span class="teacher-asset-editor-en-track" aria-hidden="true">
            <span class="teacher-asset-editor-en-thumb"></span>
          </span>
          <span class="teacher-asset-editor-en-state">${esc(
            on ? t("teacher.asset_editor.outline_state_on") : t("teacher.asset_editor.outline_state_off"),
          )}</span>
        </label>
      </div>
    </div>
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
  const actionsBar = (suffix) => `
    <div class="teacher-asset-editor-actions teacher-asset-editor-actions--bar" id="teacherAssetEditorActions${suffix}">
      <button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetEditorSave${suffix}" data-save-bar="${suffix}" ${
    !canEdit || isArchived ? "disabled" : ""
  }>
        ${esc(t("teacher.asset_editor.save"))}
      </button>
      <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${esc(t("teacher.asset_editor.back_assets"))}</a>
      <a class="teacher-hub-cta teacher-hub-cta--accent" href="#classroom?assetId=${encodeURIComponent(a.id)}">${esc(
    t("teacher.asset_editor.to_classroom_teach"),
  )}</a>
    </div>`;
  return `
    <form id="teacherAssetEditorForm" class="teacher-asset-editor-form">
      ${disHint}
      <div class="teacher-asset-editor-toast" id="teacherAssetEditorToast" role="status" aria-live="polite" hidden></div>
      ${actionsBar("Top")}
      <div class="teacher-asset-editor-section card teacher-asset-editor-section--basics">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_basics"))}</h2>
        <p class="teacher-asset-editor-section-hint">${esc(t("teacher.asset_editor.section_basics_hint"))}</p>
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
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.cover_note"))}</span>
          <textarea class="teacher-asset-editor-textarea" name="cover_note" rows="2"${ro}>${esc(a.cover_note || "")}</textarea>
        </label>
      </div>
      <div class="teacher-asset-editor-section card teacher-asset-editor-section--teacher-note">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_teacher_note"))}</h2>
        <p class="teacher-asset-editor-section-hint">${esc(t("teacher.asset_editor.section_teacher_note_hint"))}</p>
        <label class="teacher-asset-editor-field">
          <span class="teacher-asset-editor-label">${esc(t("teacher.asset_editor.teacher_note"))}</span>
          <textarea class="teacher-asset-editor-textarea" name="teacher_note" rows="4"${ro}>${esc(getEffectiveTeacherNote(a))}</textarea>
        </label>
      </div>
      <div class="teacher-asset-editor-section card teacher-asset-editor-section--outline">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_outline"))}</h2>
        <p class="teacher-asset-editor-section-hint">${esc(t("teacher.asset_editor.section_outline_hint"))}</p>
        <ol class="teacher-asset-editor-outline-list">${outline}</ol>
      </div>
      <div class="teacher-asset-editor-section card teacher-asset-editor-section--source">
        <h2 class="teacher-asset-editor-h">${esc(t("teacher.asset_editor.section_source"))}</h2>
        <dl class="teacher-asset-editor-dl">
          <div><dt>${esc(t("teacher.asset_editor.source_course"))}</dt><dd>${esc(formatTeacherHubCourseDisplay(String(src.course)))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.source_level"))}</dt><dd>${esc(String(src.level))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.source_lesson"))}</dt><dd>${esc(String(src.lesson))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.asset_type"))}</dt><dd>${esc(t(`teacher.assets.type.${a.asset_type}`))}</dd></div>
          <div><dt>${esc(t("teacher.asset_editor.status"))}</dt><dd>${esc(t(`teacher.assets.state.${a.status}`))}</dd></div>
        </dl>
      </div>
      ${actionsBar("Bottom")}
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

/**
 * @param {object} m
 * @param {import('../lumina-commerce/schema.js').Listing|undefined|null} listing
 * @param {(k: string, p?: object) => string} t
 */
function publishingStatusCardHtml(m, listing, t) {
  const L = listing;
  const hasL = m.hasListing;
  const publicLine = hasL
    ? L && L.status === LISTING_STATUS.approved && L.visibility === VISIBILITY.public
      ? t("teacher.asset_editor.publishing_public_yes")
      : t("teacher.asset_editor.publishing_public_no")
    : "—";
  const listingLine = hasL
    ? t("teacher.publishing.badge_listing_yes")
    : t("teacher.publishing.badge_listing_no");
  const goPubDisabled = m.canGoPublic ? "" : " disabled";
  const subDisabled = m.canSubmit ? "" : " disabled";
  const subTitle = m.submitReason ? esc(String(m.submitReason)) : "";
  return `
    <section class="card teacher-asset-editor-section teacher-asset-editor-section--publishing" aria-labelledby="teacherAssetPubH2">
      <h2 class="teacher-asset-editor-h" id="teacherAssetPubH2">${esc(t("teacher.asset_editor.section_publishing"))}</h2>
      <p class="teacher-asset-editor-section-hint">${esc(t("teacher.asset_editor.publishing_lead"))}</p>
      <ul class="teacher-asset-editor-publish-facts" role="list">
        <li><span class="teacher-asset-editor-publish-k">${esc(t("teacher.asset_editor.publishing_row_listing"))}</span> <span class="teacher-asset-editor-publish-v">${esc(listingLine)}</span></li>
        <li><span class="teacher-asset-editor-publish-k">${esc(t("teacher.asset_editor.publishing_row_review"))}</span> <span class="teacher-asset-editor-publish-v">${esc(m.listingStateLine)}</span></li>
        <li><span class="teacher-asset-editor-publish-k">${esc(t("teacher.asset_editor.publishing_row_public"))}</span> <span class="teacher-asset-editor-publish-v">${esc(publicLine)}</span></li>
      </ul>
      <div class="teacher-asset-editor-publish-actions" role="group" aria-label="${esc(t("teacher.asset_editor.publishing_actions_aria"))}">
        ${
          m.showViewPublic && m.listingId
            ? `<a class="teacher-hub-cta teacher-hub-cta--accent" href="#teacher-listing?id=${encodeURIComponent(m.listingId)}">${esc(
                t("teacher.asset_editor.publishing_view_public"),
              )}</a>`
            : ""
        }
        ${
          m.showPreviewListing && m.listingId
            ? `<a class="teacher-hub-cta teacher-hub-cta--primary teacher-hub-cta--preview-listing" href="#teacher-listing?id=${encodeURIComponent(
                m.listingId,
              )}">${esc(t("teacher.asset_editor.publishing_preview_listing"))}</a>`
            : ""
        }
        ${
          m.canCreate
            ? `<button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetCreateListing">${esc(
                t("teacher.asset_editor.publishing_create_listing"),
              )}</button>`
            : ""
        }
        ${
          hasL && m.canSubmit
            ? `<button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherAssetSubmitListing"${subDisabled} title="${subTitle}">${esc(
                t("teacher.asset_editor.publishing_submit_review"),
              )}</button>`
            : ""
        }
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-publishing">${esc(
          t("teacher.asset_editor.publishing_go_my_listings"),
        )}</a>
        ${
          m.canGoPublic
            ? `<button type="button" class="teacher-hub-cta teacher-hub-cta--secondary" id="teacherAssetGoPublic"${goPubDisabled}>${esc(
                t("teacher.asset_editor.publishing_set_public"),
              )}</button>`
            : ""
        }
      </div>
    </section>`;
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

  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const listingRow = snap ? findListingByAssetId(snap, a.id) : null;
  const pubM = getAssetEditorPublishingModel(ctx.profile.id, u.id, listingRow, a, t);
  const publishBlock = publishingStatusCardHtml(pubM, listingRow, t);

  root.innerHTML = `
    <div class="wrap teacher-asset-editor-page">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker">${esc(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("assets", t)}
      <header class="card teacher-surface-hero teacher-asset-editor-hero">
        <h1 class="teacher-asset-editor-title">${esc(t("teacher.asset_editor.page_title"))}</h1>
        <p class="teacher-asset-editor-lead">${esc(t("teacher.asset_editor.lead"))}</p>
        <div class="teacher-surface-action-row" role="navigation" aria-label="${esc(t("teacher.surface.nav_aria"))}">
          <a class="teacher-surface-link teacher-surface-link--secondary" href="#teacher-assets">${esc(t("teacher.asset_editor.back_assets"))}</a>
          <a class="teacher-surface-link" href="#classroom?assetId=${encodeURIComponent(a.id)}">${esc(t("teacher.asset_editor.to_classroom"))}</a>
          <a class="teacher-surface-link" href="#teacher-publishing">${esc(t("teacher.nav.my_publishing"))}</a>
          <a class="teacher-surface-link" href="#teacher-review">${esc(t("teacher.nav.review_console"))}</a>
          ${
            listingRow
              ? `<a class="teacher-surface-link" href="#teacher-listing?id=${encodeURIComponent(listingRow.id)}">${esc(
                  t("teacher.asset_editor.publishing_preview_listing"),
                )}</a>`
              : ""
          }
        </div>
      </header>
      ${publishBlock}
      ${editorFormHtml(a, t, u.id, ctx.profile.id, canEdit, isArchived)}
    </div>
  `;
  i18n.apply?.(root);

  const form = root.querySelector("#teacherAssetEditorForm");
  const toastEl = root.querySelector("#teacherAssetEditorToast");
  const showSaveToast = () => {
    if (!toastEl) return;
    toastEl.textContent = `${t("teacher.asset_editor.save_success")} · ${t("teacher.asset_editor.structure_saved")}`;
    toastEl.removeAttribute("hidden");
    window.clearTimeout(/** @type {any} */ (showSaveToast)._tid);
    /** @type {any} */ (showSaveToast)._tid = window.setTimeout(() => {
      toastEl.setAttribute("hidden", "");
    }, 4200);
  };
  const syncOutlineEnabledLabels = () => {
    root.querySelectorAll('.teacher-asset-editor-en-input[data-field="enabled"]').forEach((inp) => {
      const on = /** @type {HTMLInputElement} */ (inp).checked;
      const host = inp.closest(".teacher-asset-editor-en-toggle");
      const state = host?.querySelector(".teacher-asset-editor-en-state");
      if (state) state.textContent = on ? t("teacher.asset_editor.outline_state_on") : t("teacher.asset_editor.outline_state_off");
    });
  };
  root.querySelectorAll('.teacher-asset-editor-en-input[data-field="enabled"]').forEach((inp) => {
    inp.addEventListener("change", () => syncOutlineEnabledLabels());
  });
  const runSave = () => {
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
      showSaveToast();
      syncClassroomAssetListingFromAsset(a.id);
    }
  };
  const refresh = () => {
    if (root.isConnected) void renderEditor(root);
  };
  root.querySelector("#teacherAssetCreateListing")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const r = await ensureListingForTeacherAsset(a.id);
    if (!r.ok) {
      try {
        alert(t(`teacher.publishing.error.${r.code}`) || r.code);
      } catch {
        /* */
      }
      return;
    }
    refresh();
  });
  root.querySelector("#teacherAssetSubmitListing")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!pubM.canSubmit) return;
    const r = await submitTeacherAssetListingForReview(a.id, u.id);
    if (!r.ok) {
      try {
        alert(t(`teacher.publishing.error.${r.code}`) || r.code);
      } catch {
        /* */
      }
      return;
    }
    refresh();
  });
  root.querySelector("#teacherAssetGoPublic")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!pubM.canGoPublic) return;
    const r = await setClassroomAssetListingToPublic(a.id, ctx.profile.id);
    if (!r.ok) {
      try {
        alert(t(`teacher.publishing.error.${r.code}`) || r.code);
      } catch {
        /* */
      }
      return;
    }
    refresh();
  });
  root.querySelectorAll("[id^=teacherAssetEditorSave]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      runSave();
    });
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
