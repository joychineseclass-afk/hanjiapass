// /ui/modules/hsk/hskLayout.js ✅ FINAL
// - Adds: #hskLessonListWrap (directory) + #hskStudyBar (study header with back button) + #hskGrid (study area)

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
    </div>

    <div id="hskError" class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mt-3"></div>

    <!-- ✅ Directory -->
    <div id="hskLessonListWrap" class="bg-white rounded-2xl shadow p-4 mt-4">
      <div class="text-sm font-bold mb-2">Lessons</div>
      <div id="hskLessonList"></div>
    </div>

    <!-- ✅ Study header (Back + Title) -->
    <div id="hskStudyBar" class="hidden bg-white rounded-2xl shadow p-3 mt-4 mb-3 flex items-center gap-2">
      <button id="hskBackToList" type="button" class="px-3 py-1 rounded-lg border">
        ← <span data-i18n="common_back">목록으로</span>
      </button>
      <span id="hskStudyTitle" class="font-semibold"></span>
      <span id="hskStudyMeta" class="text-sm opacity-60"></span>
    </div>

    <!-- ✅ Study area (NOT bottom-of-site; it lives here) -->
    <div id="hskGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>

    <div class="h-20"></div>
    <div id="portal-root"></div>
  </section>
  `;
}

function renderLevelOptions(maxLv = 9) {
  return Array.from({ length: maxLv }, (_, i) => {
    const lv = i + 1;
    return `<option value="${lv}">HSK ${lv}급</option>`;
  }).join("");
}
