// /ui/modules/hsk/hskLayout.js ✅ FINAL (Study Tabs version)
// - Directory: #hskLessonListWrap
// - Study: #hskStudyBar + #hskStudyTabs + 4 panels

export function getHSKLayoutHTML() {
  return `
  <section class="hsk-page">
    <div class="hsk-head">
      <div class="hsk-title-row">
        <h2 class="text-xl font-bold">
          <span data-i18n="hsk_title">HSK 학습</span>
          <span id="hskSubTitle" class="ml-2 text-sm opacity-70"></span>
        </h2>
      </div>

      <div class="hsk-controls flex flex-wrap gap-2 items-center mt-3">
        <label class="text-sm">
          <span data-i18n="hsk_level">레벨</span>
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
          data-i18n-placeholder="hsk_search_placeholder"
          placeholder="단어/병음/뜻 검색"
        />
      </div>

      <div class="mt-2 text-sm opacity-70">
        💡 <span data-i18n="hsk_tip">레벨을 선택하고 수업을 시작해요.</span>
      </div>

      <!-- Meta bar: 已完成 / 当前课 / 待复习 / 最近学习 -->
      <div id="hskProgressBlock" class="hsk-meta-bar"></div>
    </div>

    <div id="hskError" class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mt-3"></div>

    <!-- ✅ Directory: 教材目录列表 -->
    <div id="hskLessonListWrap" class="mt-4">
      <section class="hsk-lesson-directory">
        <div class="hsk-directory-head" data-i18n="hsk_directory_title">학습 목록</div>
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
          ← <span data-i18n="common_back">목록으로</span>
        </button>
        <span id="hskStudyTitle" class="font-semibold"></span>
      </div>

      <!-- ✅ Scene：Lesson 标题之后、tabs 之前 -->
      <div id="hskSceneSection" class="hidden scene-section-wrap mt-3 mb-3"></div>

      <!-- ✅ Study Tabs -->
      <div id="hskStudyTabs" class="mt-3 flex flex-wrap gap-2">
        <button id="hskTabWords" type="button" class="px-3 py-1 rounded-lg border" data-tab="words">
          <span data-i18n="hsk_tab_words">단어</span>
        </button>
        <button id="hskTabDialogue" type="button" class="px-3 py-1 rounded-lg border" data-tab="dialogue">
          <span data-i18n="hsk_tab_dialogue">회화</span>
        </button>
        <button id="hskTabGrammar" type="button" class="px-3 py-1 rounded-lg border" data-tab="grammar">
          <span data-i18n="hsk_tab_grammar">문법</span>
        </button>
        <button id="hskTabExtension" type="button" class="px-3 py-1 rounded-lg border" data-tab="extension">
          <span data-i18n="hsk_tab_extension">확장</span>
        </button>
        <button id="hskTabPractice" type="button" class="px-3 py-1 rounded-lg border" data-tab="practice">
          <span data-i18n="hsk_tab_practice">연습</span>
        </button>
        <button id="hskTabAI" type="button" class="px-3 py-1 rounded-lg border" data-tab="ai">
          <span data-i18n="hsk_tab_ai">AI 학습</span>
        </button>
      </div>
    </div>

    <!-- ✅ Study Panels -->
    <div id="hskStudyPanels" class="hidden">
      <div id="hskPanelWords" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1"></div>

      <div id="hskPanelDialogue" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk_tab_dialogue">회화</div>
        <div id="hskDialogueBody" class="space-y-3"></div>
      </div>

      <div id="hskPanelGrammar" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk_tab_grammar">문법</div>
        <div id="hskGrammarBody" class="space-y-3"></div>
      </div>

      <div id="hskPanelExtension" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk_tab_extension">확장</div>
        <div id="hskExtensionBody" class="space-y-3"></div>
      </div>

      <div id="hskPanelPractice" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk_tab_practice">연습</div>
        <div id="hskPracticeBody" class="space-y-3"></div>
      </div>

      <div id="hskPanelAI" class="hidden bg-white rounded-2xl shadow p-4">
        <div class="text-sm font-bold mb-2" data-i18n="hsk_tab_ai">AI 학습</div>
        <div class="text-sm opacity-70 mb-3" data-i18n="hsk_ai_tip">
          오늘 배운 단어/회화를 가지고 AI에게 질문해 보세요.
        </div>

        <div class="flex flex-col gap-3">
          <textarea id="hskAIInput" class="border border-slate-200 rounded-xl p-3 text-sm w-full" rows="4"
            data-i18n-placeholder="hsk_ai_placeholder"
            placeholder="예: ‘你好’랑 ‘您好’ 차이가 뭐예요?"></textarea>

          <div class="flex gap-2">
            <button id="hskAISend" type="button" class="px-3 py-2 rounded-xl border">
              <span data-i18n="hsk_ai_send">보내기</span>
            </button>
            <button id="hskAICopyContext" type="button" class="px-3 py-2 rounded-xl border opacity-80">
              <span data-i18n="hsk_ai_copy">수업내용 복사</span>
            </button>
          </div>

          <pre id="hskAIContext" class="hidden bg-slate-50 border rounded-xl p-3 text-xs whitespace-pre-wrap"></pre>
          <div id="hskAIResult" class="text-sm"></div>
        </div>
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
    return `<option value="${lv}">HSK ${lv}급</option>`;
  }).join("");
}
