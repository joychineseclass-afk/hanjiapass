// ui/modules/hsk/hskRenderer.js (ultimate, ESM)
// - Fix: meaning/example show as [object Object]
// - KO-first language picking, supports {ko, zh, en, ...}, arrays, nested objects
// - Safe HTML escaping
// - No window globals (ES Module)

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
 * - 优先：lang -> ko/kr -> zh/cn -> en -> first available
 */
export function pickText(v, lang = "ko") {
  if (v == null) return "";

  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) {
    return v
      .map((x) => pickText(x, lang))
      .map((x) => x.trim())
      .filter(Boolean)
      .join(" / ");
  }

  if (typeof v === "object") {
    // 常见语言键优先（韩语优先）
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

/**
 * lessons: [{id,title,subtitle,words:[]}, ...]
 */
export function renderLessonList(container, lessons, onClickLesson) {
  if (!container) return;
  container.innerHTML = "";

  (lessons || []).forEach((lesson, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition w-full";

    const title = escapeHtml(lesson?.title || `Lesson ${lesson?.id ?? idx + 1}`);
    const sub = escapeHtml(lesson?.subtitle || "");
    const count = Array.isArray(lesson?.words) ? lesson.words.length : 0;

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
 * options
 * - lang: "ko" | "zh" | "en" ...
 * - showLearnBadge: true/false
 */
export function renderWordCards(container, list, onClickWord, options = {}) {
  if (!container) return;

  // ✅ 清空容器
  container.innerHTML = "";

  // ✅ 当前语言
  const currentLang = options.lang || window.APP_LANG || "ko";

  // ✅ 防御：onClickWord 不是函数也不崩
  const handleClick =
    typeof onClickWord === "function"
      ? onClickWord
      : (w) => {
          try {
            openWordDetail?.(w); // 如果你有弹窗函数
          } catch {}
        };

  const showLearnBadge = options.showLearnBadge !== false;

  // ✅ 让卡片区不被上层 Router 误捕获（兜底）
  // （如果 Router 用了捕获阶段监听，下面 stopImmediatePropagation + 这个兜底更稳）
  container.addEventListener(
    "click",
    (e) => {
      e.stopPropagation();
    },
    false
  );

  (list || []).forEach((item) => {
    // ✅ 创建卡片按钮
    const card = document.createElement("button");
    card.type = "button"; // ✅ 防止表单提交导致刷新
    card.className =
      "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

    // ✅ 关键：阻止默认行为 + 阻止冒泡 + 阻止其他监听（防 Router）
    card.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleClick(item);
    });

    // ✅ 基础字段（兼容 meaning / meanings）
    const word = pickText(item?.word, currentLang) || "(빈 항목)";
    const pinyin = pickText(item?.pinyin, currentLang);
    const meaningText = pickText(item?.meaning ?? item?.meanings, currentLang);

    const line2 = [pinyin, meaningText].filter(Boolean).join(" · ");

    // ✅ Example fields（全部过 pickText，彻底杜绝 [object Object]）
    const exampleZh = pickText(
      item?.exampleZh ||
        item?.exampleZH ||
        item?.example_zh ||
        item?.sentenceZh ||
        item?.sentence ||
        item?.example,
      "zh"
    );

    const examplePinyin = pickText(
      item?.examplePinyin || item?.sentencePinyin || item?.example_py || item?.examplePY,
      currentLang
    );

    const exampleExplainKr = pickText(
      item?.exampleExplainKr || item?.exampleKR || item?.explainKr || item?.krExplain,
      "ko"
    );

    const exampleExplainCn = pickText(
      item?.exampleExplainCn || item?.exampleCN || item?.explainCn || item?.cnExplain,
      "zh"
    );

    // ✅ 组装 example 区块（有内容才显示）
    const exLines = [exampleZh, examplePinyin, exampleExplainKr, exampleExplainCn].filter(Boolean);
    const exampleBlock = exLines.length
      ? `<div class="mt-2 text-sm text-gray-600">${exLines
          .map((t) => `<div>${t}</div>`)
          .join("")}</div>`
      : "";

    // ✅ Learn 徽章（可选）
    const learnBadge = showLearnBadge
      ? `<div class="mt-2 inline-block text-xs px-2 py-1 rounded-full bg-gray-100">Learn</div>`
      : "";

    // ✅ 渲染卡片 HTML
    card.innerHTML = `
      <div class="text-xl font-semibold">${word}</div>
      ${line2 ? `<div class="mt-1 text-sm text-gray-500">${line2}</div>` : ""}
      ${learnBadge}
      ${exampleBlock}
    `;

    container.appendChild(card);
  });
}

// ==============================
// ✅ Global bridge for legacy UI
// ==============================
try {
  window.HSK_RENDER = window.HSK_RENDER || {};
  if (typeof renderWordCards === "function") {
    window.HSK_RENDER.renderWordCards =
      window.HSK_RENDER.renderWordCards || renderWordCards;
  }
  if (typeof renderLessonList === "function") {
    window.HSK_RENDER.renderLessonList =
      window.HSK_RENDER.renderLessonList || renderLessonList;
  }
} catch {}

/* ====== ✅ 新增：单词详情弹窗（放在文件最后）====== */
function openWordDetail(word) {
  const modal = document.createElement("div");
  modal.className = "word-modal";

  const lang = (window.APP_LANG || "ko");

  // ✅ 所有字段都先转成“可显示文本”，彻底杜绝 [object Object]
  const hanzi   = pickText(word?.hanzi || word?.word, lang);
  const pinyin  = pickText(word?.pinyin, lang);

  // meaning 可能是 word.meaning / word.kr / word.meaning.kr 等各种结构
  const meaning =
    pickText(word?.meaning, lang) ||
    pickText(word?.kr, lang) ||
    pickText(word?.ko, lang) ||
    pickText(word?.meaningKr, lang) ||
    pickText(word?.meaning_kr, lang);

  // 例句：你数据可能是 exampleZh / examplePinyin / exampleExplainKr…
  const exZh =
    pickText(word?.exampleZh, "zh") ||
    pickText(word?.example_zh, "zh") ||
    pickText(word?.sentenceZh, "zh") ||
    pickText(word?.sentence, "zh") ||
    pickText(word?.example?.zh, "zh") ||
    pickText(word?.example, "zh");

  const exPy =
    pickText(word?.examplePinyin, lang) ||
    pickText(word?.sentencePinyin, lang) ||
    pickText(word?.example_py, lang) ||
    pickText(word?.examplePY, lang);

  const exKr =
    pickText(word?.exampleExplainKr, "ko") ||
    pickText(word?.exampleKR, "ko") ||
    pickText(word?.explainKr, "ko") ||
    pickText(word?.krExplain, "ko") ||
    pickText(word?.example?.kr, "ko");

  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-hanzi">${hanzi}</div>
      <div class="modal-pinyin">${pinyin}</div>
      <div class="modal-meaning">${meaning}</div>

      <div class="modal-example">
        ${exZh ? `<p>${exZh}</p>` : ""}
        ${exPy ? `<p>${exPy}</p>` : ""}
        ${exKr ? `<p>${exKr}</p>` : ""}
      </div>

      <button class="modal-close">닫기</button>
    </div>
  `;

  modal.querySelector(".modal-close").onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}
