// 我的教材：管理页骨架（列表壳 + 空状态 + 禁用 CTA）；文案经 safeUiText。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { i18n } from "../i18n.js";

function tx(path, params) {
  return safeUiText(path, params);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let __matLangHandler = /** @type {null | (() => void)} */ (null);
let __matRootRef = /** @type {HTMLElement | null} */ (null);

function renderMaterialsDom(root) {
  root.innerHTML = `
    <div class="teacher-page wrap teacher-manage-page">
      <p class="teacher-manage-back">
        <a href="#teacher" class="teacher-back-link">${escapeHtml(tx("teacher.materials_page.back"))}</a>
      </p>

      <header class="card teacher-manage-header">
        <h2 class="title">${escapeHtml(tx("teacher.materials_page.title"))}</h2>
        <p class="desc">${escapeHtml(tx("teacher.materials_page.subtitle"))}</p>
        <p class="teacher-manage-tagline">${escapeHtml(tx("teacher.materials_page.tagline"))}</p>
      </header>

      <section class="card teacher-manage-toolbar" aria-label="${escapeHtml(tx("teacher.materials_page.upload_cta"))}">
        <div class="teacher-manage-toolbar-row">
          <button type="button" class="teacher-manage-cta teacher-manage-cta--disabled" disabled>
            ${escapeHtml(tx("teacher.materials_page.upload_cta"))}
          </button>
          <p class="teacher-manage-toolbar-hint">${escapeHtml(tx("teacher.materials_page.upload_note"))}</p>
        </div>
      </section>

      <section class="card teacher-manage-list" aria-labelledby="teacher-materials-list-title">
        <h3 id="teacher-materials-list-title" class="teacher-manage-list-title">${escapeHtml(tx("teacher.materials_page.list_title"))}</h3>
        <div class="teacher-manage-table-scroll">
          <table class="teacher-manage-table">
            <thead>
              <tr>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_name"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_type"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_status"))}</th>
                <th scope="col">${escapeHtml(tx("teacher.materials_page.th_updated"))}</th>
                <th scope="col" class="teacher-manage-col-actions">${escapeHtml(tx("teacher.materials_page.th_actions"))}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="teacher-manage-empty-row">
                <td colspan="5">
                  <div class="teacher-manage-empty" role="status">
                    <p class="teacher-manage-empty-title">${escapeHtml(tx("teacher.materials_page.empty_cell_title"))}</p>
                    <p class="teacher-manage-empty-intro">${escapeHtml(tx("teacher.materials_page.empty_cell_intro"))}</p>
                    <ul class="teacher-manage-empty-list">
                      <li>${escapeHtml(tx("teacher.materials_page.empty_cell_item_1"))}</li>
                      <li>${escapeHtml(tx("teacher.materials_page.empty_cell_item_2"))}</li>
                      <li>${escapeHtml(tx("teacher.materials_page.empty_cell_item_3"))}</li>
                    </ul>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card teacher-manage-relation">
        <h3 class="teacher-manage-relation-title">${escapeHtml(tx("teacher.materials_page.relation_title"))}</h3>
        <ul class="teacher-manage-relation-list">
          <li>${escapeHtml(tx("teacher.materials_page.relation_item_1"))}</li>
          <li>${escapeHtml(tx("teacher.materials_page.relation_item_2"))}</li>
          <li>${escapeHtml(tx("teacher.materials_page.relation_item_3"))}</li>
        </ul>
      </section>
    </div>
  `;
  i18n.apply?.(root);
}

export default function pageTeacherMaterials(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  __matRootRef = root;
  if (__matLangHandler) window.removeEventListener("joy:langChanged", __matLangHandler);
  __matLangHandler = () => {
    if (__matRootRef?.isConnected) renderMaterialsDom(__matRootRef);
  };
  window.addEventListener("joy:langChanged", __matLangHandler);

  renderMaterialsDom(root);
}

export function mount(ctxOrRoot) {
  return pageTeacherMaterials(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherMaterials(ctxOrRoot);
}
