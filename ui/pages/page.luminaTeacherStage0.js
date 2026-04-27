/**
 * 兼容旧链接 #lumina-teacher-stage0 → 重定向到 #teacher-publishing
 */
import { navigateTo } from "../router.js";

export default function pageLuminaTeacherStage0Redirect(/** @type {any} */ _ctx) {
  navigateTo("#teacher-publishing", { force: true });
}
