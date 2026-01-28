// ui/hskRenderer.js  (Enhanced)
// - Fix: meaning/example show as [object Object]
// - KO-first language picking, supports {ko, zh, en, ...}, arrays, nested objects
// - Safe HTML escaping
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  /**
   * ✅ pickText: 将任意数据稳定转为字符串（绝不返回 [object Object]）
   * - v: string | number | boolean | array | object
   * - lang: "ko" | "zh" | "en" | ...
   * - 优先：lang -> ko/kr -> zh/cn -> en
   */
  function pickText(v, lang = "ko") {
    if (v == null) return "";

    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);

    if (Array.isArray(v)) {
      return v.map((x) => pickText(x, lang)).filter(Boolean).join(" / ");
    }

    if (typeof v === "object") {
      // 常见字段优先（韩语优先）
      const direct =
        pickText(v?.[lang], lang) ||
        pickText(v?.ko, lang) ||
        pickText(v?.kr, lang) ||
        pickText(v?.zh, lang) ||
        pickText(v?.cn, lang) ||
        pickText(v?.en, lang);

      if (direct) return direct;

      // 兜底：遍历对象值，找到第一个可显示文本
      for (const k of Object.keys(v)) {
        const t = pickText(v[k], lang);
        if (t) return t;
      }

      // 最后兜底：不显示 object
      return "";
    }

    return "";
  }

  function renderLessonList(container, lessons, onClickLesson) {
    container.innerHTML = "";

    (lessons || []).forEach((lesson) => {
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

  /**
   * ✅ options
   * - lang: "ko" | "zh" | "en" ...
   * - showLearnBadge: true/false
   */
  function renderWordCards(container, list, onClickWord, options) {
    container.innerHTML = "";

    const currentLang =
      options?.lang ||
      window.APP_LANG || // 你未来如果加全站语言
      "ko";

    (list || []).forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      const word = pickText(item.word, currentLang) || "(빈 항목)";
      const pinyin = pickText(item.pinyin, currentLang);
      const meaningText = pickText(item.meaning, currentLang);
      const exampleText = pickText(item.example, currentLang);

      // 组合第二行：pinyin · meaning（都为空就不显示）
      const line2 = [pinyin, meaningText].filter(Boolean).join(" · ");

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${escapeHtml(word)}</div>
          <div class="text-xs text-gray-400">${options?.showLearnBadge === false ? "" : "Learn"}</div>
        </div>
        ${
          line2
            ? `<div class="mt-1 text-sm text-gray-600">${escapeHtml(line2)}</div>`
            : `<div class="mt-1 text-sm text-gray-600">&nbsp;</div>`
        }
        <div class="mt-2 text-xs text-gray-500">
          ${
            exampleText
              ? `예문: ${escapeHtml(exampleText)}`
              : "&nbsp;"
          }
        </div>
      `;

      card.addEventListener("click", () => onClickWord?.(item));
      container.appendChild(card);
    });
  }

  window.HSK_RENDER = { renderLessonList, renderWordCards };
})();
