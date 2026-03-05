// ui/platform/capabilities/ai/aiService.js
// AI 能力统一入口：generateLesson / generatePractice / coachSpeaking / evaluateAnswer / recommendNext
// 所有 AI 调用统一经此层，避免 AI 逻辑分散在各页面

import { PromptBuilder } from "./promptBuilder.js";
import { SchemaValidator } from "./schemaValidator.js";
import { LearnerModel } from "./learnerModel.js";
import { CONTENT } from "../../content/contentLoader.js";

async function callAIProvider({ task, prompt }) {
  // 未来：统一走后端 /api/ai
  // const res = await fetch("/api/ai", { method:"POST", body: JSON.stringify({task,prompt}) });
  // return await res.json();
  throw new Error("AI provider not configured");
}

export const AI_SERVICE = {
  async generateLesson({ courseType, track, level, topic, lang } = {}) {
    const schemaHint = '{"schemaVersion":"lesson.v1","id":"...","course":{...},"content":{...}}';
    const prompt = PromptBuilder.buildLessonPrompt({
      courseType: courseType || "hsk",
      track: track || "hsk2.0",
      level: level || 1,
      topic: topic || "通用",
      lang: lang || "zh",
      schemaHint,
    });

    try {
      const out = await callAIProvider({ task: "generateLesson", prompt });
      const v = SchemaValidator.validateLessonDoc(out);
      if (!v.ok) throw new Error("Schema invalid: " + v.errors.join(", "));
      return { ok: true, data: out, warnings: [] };
    } catch (e) {
      if (courseType === "hsk" || !courseType) {
        const { doc } = await CONTENT.loadLesson({
          type: "hsk",
          track: track || "hsk2.0",
          level: level || 1,
          lessonNo: 1,
        });
        return { ok: true, data: doc, warnings: ["AI failed, fallback to static lesson"] };
      }
      return { ok: false, error: String(e?.message || e) };
    }
  },

  async generatePractice({ lessonDoc, focus, count, lang } = {}) {
    const schemaHint = '{"practice":[{"type":"choice","prompt":"...","options":[],"answer":"..."}]}';
    const prompt = PromptBuilder.buildPracticePrompt({
      lessonDoc,
      focus: focus || "mixed",
      count: count || 8,
      lang: lang || "zh",
      schemaHint,
    });

    try {
      const out = await callAIProvider({ task: "generatePractice", prompt });
      const arr = Array.isArray(out?.practice) ? out.practice : out;
      const v = SchemaValidator.validatePracticeSet(arr);
      if (!v.ok) throw new Error("Practice schema invalid: " + v.errors.join(", "));
      return { ok: true, data: out };
    } catch (e) {
      return {
        ok: true,
        data: { practice: [] },
        warnings: ["AI failed, fallback empty practice"],
      };
    }
  },

  async coachSpeaking({ lessonDoc, userUtterance, lang } = {}) {
    const prompt =
      PromptBuilder.buildSpeakingCoachPrompt({ lessonDoc, lang }) +
      "\n学生输入：" +
      (userUtterance || "");
    try {
      const out = await callAIProvider({ task: "coachSpeaking", prompt });
      return { ok: true, data: out };
    } catch (e) {
      return {
        ok: true,
        data: {
          assistant: "我们先从“你好”开始说一遍吧。",
          expected: "你好",
          tips: [],
        },
        warnings: ["AI failed, fallback coach"],
      };
    }
  },

  async evaluateAnswer({ task, answer, learnerState } = {}) {
    const lm = LearnerModel.load();
    if (task?.word)
      lm.recordWordResult(
        task.word,
        String(answer ?? "").trim() === String(task.expected ?? "").trim()
      );
    lm.save();
    return {
      ok: true,
      data: { correct: true, tags: [], advice: "" },
    };
  },

  async recommendNext({ context } = {}) {
    const lm = LearnerModel.load();
    return {
      ok: true,
      data: {
        next: lm.state.lastLesson ? "review" : "lesson",
        reason: "MVP rule",
      },
    };
  },
};

try {
  window.AI_SERVICE = AI_SERVICE;
} catch {}
