/**
 * Practice Generator v2 - 平台级自动出题引擎
 * 导出供 Practice Engine 接入
 */

export { generate } from "./practiceGeneratorV2.js";
export { getTargetPracticeCount, getQuotaByLevelNum, PRACTICE_COUNT_BY_LEVEL } from "./generatorConfig.js";
export { normalizeQuestion, normalizeQuestions } from "./questionNormalizer.js";

// 未来 v3 预留（先不实现，只留导出占位）
// export { generateListeningChoice } from "./listeningQuestionGenerator.js";  // listening_choice
// export { generateDragReorder } from "./reorderQuestionGenerator.js";      // drag_reorder
// export { generateInputTyping } from "./typingQuestionGenerator.js";        // input_typing
// export { generateAIAdaptive } from "./aiAdaptiveGenerator.js";            // ai_adaptive_practice
// export { generateReviewMode } from "./reviewModeGenerator.js";           // review_mode_generation
