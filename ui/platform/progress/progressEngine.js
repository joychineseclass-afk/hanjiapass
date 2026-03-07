/**
 * Progress Engine v1 - 核心写入逻辑
 */

import * as Store from "./progressStore.js";
import * as Scheduler from "./reviewScheduler.js";

const VALID_STEPS = ["vocab", "dialogue", "grammar", "practice", "aiPractice"];

function ensureCourse(data, courseId) {
  if (!data.courses[courseId]) {
    data.courses[courseId] = {
      courseId,
      lastLessonNo: 0,
      lessons: {},
      vocab: {},
    };
  }
  return data.courses[courseId];
}

function ensureLesson(course, lessonId, lessonNo) {
  if (!course.lessons[lessonId]) {
    course.lessons[lessonId] = {
      lessonId,
      lessonNo: Number(lessonNo) || 0,
      startedAt: 0,
      completedAt: 0,
      currentStep: "vocab",
      completedSteps: [],
      practice: { total: 0, correct: 0, score: 0, updatedAt: 0 },
    };
  }
  return course.lessons[lessonId];
}

function ensureVocabItem(course, hanzi, lessonId) {
  const key = String(hanzi ?? "").trim();
  if (!key) return null;
  if (!course.vocab[key]) {
    course.vocab[key] = {
      hanzi: key,
      lessonId: lessonId || "",
      status: "new",
      correctCount: 0,
      wrongCount: 0,
      lastSeenAt: 0,
      lastReviewedAt: 0,
      nextReviewAt: 0,
    };
  }
  return course.vocab[key];
}

/**
 * 标记课程开始
 */
export function markLessonStarted({ courseId, lessonId, lessonNo }) {
  if (!courseId || !lessonId) return;
  const data = Store.loadProgress();
  const course = ensureCourse(data, courseId);
  const lesson = ensureLesson(course, lessonId, lessonNo);
  const now = Date.now();
  if (!lesson.startedAt) lesson.startedAt = now;
  course.lastLessonNo = Math.max(course.lastLessonNo, Number(lessonNo) || 0);
  Store.saveProgress(data);
}

/**
 * 标记 step 完成并更新当前 step
 */
export function markStepCompleted({ courseId, lessonId, step }) {
  if (!courseId || !lessonId || !step) return;
  if (!VALID_STEPS.includes(step)) return;
  const data = Store.loadProgress();
  const course = ensureCourse(data, courseId);
  const lesson = ensureLesson(course, lessonId, 0);
  lesson.currentStep = step;
  if (!lesson.completedSteps.includes(step)) {
    lesson.completedSteps = [...lesson.completedSteps, step];
  }
  Store.saveProgress(data);
}

/**
 * 标记课程完成
 */
export function markLessonCompleted({ courseId, lessonId }) {
  if (!courseId || !lessonId) return;
  const data = Store.loadProgress();
  const course = ensureCourse(data, courseId);
  const lesson = ensureLesson(course, lessonId, 0);
  lesson.completedAt = Date.now();
  Store.saveProgress(data);
}

/**
 * 记录练习结果
 * @param {object} opts
 * @param {Array} [opts.wrongItems] - 错题列表 { questionId, subtype, selected, correct }
 */
export function recordPracticeResult({ courseId, lessonId, total, correct, score, vocabItems = [], wrongItems = [] }) {
  if (!courseId || !lessonId) return;
  const data = Store.loadProgress();
  const course = ensureCourse(data, courseId);
  const lesson = ensureLesson(course, lessonId, 0);
  const now = Date.now();
  lesson.practice = {
    total: Number(total) || 0,
    correct: Number(correct) || 0,
    score: Number(score) || 0,
    updatedAt: now,
  };
  vocabItems.forEach((item) => {
    const hanzi = typeof item === "string" ? item : (item?.hanzi ?? item?.word ?? "");
    const v = ensureVocabItem(course, hanzi, lessonId);
    if (v) {
      v.lastSeenAt = now;
      v.status = v.status === "new" ? "learning" : v.status;
      v.nextReviewAt = now;
    }
  });
  if (Array.isArray(wrongItems) && wrongItems.length > 0) {
    const wq = data.wrongQuestions || [];
    const nowSec = Math.floor(now / 1000);
    wrongItems.forEach((item) => {
      const key = `${lessonId}:${item.questionId}`;
      const idx = wq.findIndex((x) => (x.lessonId || "") === lessonId && (x.questionId || "") === item.questionId);
      const record = {
        lessonId,
        questionId: item.questionId,
        subtype: item.subtype ?? "choice",
        selected: String(item.selected ?? ""),
        correct: String(item.correct ?? ""),
        wrongCount: idx >= 0 ? (Number(wq[idx].wrongCount) || 1) + 1 : 1,
        reviewCorrectCount: idx >= 0 ? (Number(wq[idx].reviewCorrectCount) || 0) : 0,
        lastWrongAt: nowSec,
        lastReviewAt: idx >= 0 ? (Number(wq[idx].lastReviewAt) || 0) : 0,
        questionSnapshot: item.questionSnapshot ?? (idx >= 0 ? wq[idx].questionSnapshot : null) ?? null,
      };
      if (idx >= 0) {
        wq[idx] = record;
      } else {
        wq.push(record);
      }
    });
    data.wrongQuestions = wq;
  }
  Store.saveProgress(data);
}

/**
 * 获取全部错题
 * @returns {Array}
 */
export function getWrongQuestions() {
  const data = Store.loadProgress();
  return Array.isArray(data.wrongQuestions) ? [...data.wrongQuestions] : [];
}

/**
 * 按课程获取错题
 * @param {string} lessonId
 * @returns {Array}
 */
export function getWrongQuestionsByLesson(lessonId) {
  if (!lessonId) return [];
  return getWrongQuestions().filter((x) => x.lessonId === lessonId);
}

/**
 * 按 course 获取错题
 * @param {string} courseId
 * @returns {Array}
 */
export function getWrongQuestionsByCourse(courseId) {
  if (!courseId) return [];
  return getWrongQuestions().filter((x) => {
    const lid = x.lessonId || "";
    return lid.startsWith(courseId + "_") || lid === courseId;
  });
}

/**
 * 清除指定课程的错题记录
 * @param {string} lessonId
 */
export function clearWrongQuestions(lessonId) {
  if (!lessonId) return;
  const data = Store.loadProgress();
  if (!Array.isArray(data.wrongQuestions)) return;
  data.wrongQuestions = data.wrongQuestions.filter((x) => x.lessonId !== lessonId);
  Store.saveProgress(data);
}

/**
 * 移除单道错题
 * @param {string} questionId
 * @param {string} lessonId
 */
export function removeWrongQuestion(questionId, lessonId) {
  if (!questionId || !lessonId) return;
  const data = Store.loadProgress();
  if (!Array.isArray(data.wrongQuestions)) return;
  data.wrongQuestions = data.wrongQuestions.filter(
    (x) => !(x.questionId === questionId && x.lessonId === lessonId)
  );
  Store.saveProgress(data);
}

/**
 * 记录复习提交结果
 * @param {{ sessionId: string, results: Array<{questionId, lessonId, correct}> }}
 */
export function recordReviewSubmit({ sessionId, results = [] }) {
  if (!sessionId || !Array.isArray(results)) return;
  const data = Store.loadProgress();
  const wq = [...(data.wrongQuestions || [])];
  const now = Math.floor(Date.now() / 1000);
  const CLEAR_THRESHOLD = 2;
  const toRemove = new Set();

  results.forEach((r) => {
    const idx = wq.findIndex(
      (x) => x.questionId === r.questionId && x.lessonId === r.lessonId
    );
    if (idx < 0) return;

    const item = wq[idx];
    if (r.correct) {
      const newCount = (item.reviewCorrectCount || 0) + 1;
      item.reviewCorrectCount = newCount;
      item.lastReviewAt = now;
      if (newCount >= CLEAR_THRESHOLD) {
        toRemove.add(`${item.lessonId}:${item.questionId}`);
      }
    } else {
      item.wrongCount = (item.wrongCount || 1) + 1;
      item.lastWrongAt = now;
      item.reviewCorrectCount = 0;
    }
  });

  data.wrongQuestions = wq.filter((x) => !toRemove.has(`${x.lessonId}:${x.questionId}`));
  Store.saveProgress(data);
}

/**
 * 复习统计
 */
export function getReviewStats() {
  const list = getWrongQuestions();
  return {
    totalWrong: list.length,
    dueReview: list.length,
    clearedToday: 0,
  };
}

/**
 * 触摸本课词汇（进入 vocab 或 practice 后调用）
 */
export function touchLessonVocab({ courseId, lessonId, vocabItems = [] }) {
  if (!courseId || !lessonId) return;
  const data = Store.loadProgress();
  const course = ensureCourse(data, courseId);
  const now = Date.now();
  vocabItems.forEach((item) => {
    const hanzi = typeof item === "string" ? item : (item?.hanzi ?? item?.word ?? "");
    const v = ensureVocabItem(course, hanzi, lessonId);
    if (v) {
      v.lastSeenAt = now;
      if (v.status === "new") v.nextReviewAt = now;
    }
  });
  Store.saveProgress(data);
}

/**
 * 记录复习结果（答对/答错）
 */
export function recordReviewResult({ courseId, hanzi, isCorrect }) {
  if (!courseId || !hanzi) return;
  const key = String(hanzi).trim();
  if (!key) return;
  const data = Store.loadProgress();
  const course = ensureCourse(data, courseId);
  let v = course.vocab[key];
  if (!v) {
    v = ensureVocabItem(course, key, "");
  }
  const now = Date.now();
  v.lastReviewedAt = now;
  if (isCorrect) {
    v.correctCount = (v.correctCount || 0) + 1;
    v.nextReviewAt = Scheduler.getNextReviewAt({
      status: v.status,
      correctCount: v.correctCount,
      isCorrect: true,
    }, now);
    v.status = Scheduler.getNextStatus({
      status: v.status,
      correctCount: v.correctCount,
      isCorrect: true,
    });
  } else {
    v.wrongCount = (v.wrongCount || 0) + 1;
    v.status = "learning";
    v.nextReviewAt = now;
  }
  Store.saveProgress(data);
}
