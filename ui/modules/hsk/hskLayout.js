// /ui/modules/hsk/hskLayout.js ✅ FINAL (Study Tabs version)
// - Directory: #hskLessonListWrap
// - Study: #hskStudyBar + #hskStudyTabs + 4 panels

export function getHSKLayoutHTML() {
  return `
  <section class="hsk-page">
    <div class="hsk-head">
      <div class="hsk-title-row">
        <h2 class="text-xl font-bold">
          <span data-i18n="hsk.title">HSK学習</span>
          <span id="hskSubTitle" class="ml-2 text-sm opacity-70"></span>
        </h2>
      </div>

      <div class="hsk-controls flex flex-wrap gap-2 items-center mt-3">
        <label class="text-sm">
          <span data-i18n="hsk.level">レベル</span>
          <select id="hskLevel" class="ml-1 border rounded-lg px-2 py-1">
            ${renderLevelOptions(9)}
          </select>
        </label>

        <label class="text-sm">
          <span>HSK</span>
          <select id="hskVersion" class="ml-1 border rounded-lg px-2 py-1">
            <option value="hsk2.0">HSK 2.0</option>
            <option value="hsk3.0">HSK 3.0</option>
          </select>
        </label>

        <input
          id="hskSearch"
          class="border rounded-lg px-3 py-1 text-sm"
          data-i18n-placeholder="hsk.search_placeholder"
          placeholder=""
        />
      </div>

      <div class="mt-2 text-sm opacity-70">
        💡 <span data-i18n="hsk.tip">レベルを選んで学習を始めましょう。</span>
      </div>

      <!-- Meta bar: 已完成 / 当前课 / 待复习 / 最近学习 -->
      <div id="hskProgressBlock" class="hsk-meta-bar"></div>

      <!-- Review Mode 入口：JP strict 时使用 hsk.review_* 键 -->
      <div id="hskReviewEntry" class="hsk-review-entry mt-2 flex flex-wrap gap-2">
        <span class="text-sm font-medium opacity-80" data-i18n="hsk.review_mode">復習モード</span>
        <button id="hskReviewLesson" type="button" class="px-3 py-1 rounded-lg border text-sm" data-i18n="hsk.review_this_lesson">本課</button>
        <button id="hskReviewLevel" type="button" class="px-3 py-1 rounded-lg border text-sm" data-i18n="hsk.review_this_level">本級</button>
        <button id="hskReviewAll" type="button" class="px-3 py-1 rounded-lg border text-sm" data-i18n="hsk.review_all_wrong">全誤答</button>
      </div>

      <!-- Review 内容容器 -->
      <div id="hskReviewContainer" class="hsk-review-container hidden mt-4"></div>
    </div>

    <div id="hskError" class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mt-3"></div>

    <!-- ✅ Directory: 教材目录列表 -->
    <div id="hskLessonListWrap" class="mt-4">
      <section class="hsk-lesson-directory">
        <div class="hsk-directory-head" data-i18n="hsk.directory_title">コース一覧</div>
        <div id="hskLessonList"></div>
      </section>
    </div>

    <!-- ✅ Study header：只显示 Lesson N / title，HSK N · version 在页面标题 hskSubTitle -->
    <div id="hskStudyBar" class="hidden bg-white rounded-2xl shadow p-3 mt-4 mb-3">
      <div id="hskLessonCoverWrap" class="hidden mb-3 rounded-xl overflow-hidden">
        <img id="hskLessonCover" class="hsk-lesson-cover-image" src="" alt="" />
      </div>
      <div class="flex items-center gap-2">
        <button id="hskBackToList" type="button" class="px-3 py-1 rounded-lg border">
          ← <span data-i18n="lesson.back_to_list">一覧に戻る</span>
        </button>
        <span id="hskStudyTitle" class="font-semibold"></span>
      </div>

      <!-- ✅ Scene：Lesson 标题之后、tabs 之前 -->
      <div id="hskSceneSection" class="hidden scene-section-wrap mt-3 mb-3"></div>

      <!-- ✅ Study Tabs -->
      <div id="hskStudyTabs" class="mt-3 flex flex-wrap gap-2">
        <button id="hskTabWords" type="button" class="px-3 py-1 rounded-lg border" data-tab="words">
          <span data-i18n="hsk.tab.words">単語</span>
        </button>
        <button id="hskTabDialogue" type="button" class="px-3 py-1 rounded-lg border" data-tab="dialogue">
          <span data-i18n="hsk.tab.dialogue">会話</span>
        </button>
        <button id="hskTabGrammar" type="button" class="px-3 py-1 rounded-lg border" data-tab="grammar">
          <span data-i18n="hsk.tab.grammar">文法</span>
        </button>
        <button id="hskTabExtension" type="button" class="px-3 py-1 rounded-lg border" data-tab="extension">
          <span data-i18n="hsk.tab.extension">拡張</span>
        </button>
        <button id="hskTabPractice" type="button" class="px-3 py-1 rounded-lg border" data-tab="practice">
          <span data-i18n="hsk.tab.practice">練習</span>
        </button>
        <button id="hskTabAI" type="button" class="px-3 py-1 rounded-lg border" data-tab="ai">
          <span data-i18n="hsk.tab.ai">AI学習</span>
        </button>
        <button id="hskTabReview" type="button" class="px-3 py-1 rounded-lg border" data-tab="review">
          <span data-i18n="hsk.tab.review">復習</span>
        </button>
      </div>
    </div>

    <!-- ✅ Study Panels -->
    <div id="hskStudyPanels" class="hidden">
      <div id="hskPanelWords" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1"></div>

      <div id="hskPanelDialogue" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk.tab.dialogue">会話</div>
        <div id="hskDialogueBody" class="space-y-3"></div>
      </div>

      <div id="hskPanelGrammar" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk.tab.grammar">文法</div>
        <div id="hskGrammarBody" class="space-y-3"></div>
      </div>

      <div id="hskPanelExtension" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk.tab.extension">拡張</div>
        <div id="hskExtensionBody" class="space-y-3"></div>
      </div>

      <div id="hskPanelPractice" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk.tab.practice">練習</div>
        <div id="hskPracticeBody" class="space-y-3"></div>
      </div>

      <div id="hskPanelAI" class="hidden p-4">
        <div class="text-sm font-bold mb-3" data-i18n="hsk.tab.ai">AI学習</div>
        <div id="hskAIResult" class="ai-learning-container"></div>
      </div>

      <div id="hskPanelReview" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk.lesson_content_review_title">本课内容总复习</div>
        <div id="hskReviewBody" class="space-y-3"></div>
      </div>
    </div>

    <div class="h-20"></div>
    <div id="portal-root"></div>
    <div id="strokeModalRoot"></div>
  </section>
  `;
}

function renderLevelOptions(maxLv = 9) {
  return Array.from({ length: maxLv }, (_, i) => {
    const lv = i + 1;
    return `<option value="${lv}" data-lv="${lv}">HSK ${lv}</option>`;
  }).join("");
}
