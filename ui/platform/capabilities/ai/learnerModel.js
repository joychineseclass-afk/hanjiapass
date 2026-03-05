// ui/platform/capabilities/ai/learnerModel.js
// 学习画像：词汇掌握度、错题、生词本、间隔复习等

const KEY = "joy_learner_model.v1";

function safeParse(s, fb) {
  try {
    return JSON.parse(s);
  } catch {
    return fb;
  }
}

export class LearnerModel {
  constructor(state) {
    this.state =
      state ||
      ({
        version: 1,
        words: {},
        grammar: {},
        mistakes: [],
        lastLesson: null,
      });
  }

  static load() {
    const raw = localStorage.getItem(KEY);
    return new LearnerModel(safeParse(raw, null));
  }

  save() {
    localStorage.setItem(KEY, JSON.stringify(this.state));
  }

  recordWordResult(word, ok) {
    const w = String(word ?? "").trim();
    if (!w) return;
    const cur = this.state.words[w] || {
      score: 0.5,
      lastSeen: 0,
      wrongCount: 0,
    };
    cur.lastSeen = Date.now();
    cur.score = Math.max(0, Math.min(1, cur.score + (ok ? 0.08 : -0.15)));
    if (!ok) cur.wrongCount += 1;
    this.state.words[w] = cur;
  }

  recordLesson(lessonId) {
    this.state.lastLesson = { id: lessonId, ts: Date.now() };
  }

  getState() {
    return { ...this.state };
  }
}
