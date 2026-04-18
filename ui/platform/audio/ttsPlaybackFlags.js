/**
 * 播放任务登记（无其它模块依赖，供 bulk 条与 ttsPlaybackManager 共用，避免循环 import）。
 */

let _taskSeq = 0;
/** @type {string | null} */
let _currentTaskId = null;
/** @type {string | null} */
let _currentScope = null;
/** @type {'idle'|'bulk'|'single'|'chain'} */
let _activeKind = "idle";

export function registerBulkPlayback(scope) {
  _currentTaskId = `bulk-${++_taskSeq}`;
  _currentScope = scope || "other";
  _activeKind = "bulk";
}

export function registerSinglePlayback(scope) {
  _currentTaskId = `single-${++_taskSeq}`;
  _currentScope = scope || "other";
  _activeKind = "single";
}

export function registerChainPlayback(scope) {
  _currentTaskId = `chain-${++_taskSeq}`;
  _currentScope = scope || "other";
  _activeKind = "chain";
}

export function clearPlaybackRegistration() {
  _currentTaskId = null;
  _currentScope = null;
  _activeKind = "idle";
}

export function getTtsPlaybackFlags() {
  return {
    currentTaskId: _currentTaskId,
    currentScope: _currentScope,
    activeKind: _activeKind,
  };
}
