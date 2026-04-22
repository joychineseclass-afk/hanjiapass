// /ui/platform/classroom/classroomPresentation.js
// 课堂展示：view_mode、全屏、键盘；逻辑集中，供 page.classroom 与 classroomToolbar 复用
//
// view_mode 预留：standard | presentation | slide_reserved（Step 4+ 真幻灯片，本阶段不启用 slide_reserved）
// 不直接 import 渲染器，避免与 classroomToolbar 循环依赖

import { nextClassroomStep, prevClassroomStep } from "./classroomState.js";

/** @typedef {'standard' | 'presentation' | 'slide_reserved'} ClassroomViewMode */

export const ViewMode = Object.freeze({
  STANDARD: "standard",
  PRESENTATION: "presentation",
  /** 占位，供未来幻灯片 / PPT 模式接入 */
  SLIDE_RESERVED: "slide_reserved",
});

const LS_VIEW = "lumina.classroom.viewMode.v1";

/** @type {ClassroomViewMode} */
let _viewMode = ViewMode.STANDARD;
/** @type {HTMLElement | null} */
let _pageEl = null;
/** @type {null | (() => { toolbarEl: HTMLElement | null, stageEl: HTMLElement | null })} */
let _getEls = null;
/** @type {null | (() => void)} */
let _onShellRefresh = null;
/** @type {((e: KeyboardEvent) => void) | null} */
let _keyHandler = null;
/** @type {(() => void) | null} */
let _fsHandler = null;

/**
 * @param {EventTarget | null} t
 * @returns {boolean}
 */
function isEditableOrHotkeyUI(t) {
  const el = t && t.nodeType === 1 ? /** @type {Element} */ (t) : null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    const type = String(/** @type {HTMLInputElement} */ (el).type || "text").toLowerCase();
    if (["button", "submit", "reset", "checkbox", "radio", "file", "image"].includes(type)) return false;
    return true;
  }
  if (/** @type {HTMLElement} */ (el).isContentEditable) return true;
  const c = el.getAttribute && el.getAttribute("contenteditable");
  if (c === "true" || c === "") return true;
  return false;
}

/**
 * @param {EventTarget | null} t
 * @param {HTMLElement | null} root
 */
function isFocusInClassroomApp(t, root) {
  const app = document.getElementById("app");
  const el = t && t.nodeType === 1 ? /** @type {Element} */ (t) : null;
  if (!el) return true;
  if (app && app.contains(el)) return true;
  if (root && root.contains(el)) return true;
  return el === document.body;
}

/**
 * 同步 #hash 中 present=1（不压爆 history）
 * @param {boolean} presentationOn
 */
function syncPresentQuery(presentationOn) {
  try {
    const hash = String(location.hash || "");
    const qIdx = hash.indexOf("?");
    const path = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
    const sp = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : "");
    if (presentationOn) sp.set("present", "1");
    else sp.delete("present");
    const q = sp.toString();
    const newHash = q ? `${path}?${q}` : path;
    const url = location.pathname + location.search + newHash;
    if (url !== location.pathname + location.search + location.hash) {
      history.replaceState(null, "", url);
    }
  } catch {
    // ignore
  }
}

/**
 * @param {Record<string, string>} q
 * @returns {ClassroomViewMode}
 */
export function parseViewModeFromQuery(q) {
  const p = String(q.present || "").toLowerCase();
  const v = String(q.view || q.viewMode || "").toLowerCase();
  if (p === "1" || p === "true" || v === "presentation" || v === "present") {
    return ViewMode.PRESENTATION;
  }
  if (v === "standard") return ViewMode.STANDARD;
  try {
    const s = localStorage.getItem(LS_VIEW);
    if (s === ViewMode.PRESENTATION) return ViewMode.PRESENTATION;
  } catch {
    // ignore
  }
  return ViewMode.STANDARD;
}

/**
 * @param {ClassroomViewMode} mode
 */
function applyViewModeToDom(mode) {
  if (!_pageEl) return;
  const pres = mode === ViewMode.PRESENTATION;
  _pageEl.classList.toggle("lumina-classroom--presentation", pres);
  _pageEl.setAttribute("data-presentation", pres ? "1" : "0");
  _pageEl.setAttribute("data-view-mode", mode);
  try {
    if (mode === ViewMode.PRESENTATION) localStorage.setItem(LS_VIEW, ViewMode.PRESENTATION);
    else localStorage.setItem(LS_VIEW, ViewMode.STANDARD);
  } catch {
    // ignore
  }
  syncPresentQuery(pres);
}

/**
 * @returns {ClassroomViewMode}
 */
export function getClassroomViewMode() {
  return _viewMode;
}

/**
 * @param {ClassroomViewMode} mode
 * @param {{ skipRefresh?: boolean }} [opts]
 */
export function setClassroomViewMode(mode, opts) {
  if (mode === ViewMode.SLIDE_RESERVED) return; // 本阶段不进入
  if (mode !== ViewMode.STANDARD && mode !== ViewMode.PRESENTATION) return;
  _viewMode = mode;
  applyViewModeToDom(_viewMode);
  if (!opts?.skipRefresh) {
    _onShellRefresh?.();
  }
}

export function toggleClassroomViewMode() {
  const next = _viewMode === ViewMode.PRESENTATION ? ViewMode.STANDARD : ViewMode.PRESENTATION;
  setClassroomViewMode(next);
  return getClassroomViewMode();
}

/**
 * 浏览器全屏（兼容常见前缀），失败时静默
 * @param {HTMLElement | null} el
 */
export function requestClassroomFullscreen(el) {
  const node = el || _pageEl;
  if (!node) return;
  const r =
    node.requestFullscreen ||
    /** @type {typeof node.requestFullscreen | undefined} */ (node).webkitRequestFullscreen ||
    /** @type {typeof node.requestFullscreen | undefined} */ (node).mozRequestFullScreen ||
    /** @type {typeof node.requestFullscreen | undefined} */ (node).msRequestFullscreen;
  if (!r) return;
  try {
    const p = r.call(node);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    // ignore
  }
}

export function exitClassroomFullscreen() {
  const e =
    document.exitFullscreen ||
    /** @type {typeof document.exitFullscreen} */ (document).webkitExitFullscreen ||
    /** @type {typeof document.exitFullscreen} */ (document).mozCancelFullScreen ||
    /** @type {typeof document.exitFullscreen} */ (document).msExitFullscreen;
  if (!e) return;
  try {
    const p = e.call(document);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * @returns {boolean}
 */
export function isClassroomDocumentFullscreen() {
  const el =
    document.fullscreenElement ||
    /** @type {typeof document.fullscreenElement} */ (document).webkitFullscreenElement ||
    /** @type {typeof document.fullscreenElement} */ (document).mozFullScreenElement ||
    /** @type {typeof document.fullscreenElement} */ (document).msFullscreenElement;
  return Boolean(el);
}

/**
 * @returns {boolean}
 */
export function isClassroomPageTargetFullscreen() {
  if (!isClassroomDocumentFullscreen() || !_pageEl) return false;
  const el =
    document.fullscreenElement ||
    /** @type {typeof document.fullscreenElement} */ (document).webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;
  return Boolean(el && _pageEl.contains(el));
}

export function toggleClassroomFullscreen() {
  if (isClassroomDocumentFullscreen()) {
    exitClassroomFullscreen();
  } else {
    requestClassroomFullscreen(_pageEl);
  }
}

/**
 * 翻页/键盘后刷新顶栏、工具栏、舞台
 */
function refreshClassroomView() {
  _onShellRefresh?.();
}

/**
 * @param {object} p
 * @param {HTMLElement} p.pageEl 作为全屏目标（整块课堂页）
 * @param {() => { toolbarEl: HTMLElement | null, stageEl: HTMLElement | null }} p.getEls 预留（可忽略）
 * @param {Record<string, string>} p.query 与 page 解析的 hash query 一致
 * @param {() => void} [p.onShellRefresh] 重绘课堂壳层（顶栏/工具栏/舞台/游戏区等）
 * @returns {() => void} dispose
 */
export function initClassroomPresentation({ pageEl, getEls, query, onShellRefresh }) {
  _pageEl = pageEl;
  _getEls = getEls;
  _onShellRefresh = onShellRefresh || null;

  _viewMode = parseViewModeFromQuery(query || {});
  applyViewModeToDom(_viewMode);

  _keyHandler = (e) => {
    if (!e || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableOrHotkeyUI(e.target)) return;
    if (!isFocusInClassroomApp(e.target, _pageEl)) return;

    const k = e.key;
    if (k === "Escape") {
      if (isClassroomDocumentFullscreen()) {
        e.preventDefault();
        exitClassroomFullscreen();
        _onShellRefresh?.();
        return;
      }
      if (_viewMode === ViewMode.PRESENTATION) {
        e.preventDefault();
        setClassroomViewMode(ViewMode.STANDARD);
        return;
      }
      return;
    }
    if (k === "f" || k === "F") {
      e.preventDefault();
      toggleClassroomFullscreen();
      _onShellRefresh?.();
      return;
    }
    if (k === "ArrowRight" || k === "PageDown") {
      e.preventDefault();
      nextClassroomStep();
      refreshClassroomView();
      return;
    }
    if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      prevClassroomStep();
      refreshClassroomView();
      return;
    }
  };

  _fsHandler = () => {
    if (_pageEl) {
      _pageEl.setAttribute("data-classroom-fullscreen", isClassroomDocumentFullscreen() ? "1" : "0");
    }
    _onShellRefresh?.();
  };

  window.addEventListener("keydown", _keyHandler, false);
  document.addEventListener("fullscreenchange", _fsHandler, false);
  document.addEventListener("webkitfullscreenchange", _fsHandler, false);
  document.addEventListener("mozfullscreenchange", _fsHandler, false);
  document.addEventListener("MSFullscreenChange", _fsHandler, false);
  if (_pageEl) _pageEl.setAttribute("data-classroom-fullscreen", isClassroomDocumentFullscreen() ? "1" : "0");
  _onShellRefresh?.();

  return () => {
    window.removeEventListener("keydown", _keyHandler, false);
    document.removeEventListener("fullscreenchange", _fsHandler, false);
    document.removeEventListener("webkitfullscreenchange", _fsHandler, false);
    document.removeEventListener("mozfullscreenchange", _fsHandler, false);
    document.removeEventListener("MSFullscreenChange", _fsHandler, false);
    _keyHandler = null;
    _fsHandler = null;
    _getEls = null;
    _onShellRefresh = null;
    _pageEl = null;
  };
}
