// ui/hskRenderer.js
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function normSpace(s) {
    return String(s ?? "").replace(/\s+/g, " ").trim();
  }

  // 从 meaning 里尽量拆出 “英文释义”
  // 例如: "bú kè qì You’re welcome" -> "You’re welcome"
  //      "bā eight" -> "eight"
  //      "ba (interjection particle)" -> "ba (interjection particle)" (保留)
  function extractEnglishMeaning(rawMeaning) {
    const s = normSpace(rawMeaning);
    if (!s) return "";

    // 如果包含中文/韩文，直接返回原字符串（说明不是纯英文）
    if (/[\u4E00-\u9FFF\uAC00-\uD7AF]/.test(s)) return s;

    // 常见情况：前面是拼音(带声调/字母)，后面是英文
    // 用一个“从第一个英文大写/小写单词开始”的启发式截取
    // 找到第一个明显英文词的位置（包含 a-z）
    const idx = s.search(/[A-Za-z]/);
    if (idx === -1) return s;

    // 如果 idx 很靠前，说明本身就是英文/拼音混合，直接返回
    // 例如 "ba (interjection...)" idx=0
    if (idx === 0) return s;

    // 否则截取从 idx 开始
    const tail = s.slice(idx).trim();

    // tail 过短就返回原始
    return tail.length >= 2 ? tail : s;
  }

  // 选择显示的释义：ko > zh > en > meaning
  function pickMeaning(item) {
    const ko = normSpace(item?.meaning_ko);
    const zh = normSpace(item?.meaning_zh);
    const en = normSpace(item?.meaning_en);
    const legacy = normSpace(item?.meaning);

    if (ko) return ko;
    if (zh) return zh;
    if (en) return en;

    // 旧字段可能是 "pinyin + English"，尽量抽英文
    return extractEnglishMeaning(legacy);
  }

  // 选择显示的例句：example_ko > example_zh > example
  function pickExample(item) {
    const ko = normSpace(item?.example_ko);
    const zh = normSpace(item?.example_zh);
    const ex = normSpace(item?.example);
    return ko || zh || ex || "";
  }

  function renderLessonList(container, lessons, onClickLesson) {
    container.innerHTML = "";

    lessons.forEach((lesson) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition w-full";

      // 兼容不同字段命名
      const titleRaw =
        lesson.title_ko || lesson.title_zh || lesson.title || `Lesson ${lesson.id || ""}`;
      const subRaw = lesson.subtitle_ko || lesson.subtitle_zh || lesson.subtitle || "";

      const title = escapeHtml(titleRaw);
      const sub = escapeHtml(subRaw);

      // words/dialogs 都可能存在
      const count =
        Array.isArray(lesson.words) ? lesson.words.length :
        Array.isArray(lesson.items) ? lesson.items.length :
        Array.isArray(lesson.dialogs) ? lesson.dialogs.length :
        0;

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
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition w-full";

      const word = escapeHtml(item.word || "(빈 항목)");
      const pinyin = normSpace(item.pinyin);
      const meaning = pickMeaning(item);
      const line1 = [pinyin, meaning].filter(Boolean).join(" · ");

      const ex = pickExample(item);

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${word}</div>
          <div class="text-xs text-gray-400">Learn</div>
        </div>
        <div class="mt-1 text-sm text-gray-600">${escapeHtml(line1 || "")}</div>
        <div class="mt-2 text-xs text-gray-500">${
          ex ? `예문: ${escapeHtml(ex)}` : "&nbsp;"
        }</div>
      `;

      card.addEventListener("click", () => onClickWord?.(item));
      container.appendChild(card);
    });
  }

  window.HSK_RENDER = { renderLessonList, renderWordCards };
})();
