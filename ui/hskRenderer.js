// ui/hskRenderer.js (enhanced, KO-first, extensible)
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // 用于做“高亮”，必须先 escape，再包 <mark>
  function highlightHtml(text, query) {
    const raw = String(text ?? "");
    const q = String(query ?? "").trim();
    if (!q) return escapeHtml(raw);

    // 简单安全高亮：对 query 做转义后，用正则替换（忽略大小写）
    // 注意：我们在 escape 后替换，会导致 &amp; 这类实体内也可能匹配，
    // 但实际词汇场景基本不会。需要更严格可再优化。
    const escaped = escapeHtml(raw);
    const escapedQ = escapeHtml(q);

    // 转义正则特殊字符
    const reg = new RegExp(
      escapedQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "ig"
    );

    return escaped.replace(reg, (m) => `<mark class="px-0.5 rounded bg-yellow-100">${m}</mark>`);
  }

  // 取多语言字段：优先 currentLang，其次 ko/en/zh，最后空字符串
  function pickLang(value, currentLang) {
    if (!value) return "";
    if (typeof value === "string") return value;

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

  function normalizeText(s) {
    return String(s ?? "").replace(/\s+/g, " ").trim();
  }

  function renderLessonList(container, lessons, onClickLesson, options) {
    if (!container) return;
    container.innerHTML = "";

    const opts = options || {};
    const currentLang = opts.lang || "ko";
    const query = normalizeText(opts.query || "");

    // meta: Map(lessonIdOrIndex -> { badgeText, rightText, missing, matchCount })
    const meta = opts.meta || null;

    const frag = document.createDocumentFragment();

    (lessons || []).forEach((lesson, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition w-full " +
        "focus:outline-none focus:ring-2 focus:ring-slate-300";

      const rawTitle = lesson?.title || `Lesson ${lesson?.id ?? idx + 1}`;
      const rawSub = lesson?.subtitle || "";
      const title = query ? highlightHtml(rawTitle, query) : escapeHtml(rawTitle);
      const sub = query ? highlightHtml(rawSub, query) : escapeHtml(rawSub);

      const count = Array.isArray(lesson?.words) ? lesson.words.length : 0;

      // meta key：优先 id，其次 index
      const key = lesson?.id ?? idx;
      const m = meta?.get?.(key) || meta?.[key] || null;

      // 右侧文本：优先 meta.rightText -> options.rightTextFn -> 默认 count
      let rightText =
        (m && (m.rightText || m.badgeText)) ||
        (typeof opts.rightTextFn === "function" ? opts.rightTextFn(lesson, idx) : null) ||
        `${count}개`;

      // 缺失/匹配提示（可选）
      const warn = m?.missing ? ` · ⚠️ ${m.missing}개` : "";

      // showBadge: 默认 true
      const showBadge = opts.showBadge !== false;

      btn.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-lg font-semibold truncate">${title}</div>
            ${rawSub ? `<div class="text-sm text-gray-600 mt-1 truncate">${sub}</div>` : ""}
          </div>
          ${
            showBadge
              ? `<div class="shrink-0 text-xs px-2 py-1 rounded-full bg-slate-100 text-gray-700 whitespace-nowrap">
                   ${escapeHtml(String(rightText))}${escapeHtml(warn)}
                 </div>`
              : ""
          }
        </div>
      `;

      btn.setAttribute(
        "aria-label",
        `Lesson: ${String(rawTitle)}${rawSub ? " - " + String(rawSub) : ""}`
      );

      btn.addEventListener("click", () => onClickLesson?.(lesson, idx));
      frag.appendChild(btn);
    });

    container.appendChild(frag);
  }

  function renderWordCards(container, list, onClickWord, options) {
    if (!container) return;
    container.innerHTML = "";

    const opts = options || {};
    const currentLang = opts.lang || "ko"; // ✅ 韩语优先
    const query = normalizeText(opts.query || "");
    const showTag = opts.showTag ?? "Learn"; // 你也可以传 "학습"
    const compact = !!opts.compact;

    const frag = document.createDocumentFragment();

    (list || []).forEach((item, idx) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition " +
        "focus:outline-none focus:ring-2 focus:ring-slate-300";

      const word = item?.word || "(빈 항목)";
      const pinyin = item?.pinyin || "";

      const meaningText = pickLang(item?.meaning, currentLang);
      const exampleText = pickLang(item?.example, currentLang);

      const line1 = query ? highlightHtml(word, query) : escapeHtml(word);

      const metaLine = [pinyin, meaningText].filter(Boolean).join(" · ");
      const line2 = query ? highlightHtml(metaLine, query) : escapeHtml(metaLine);

      const ex = exampleText ? `예문: ${exampleText}` : "";
      const line3 = ex
        ? (query ? highlightHtml(ex, query) : escapeHtml(ex))
        : "&nbsp;";

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${line1}</div>
          <div class="text-xs text-gray-400">${escapeHtml(showTag)}</div>
        </div>

        <div class="${compact ? "mt-1" : "mt-2"} text-sm text-gray-600">
          ${line2 || "&nbsp;"}
        </div>

        <div class="${compact ? "mt-1" : "mt-2"} text-xs text-gray-500 whitespace-pre-wrap">
          ${line3}
        </div>
      `;

      card.setAttribute("aria-label", `Word: ${String(word)}`);
      card.addEventListener("click", () => onClickWord?.(item, idx));

      // 外部扩展钩子（比如加收藏按钮/右键菜单等）
      try {
        opts.onRenderCard?.(card, item, idx);
      } catch (e) {
        // 不影响主流程
        console.warn("onRenderCard error:", e);
      }

      frag.appendChild(card);
    });

    container.appendChild(frag);
  }

  window.HSK_RENDER = { renderLessonList, renderWordCards };
})();
