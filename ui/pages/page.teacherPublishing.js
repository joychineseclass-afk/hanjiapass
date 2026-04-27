import { mountTeacherCommercePage, PAGE_MODE_PUBLISHING } from "./teacherCommerceConsoleShared.js";

/**
 * 教师端「我的发布 / 售卖」: #teacher-publishing
 */
export default function pageTeacherPublishing(ctxOrRoot) {
  return mountTeacherCommercePage(ctxOrRoot, PAGE_MODE_PUBLISHING);
}

export function mount(ctxOrRoot) {
  return pageTeacherPublishing(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherPublishing(ctxOrRoot);
}
