// /ui/platform/classroom/classroomToolbar.js
// 教师课堂工具栏（上一步 / 下一步 / 步骤切换）

import { i18n } from "../../i18n.js";
import { CLASSROOM_STEPS } from "./classroomStepRegistry.js";
import { getClassroomState, setClassroomStep, nextClassroomStep, prevClassroomStep } from "./classroomState.js";
import { renderClassroomStage } from "./classroomRenderer.js";

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

export function renderClassroomToolbar(rootEl, stageEl) {
  if (!rootEl) return;
  const state = getClassroomState();
  const prevLabel = t("classroom_prev", "上一步");
  const nextLabel = t("classroom_next", "下一步");

  const stepBtns = CLASSROOM_STEPS.map((s) => {
    const label = t(s.labelKey, s.id);
    const active = state.currentStep === s.id;
    return `<button type="button" class="classroom-step-btn${active ? " is-active" : ""}" data-step="${s.id}">${label}</button>`;
  }).join("");

  rootEl.innerHTML = `
    <div class="classroom-toolbar">
      <button type="button" class="classroom-nav-btn" data-role="prev">${prevLabel}</button>
      <div class="classroom-step-tabs">
        ${stepBtns}
      </div>
      <button type="button" class="classroom-nav-btn" data-role="next">${nextLabel}</button>
    </div>
  `;

  rootEl.querySelector('[data-role="prev"]')?.addEventListener("click", () => {
    prevClassroomStep();
    renderClassroomToolbar(rootEl, stageEl);
    renderClassroomStage(stageEl);
  });

  rootEl.querySelector('[data-role="next"]')?.addEventListener("click", () => {
    nextClassroomStep();
    renderClassroomToolbar(rootEl, stageEl);
    renderClassroomStage(stageEl);
  });

  rootEl.querySelectorAll(".classroom-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = btn.getAttribute("data-step");
      setClassroomStep(step);
      renderClassroomToolbar(rootEl, stageEl);
      renderClassroomStage(stageEl);
    });
  });
}

