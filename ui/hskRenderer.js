// ui/hskRenderer.js (ultimate fix for [object Object] + highlight-ready)
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ✅ 永远把任何值安全变成“可显示的字符串”
  function toText(v) {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);

    // 对象：尽量提取常见字段；否则 JSON stringify
    if (typeof v === "object") {
      // 常见情况：{ text: "..." } 或 { value: "..." }
      if (typeof v.text === "string") return v.text;
      if (typeof v.value === "string") return v.value;

      try {
        // 如果是 {ko:"", en:""} 这种，就不要 stringify 整个对象了（太长）
        const keys = Object.keys(v);
        // 只要对象里有语言键，直接返回空（让 pickLang 处理）
        const hasLang = keys.some((k) => ["ko", "kr", "en", "zh", "cn", "ja"].includes(k));
        if (hasLang) return ""; // 交给 pickLang
        return JSON.stringify(v);
      } catch {
        return "";
      }
    }

    return String(v);
  }

  // ✅ 取多语言字段：优先 currentLang，其次 ko/en/zh，最后返回空字符串
  // 关键增强：即使取到的是对象，也会再次 toText，确保不会变 [object Object]
  function pickLang(value, currentLang) {
    if (value == null) return "";

    // 字符串直接返回
    if (typeof value === "string") return value;

    // 对象：{ ko, en, zh, ... } 或嵌套对象
    if (typeof value === "object") {
      const v = value;

      // 统一别名
      const lang = currentLang || "ko";
      const koVal = v.ko ?? v.kr;
      const zhVal = v.zh ?? v.cn;

      // 可能取到的仍然是对象，所以必须 toText
      const picked =
        v?.[lang] ??
        koVal ??
        v?.en ??
        zhVal ??
        v?.ja ??
        "";

      // 如果 picked 是空，但 value 本身是对象且有一个字符串字段，也给它机会
      const s = toText(picked);
      if (s) return s;

      // 尝试从对象里找第一个字符串值
      for (const k of Object.keys(v)) {
        const tv = toText(v[k]);
        if (tv) return tv;
      }
      return "";
    }

    return toText(value);
  }

  // ✅ 高亮（可选）：用于搜索词高亮
  function highlight(text, query) {
    const t = String(text ?? "");
    const q = String(query ?? "").trim();
    if (!q) return escapeHtml(t);

    // 简单大小写不敏感高亮
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    return escapeHtml(t).replace(re, (m) => `<mark class="bg-yellow-100 px-0.5 rounded">${escapeHtml(m)}</mark>`);
  }

  function renderLessonList(container, lessons, onClickLesson, options) {
    container.innerHTML = "";

    const q = options?.query || "";
    const meta = options?.meta; // Map(key -> { rightText, missing })
    const showBadge = options?.showBadge;

    lessons.forEach((lesson, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition w-full";

      const key = lesson?.id ?? idx;
      const title = String(lesson.title || `Lesson ${lesson.id || ""}`);
      const sub = String(lesson.subtitle || "");
      const count = (lesson.words || []).length;

      const rightText =
        (showBadge && meta?.get(key)?.rightText) ? meta.get(key).rightText : `${count}개`;
      const missing = meta?.get(key)?.missing || 0;

      btn.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-lg font-semibold">${highlight(title, q)}</div>
            ${
              sub
                ? `<div class="text-sm text-gray-600 mt-1">${highlight(sub, q)}</div>`
                : ""
            }
            ${
              missing
                ? `<div class="text-xs text-orange-500 mt-1">누락 ${missing}개</div>`
                : ""
            }
          </div>
          <div class="text-xs text-gray-400">${escapeHtml(rightText)}</div>
        </div>
      `;

      btn.addEventListener("click", () => onClickLesson?.(lesson));
      container.appendChild(btn);
    });
  }

  function renderWordCards(container, list, onClickWord, options) {
    container.innerHTML = "";

    const currentLang = options?.lang || "ko";
    const q = options?.query || "";
    const showTag = options?.showTag || "Learn";

    list.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      const wordText = toText(item.word) || "(빈 항목)";
      const pinyinText = toText(item.pinyin);
      const meaningText = pickLang(item.meaning, currentLang);
      const exampleText = pickLang(item.example, currentLang);

      const line2 = [pinyinText, meaningText].filter(Boolean).join(" · ");

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${highlight(wordText, q)}</div>
          <div class="text-xs text-gray-400">${escapeHtml(showTag)}</div>
        </div>
        <div class="mt-1 text-sm text-gray-600">${
          line2 ? highlight(line2, q) : "&nbsp;"
        }</div>
        <div class="mt-2 text-xs text-gray-500">${
          exampleText ? `예문: ${highlight(exampleText, q)}` : "&nbsp;"
        }</div>
      `;

      card.addEventListener("click", () => onClickWord?.(item));
      container.appendChild(card);
    });
  }

  window.HSK_RENDER = { renderLessonList, renderWordCards, pickLang };
})();
