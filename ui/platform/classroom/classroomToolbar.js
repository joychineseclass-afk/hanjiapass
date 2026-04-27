// /ui/platform/classroom/classroomToolbar.js
// 教师课堂工具栏（上一步 / 下一步 / 步骤切换、展示模式、全屏）

import { i18n } from "../../i18n.js";
import { CLASSROOM_STEPS } from "./classroomStepRegistry.js";
import { getClassroomState, setClassroomStep, nextClassroomStep, prevClassroomStep } from "./classroomState.js";
import { renderClassroomStage } from "./classroomRenderer.js";
import {
  getClassroomViewMode,
  toggleClassroomViewMode,
  isClassroomDocumentFullscreen,
  toggleClassroomFullscreen,
  ViewMode,
} from "./classroomPresentation.js";

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

/**
 * @param {HTMLElement | null} rootEl
 * @param {HTMLElement | null} stageEl
 */
export function renderClassroomToolbar(rootEl, stageEl) {
  if (!rootEl) return;
  const state = getClassroomState();
  const isCourseware = Boolean(state.coursewareAsset);
  rootEl.classList.toggle("classroom-toolbar-wrap--courseware", isCourseware);
  const prevLabel = t("classroom_prev", "上一步");
  const nextLabel = t("classroom_next", "下一步");

  const stepIdx0 = Math.max(0, state.availableSteps.indexOf(state.currentStep));
  const total = state.availableSteps.length || 1;
  const curNum = stepIdx0 + 1;
  const currentDef = CLASSROOM_STEPS.find((s) => s.id === state.currentStep);
  const currentStepLabel = t(currentDef?.labelKey || "classroom_scene", state.currentStep);
  const stepIndexLine = t("teacher.classroom.presentation.step_index", {
    current: String(curNum),
    total: String(total),
  });
  const currentStepHeading = t("teacher.classroom.presentation.current_step_label");
  const controlKicker = t("teacher.classroom.toolbar_control_kicker", "翻页");
  const indexOnlyHint = t("teacher.classroom.toolbar_index_hint", "使用上一页/下一页或上方课件目录跳段。");
  const keyboardHint = t("teacher.classroom.presentation.keyboard_shortcuts");
  const viewStandard = t("teacher.classroom.presentation.mode_standard");
  const viewPresent = t("teacher.classroom.presentation.mode_presentation");
  const viewModeLine = t("teacher.classroom.presentation.view_mode");
  const fsEnter = t("teacher.classroom.presentation.fullscreen");
  const fsExit = t("teacher.classroom.presentation.exit_fullscreen");

  const isPres = getClassroomViewMode() === ViewMode.PRESENTATION;
  const fsOn = isClassroomDocumentFullscreen();
  const viewToggleLabel = isPres ? viewStandard : viewPresent;
  const fsLabel = fsOn ? fsExit : fsEnter;

  const quickTabsAria = isCourseware
    ? t("teacher.classroom.toolbar_quick_steps_aria", "快速步进")
    : viewModeLine;
  const stepBtns = state.availableSteps
    .map((id) => {
      const s = CLASSROOM_STEPS.find((x) => x.id === id);
      const label = t(s?.labelKey || "classroom_scene", id);
      const active = state.currentStep === id;
      return `<button type="button" class="classroom-step-btn${active ? " is-active" : ""}" data-step="${id}">${label}</button>`;
    })
    .join("");

  rootEl.classList.toggle("classroom-toolbar--presentation", isPres);

  const centerBlock = isCourseware
    ? `<div class="classroom-step-now classroom-step-now--courseware" role="status" aria-label="${indexOnlyHint}">
        <span class="classroom-step-now-kicker">${controlKicker}</span>
        <span class="classroom-step-now-idx classroom-step-now-idx--solo" aria-label="${stepIndexLine}">${stepIndexLine}</span>
      </div>`
    : `<div class="classroom-step-now" role="status">
        <span class="classroom-step-now-kicker">${currentStepHeading}</span>
        <span class="classroom-step-now-name">${currentStepLabel}</span>
        <span class="classroom-step-now-idx" aria-label="${stepIndexLine}">${stepIndexLine}</span>
      </div>`;

  rootEl.innerHTML = `
    <div class="classroom-toolbar${isPres ? " classroom-toolbar--presentation-inner" : ""}${isCourseware ? " classroom-toolbar--courseware" : ""}">
      <div class="classroom-toolbar-row classroom-toolbar-row--nav">
        <button type="button" class="classroom-nav-btn classroom-nav-btn--large" data-role="prev" aria-label="${prevLabel}">${prevLabel}</button>
        ${centerBlock}
        <button type="button" class="classroom-nav-btn classroom-nav-btn--large" data-role="next" aria-label="${nextLabel}">${nextLabel}</button>
      </div>
      <div class="classroom-toolbar-row classroom-toolbar-row--tabs${isCourseware ? " classroom-toolbar-row--tabs--cw" : ""}">
        <div class="classroom-step-tabs" role="tablist" aria-label="${quickTabsAria}">
          ${stepBtns}
        </div>
      </div>
      <div class="classroom-toolbar-row classroom-toolbar-row--view">
        <div class="classroom-view-actions">
          <span class="classroom-view-actions-label classroom-toolbar-muted">${viewModeLine}</span>
          <button type="button" class="classroom-ctrl-btn" data-role="view-mode" aria-pressed="${isPres}">${viewToggleLabel}</button>
          <button type="button" class="classroom-ctrl-btn classroom-ctrl-btn--primary" data-role="fullscreen" aria-pressed="${fsOn}">${fsLabel}</button>
        </div>
        <p class="classroom-keyboard-hint" ${isPres ? 'hidden data-pres-hidden="1"' : ""}>${keyboardHint}</p>
      </div>
    </div>
  `;

  rootEl.querySelector('[data-role="prev"]')?.addEventListener("click", () => {
    prevClassroomStep();
    renderClassroomToolbar(rootEl, stageEl);
    if (stageEl) renderClassroomStage(stageEl);
  });

  rootEl.querySelector('[data-role="next"]')?.addEventListener("click", () => {
    nextClassroomStep();
    renderClassroomToolbar(rootEl, stageEl);
    if (stageEl) renderClassroomStage(stageEl);
  });

  rootEl.querySelectorAll(".classroom-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = btn.getAttribute("data-step");
      setClassroomStep(step);
      renderClassroomToolbar(rootEl, stageEl);
      if (stageEl) renderClassroomStage(stageEl);
    });
  });

  rootEl.querySelector('[data-role="view-mode"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleClassroomViewMode();
  });

  rootEl.querySelector('[data-role="fullscreen"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleClassroomFullscreen();
  });
}
