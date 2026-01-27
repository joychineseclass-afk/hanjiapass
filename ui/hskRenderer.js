// ui/hskRenderer.js
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // 取多语言字段：优先 currentLang，其次 ko/en/zh，最后空字符串
  function pickLang(value, currentLang) {
    if (!value) return "";
    if (typeof value === "string") return value;

    // value 是对象：{ ko, en, zh, ... }
    if (typeof value === "object") {
      return (
        value?.[currentLang] ||
        value?.ko ||
        value?.en ||
        value?.zh ||
        ""
      );
    }
    return String(value);
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

  function renderWordCards(container, list, onClickWord, options) {
    container.innerHTML = "";

    const currentLang = options?.lang || "ko";

    list.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      const meaningText = pickLang(item.meaning, currentLang);
      const exampleText = pickLang(item.example, currentLang);

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${escapeHtml(item.word || "(빈 항목)")}</div>
          <div class="text-xs text-gray-400">Learn</div>
        </div>
        <div class="mt-1 text-sm text-gray-600">${escapeHtml(
          [item.pinyin, meaningText].filter(Boolean).join(" · ")
        )}</div>
        <div class="mt-2 text-xs text-gray-500">${
          exampleText ? `예문: ${escapeHtml(exampleText)}` : "&nbsp;"
        }</div>
      `;

      card.addEventListener("click", () => onClickWord?.(item));
      container.appendChild(card);
    });
  }

  window.HSK_RENDER = { renderLessonList, renderWordCards };
})();
