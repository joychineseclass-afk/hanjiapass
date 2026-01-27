// ui/hskRenderer.js
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderLessonList(container, lessons, onClickLesson) {
    container.innerHTML = "";

    lessons.forEach((lesson) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition w-full";

      const title = escapeHtml(lesson.title || `Lesson ${lesson.id || ""}`);
      const sub = escapeHtml(lesson.subtitle || "");
      const count = (lesson.words || []).length;

      btn.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-lg font-semibold">${title}</div>
            ${sub ? `<div class="text-sm text-gray-600 mt-1">${sub}</div>` : ""}
          </div>
          <div class="text-xs text-gray-400">${count}개</div>
        </div>
      `;

      btn.addEventListener("click", () => onClickLesson?.(lesson));
      container.appendChild(btn);
    });
  }

  function renderWordCards(container, list, onClickWord) {
    container.innerHTML = "";

    list.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${escapeHtml(item.word || "(빈 항목)")}</div>
          <div class="text-xs text-gray-400">Learn</div>
        </div>
        <div class="mt-1 text-sm text-gray-600">${escapeHtml(
          [item.pinyin, item.meaning].filter(Boolean).join(" · ")
        )}</div>
        <div class="mt-2 text-xs text-gray-500">${
          item.example ? `예문: ${escapeHtml(item.example)}` : "&nbsp;"
        }</div>
      `;

      card.addEventListener("click", () => onClickWord?.(item));
      container.appendChild(card);
    });
  }

  window.HSK_RENDER = { renderLessonList, renderWordCards };
})();
