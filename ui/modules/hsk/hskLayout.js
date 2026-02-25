// /ui/modules/hsk/hskLayout.js
// ✅ HSK Layout (Ultimate, split-files friendly)
// Goals:
// 1) ✅ Add "Mode" switch: Teacher(Page) / Kids(Modal)
// 2) ✅ Add Step tabs: Words / Dialogue / Grammar / Practice / AI
// 3) ✅ Prevent duplicated lessons list (only ONE lessons area)
// 4) ✅ Keep your existing ids so current code keeps working:
//    - #hskLevel #hskVersion #hskSearch #hskStatus #hskError
//    - #hskLessonsWrap #hskLessons #hskGrid #portal-root

export function getHSKLayoutHTML() {
  return `
    <div class="bg-white rounded-2xl shadow p-4 mb-4">
      <div class="flex flex-col md:flex-row md:items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold text-blue-600" data-i18n="hsk_title">HSK 학습 콘텐츠</span>
          <span id="hskStatus" class="text-xs text-gray-400"></span>
        </div>

        <div class="flex-1"></div>

        <div class="flex flex-wrap items-center gap-2">
          <label class="text-sm text-gray-600" data-i18n="hsk_level">레벨</label>
          <select
            id="hskLevel"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            ${renderLevelOptions()}
          </select>

          <select
            id="hskVersion"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="hsk2.0">HSK 2.0</option>
            <option value="hsk3.0">HSK 3.0</option>
          </select>

          <input
            id="hskSearch"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="검색 (예: 你好 / 숫자)"
            data-i18n-placeholder="hsk_search_placeholder"
            autocomplete="off"
          />

          <!-- ✅ NEW: Mode switch (Teacher=page / Kids=modal) -->
          <select
            id="hskMode"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
            title="학습 모드"
          >
            <option value="modal">Kids 모드 (팝업)</option>
            <option value="page">Teacher 모드 (페이지)</option>
          </select>
        </div>
      </div>

      <div class="mt-3 text-xs text-gray-500 flex items-center gap-1">
        <span>💡</span>
        <span data-i18n="hsk_tip">카드 클릭 → 배우기 → AI 선생님에게 질문하기</span>
      </div>

      <!-- ✅ NEW: Step tabs (single place) -->
      <div class="mt-4 flex flex-wrap gap-2" id="hskStepTabs">
        ${renderStepTab("words", "단어 / Words", true)}
        ${renderStepTab("dialogue", "회화 / Dialogue")}
        ${renderStepTab("grammar", "문법 / Grammar")}
        ${renderStepTab("practice", "연습 / Practice")}
        ${renderStepTab("ai", "AI / 말하기")}
      </div>

      <!-- ✅ NEW: Page mode panel (Teacher mode) -->
      <div id="hskPagePanel" class="hidden mt-4 border border-gray-100 rounded-xl p-4 bg-gray-50">
        <div class="flex items-center justify-between gap-2">
          <div class="text-sm font-bold text-gray-700">Lesson Content (Teacher 모드)</div>
          <div class="text-xs text-gray-500">모달 없이 페이지에서 학습합니다.</div>
        </div>

        <div id="hskPageBody" class="mt-3">
          <!-- Step content will be injected by JS (words/dialogue/grammar/practice/ai) -->
        </div>
      </div>
    </div>

    <div id="hskError" class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm"></div>

    <!-- ✅ Lessons list (ONLY ONE lessons area) -->
    <div id="hskLessonsWrap" class="hidden bg-white rounded-2xl shadow p-4 mb-4">
      <div class="flex items-center justify-between">
        <div class="text-sm font-bold">Lessons</div>
        <div class="text-xs text-gray-400">수업을 선택하세요</div>
      </div>
      <div id="hskLessons" class="mt-3"></div>
    </div>

    <!-- ✅ Word grid (used in Modal mode as well; you can keep it visible for vocab browsing) -->
    <div id="hskGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>

    <div class="h-20"></div>
    <div id="portal-root"></div>
  `;
}

/* ------------------------------
   helpers
------------------------------ */
function renderLevelOptions() {
  return Array.from({ length: 9 }, (_, i) => {
    const level = i + 1;
    return `<option value="${level}" ${level === 1 ? "selected" : ""}>HSK ${level}급</option>`;
  }).join("");
}

function renderStepTab(step, label, active = false) {
  const base =
    "px-3 py-2 rounded-full text-sm border transition select-none";
  const cls = active
    ? `${base} bg-blue-50 border-blue-200 text-blue-700 font-bold`
    : `${base} bg-white border-gray-200 text-gray-700 hover:bg-gray-50`;

  // data-step is used by JS to switch active tab
  return `<button type="button" class="${cls}" data-step="${step}">${label}</button>`;
}
