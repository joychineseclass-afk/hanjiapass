/**
 * HSK 学习区朗读链共享状态（generation / 间隙定时器 / 单条循环键）
 * 供 hskRenderer、hskBulkSpeakPlayer、ttsPlaybackManager 同步引用，避免循环依赖。
 */

/** 打断 HSK3.0 紧凑词条「中文→停顿→释义」链上的间隙定时器 */
let _learnVocabSpeakGapTimer = null;
/** 任一点读开始自增，用于丢弃过期的 onEnd / setTimeout */
let _wordSpeakGeneration = 0;

/** 批量朗读（单词间 / 会话句间）暂停，需与 bump 一并取消 */
let _batchPauseTimer = null;

export function cancelLearnVocabSpeakGapTimer() {
  if (_learnVocabSpeakGapTimer != null) {
    clearTimeout(_learnVocabSpeakGapTimer);
    _learnVocabSpeakGapTimer = null;
  }
}

export function cancelBatchPauseTimer() {
  if (_batchPauseTimer != null) {
    clearTimeout(_batchPauseTimer);
    _batchPauseTimer = null;
  }
}

function randomGapMs(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function bumpWordSpeakGeneration() {
  _wordSpeakGeneration += 1;
  cancelLearnVocabSpeakGapTimer();
  cancelBatchPauseTimer();
}

/** HSK3.0 HSK1：单条循环（单词/会话行）互斥状态，与整体朗读无关 bump */
export const hsk30ItemLoop = {
  compactWordKey: "",
  dialogueLineKey: "",
};

/** 仅清除单条循环标记（整体朗读 open 时与 bump 配合，使旧循环尽快退出） */
export function clearHsk30SingleItemLoopState() {
  hsk30ItemLoop.compactWordKey = "";
  hsk30ItemLoop.dialogueLineKey = "";
}

/** 新一条朗读链（与批量会话全文等共用 generation） */
export function startNewHskSpeakChain() {
  bumpWordSpeakGeneration();
  return _wordSpeakGeneration;
}

export function getHskSpeakGeneration() {
  return _wordSpeakGeneration;
}

/** 批量朗读：段与段之间的停顿（新点读会 bump 并清掉定时器） */
export function batchPauseBetweenSegments(gen) {
  return new Promise((resolve) => {
    cancelBatchPauseTimer();
    _batchPauseTimer = setTimeout(() => {
      _batchPauseTimer = null;
      resolve();
    }, randomGapMs(350, 550));
  });
}
