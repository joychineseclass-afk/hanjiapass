// /ui/pages/hsk/hskWordsTab.js
// HSK Words tab rendering (split from page.hsk.js Step 2).
// This module ONLY handles words-panel DOM rendering. Data preparation
// (distribution / vocab targets / prior-lesson filtering) stays in
// page.hsk.js so behaviour remains identical.
//
// ctx:
// {
//   lessonData,
//   lessonWords,
//   lang,
//   scope,             // e.g. "hsk1"
//   isReviewLesson,    // boolean
//   isCompactLearnVocabLayout, // HSK3.0 HSK1 pilot
// }

import {
  renderWordCards,
  renderReviewWords,
} from "../../modules/hsk/hskRenderer.js";

/** Render words tab panel. container = #hskPanelWords. */
export function renderHskWordsTab(container, ctx) {
  if (!container) return;
  const {
    lessonWords,
    lang,
    scope,
    isReviewLesson,
    isCompactLearnVocabLayout,
  } = ctx || {};

  if (isReviewLesson) {
    renderReviewWords(container, lessonWords, {
      lang,
      scope,
    });
    return;
  }

  renderWordCards(container, lessonWords, null, {
    lang,
    scope,
    layout: isCompactLearnVocabLayout ? "compact-learn" : "cards",
  });
}
