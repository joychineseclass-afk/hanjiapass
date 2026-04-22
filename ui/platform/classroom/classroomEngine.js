// /ui/platform/classroom/classroomEngine.js
// 课堂引擎 v1：串联课程加载、状态管理与渲染
// 展示模式 / 全屏 / 键盘：见 classroomPresentation.js（由 page.classroom 装配）

import { loadLessonDetail as loadLessonDetailFromEngine } from "../content/courseLoader.js";
import { getDefaultSteps } from "./classroomStepRegistry.js";
import { getCoursewareClassroomStepSequenceFromAsset } from "../../lumina-commerce/teacherAssetsSelectors.js";
import {
  resetClassroomState,
  setClassroomCourse,
  setClassroomCoursewareAsset,
  setClassroomLesson,
  setClassroomStep,
  setAvailableSteps,
  getClassroomState
} from "./classroomState.js";
import { renderClassroomStage } from "./classroomRenderer.js";
import { renderClassroomToolbar } from "./classroomToolbar.js";

/**
 * 初始化课堂引擎
 * @param {{ courseId:string, lessonId:string, level?:string, coursewareAsset?:import('../../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset|null }} opts
 * @param {{ toolbarEl:HTMLElement, stageEl:HTMLElement }} dom
 */
export async function initClassroomEngine(opts, dom) {
  const { courseId, lessonId, level, coursewareAsset } = opts || {};
  const toolbarEl = dom?.toolbarEl || null;
  const stageEl = dom?.stageEl || null;

  resetClassroomState();
  setClassroomCourse(courseId);
  setClassroomCoursewareAsset(coursewareAsset || null);
  const cwSeq = coursewareAsset ? getCoursewareClassroomStepSequenceFromAsset(coursewareAsset) : null;
  setAvailableSteps(cwSeq && cwSeq.length ? cwSeq : getDefaultSteps());

  let lessonData = null;

  try {
    // v1: 通过通用 CourseLoader 读取 lesson 数据
    const res = await loadLessonDetailFromEngine({
      courseType: courseId || "kids",
      level: level || "1",
      lessonNo: Number(lessonId) || 1
    });
    lessonData = res?.lesson || res || null;
  } catch (e) {
    console.warn("[classroomEngine] loadLessonDetail failed:", e?.message || e);
  }

  setClassroomLesson(lessonId, lessonData || {});
  const st0 = getClassroomState();
  setClassroomStep(st0.availableSteps[0] || "scene");

  if (toolbarEl && stageEl) {
    renderClassroomToolbar(toolbarEl, stageEl);
    renderClassroomStage(stageEl);
  }

  return getClassroomState();
}

export function goToClassroomStep(stepId, toolbarEl, stageEl) {
  setClassroomStep(stepId);
  if (toolbarEl && stageEl) {
    renderClassroomToolbar(toolbarEl, stageEl);
    renderClassroomStage(stageEl);
  }
}

