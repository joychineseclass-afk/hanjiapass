import { mountTeacherCommercePage, PAGE_MODE_REVIEW } from "./teacherCommerceConsoleShared.js";

/**
 * 审核员控制台: #teacher-review
 */
export default function pageTeacherReview(ctxOrRoot) {
  return mountTeacherCommercePage(ctxOrRoot, PAGE_MODE_REVIEW);
}

export function mount(ctxOrRoot) {
  return pageTeacherReview(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherReview(ctxOrRoot);
}
