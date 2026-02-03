// ui/pages/page.stroke.js
import { i18n } from "../i18n.js";
import { mountStrokeSwitcher } from "../ui-stroke-player.js";
import { findInHSK } from "../hskLookup.js";

/** ===== i18n 安全封装：不同版本 i18n 也能尽量跑 ===== */
function getLang() {
  // 优先用 i18n 自己的方法/状态
  if (typeof i18n.getLang === "function") return i18n.getLang();
  if (i18n.lang) return i18n.lang;
  // 其次读 localStorage（按你们之前的 storageKey 习惯）
  return localStorage.getItem("joy_lang") || localStorage.getItem("site_lang") || "kr";
}

function t(key, fallback = "") {
  if (typeof i18n.t === "function") return i18n.t(key) ?? fallback;
  // 如果你的 i18n 没有 t()，至少不报错
  return fallback;
}

function applyI18n(root) {
  // 兼容：i18n.apply / i18n.applyRoot / i18n.applyTo
  if (!root) return;
  if (typeof i18n.apply === "function") return i18n.apply(root);
  if (typeof i18n.applyRoot === "function") return i18n.applyRoot(root);
  if (typeof i18n.applyTo === "function") return i18n.applyTo(root);
}

/** ====== HSK 释义渲染（随语言变化）====== */
async function renderMeaningFromHSK(ch, area) {
  if (!area) area = document.getElementById("stroke-meaning-area");
  if (!area) return;

  area.innerHTML = `<div style="opacity:.6">${t("stroke_loading", "불러오는 중...")}</div>`;

  const hits = await findInHSK(ch, { max: 8 });

  if (!hits.length) {
    area.innerHTML = `<div style="opacity:.6">${t(
      "stroke_no_result",
      "HSK 단어장에서 정보를 찾지 못했어요"
    )}</div>`;
    return;
  }

  const lang = getLang(); // "kr" | "zh" | ...

  area.innerHTML = hits
    .map((h) => {
      // 标签随语言变化（你也可以后续扩展更多语言）
      const labelPinyin = t("label_pinyin", "Pinyin");
      const labelKorean = t("label_korean", "한국어");
      const labelExample = t("label_example", "예문");

      // 例句：如果你未来有中文 UI，建议优先展示中文例句；韩语 UI 也一样显示中文+韩语对照更好
      const exCN = h.example?.cn || "";
      const exPY = h.example?.py || "";
      const exKR = h.example?.kr || "";

      return `
        <div style="margin:12px 0; padding:12px; border:1px solid #eee; border-radius:12px">
          <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap">
            <div><b>${h.word}</b></div>
            <div style="opacity:.7">HSK${h.level}</div>
          </div>

          <div><b>${labelPinyin}:</b> ${h.pinyin || "-"}</div>
          <div><b>${labelKorean}:</b> ${h.kr || "-"}</div>

          ${
            exCN
              ? `
            <div style="margin-top:8px; opacity:.9">
              <div><b>${labelExample}:</b> ${exCN}</div>
              <div><b>${labelPinyin}:</b> ${exPY || "-"}</div>
              <div><b>${labelKorean}:</b> ${exKR || "-"}</div>
            </div>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function getMountEl(root) {
  if (root && root.nodeType === 1) return root;
  return document.getElementById("app") || document.body;
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <h1 class="page-title" data-i18n="stroke_title"></h1>

      <div class="section-box">
        <h2 data-i18n="stroke_input"></h2>
        <div style="display:flex; gap:8px; align-items:center;">
          <input
            id="stroke-input"
            class="input-box"
            data-i18n-placeholder="stroke_placeholder"
            placeholder="한 글자 입력"
          />
          <button id="stroke-load-btn" class="btn" data-i18n="stroke_btn_load"></button>
        </div>
      </div>

      <div class="section-box">
        <h2 data-i18n="stroke_practice"></h2>
        <div id="stroke-root"></div>
      </div>

      <div class="section-box">
        <h2 data-i18n="stroke_meaning"></h2>
        <div id="stroke-meaning-area"></div>
      </div>
    </div>
  `;
}

export function mount(root) {
  const el = getMountEl(root);
  render(el);

  // ✅ 让页面文案立即按当前语言渲染
  applyI18n(el);

  const input = el.querySelector("#stroke-input");
  const btn = el.querySelector("#stroke-load-btn");
  const strokeRoot = el.querySelector("#stroke-root");
  const meaningArea = el.querySelector("#stroke-meaning-area");

  function handleLoad() {
    const ch = (input.value || "").trim().charAt(0);
    if (!ch) return;

    // 🔥 笔顺系统
    mountStrokeSwitcher(strokeRoot, ch);

    // ✅ 释义系统
    renderMeaningFromHSK(ch, meaningArea);
  }

  btn.addEventListener("click", handleLoad);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLoad();
  });

  // ✅ 如果你们的“总语言开关”会触发自定义事件，这里可以做到即时刷新
  // 你可以在切换语言按钮里 dispatchEvent(new CustomEvent("joy:langchanged"))
  window.addEventListener("joy:langchanged", () => {
    applyI18n(el);
    // 释义区若已有内容也用新语言标签重绘（输入框里有字时）
    const ch = (input.value || "").trim().charAt(0);
    if (ch) renderMeaningFromHSK(ch, meaningArea);
  });
}

export function unmount() {}
