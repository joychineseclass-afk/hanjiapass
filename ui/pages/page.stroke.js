// ui/pages/page.stroke.js
import { i18n } from "../i18n.js";
import { mountStrokeSwitcher } from "../ui-stroke-player.js";
import { findInHSK } from "../hskLookup.js";

/** 释义区：从 HSK 里查并渲染（随语言切换） */
async function renderMeaningFromHSK(ch) {
  const area = document.getElementById("stroke-meaning-area");
  if (!area) return;

  // ✅ 加载中：用你 i18n.js 里已有的 key
  area.innerHTML = `<div style="opacity:.6">${i18n.t("stroke_loading")}</div>`;

  const hits = await findInHSK(ch, { max: 8 });

  if (!hits.length) {
    // ✅ 找不到：用你 i18n.js 里已有的 key
    area.innerHTML = `<div style="opacity:.6">${i18n.t("stroke_not_found")}</div>`;
    return;
  }

  // 标签：你目前 i18n 里未必有这些 label key，所以这里保持稳定显示（不影响主流程）
  const labelPinyin = "Pinyin";
  const labelKorean = "한국어";
  const labelExample = "예문";

  area.innerHTML = hits
    .map(
      (h) => `
    <div style="margin:12px 0; padding:12px; border:1px solid #eee; border-radius:12px">
      <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap">
        <div><b>${h.word}</b></div>
        <div style="opacity:.7">HSK${h.level}</div>
      </div>

      <div><b>${labelPinyin}:</b> ${h.pinyin || "-"}</div>
      <div><b>${labelKorean}:</b> ${h.kr || "-"}</div>

      ${
        h.example?.cn
          ? `
        <div style="margin-top:8px; opacity:.9">
          <div><b>${labelExample}:</b> ${h.example.cn}</div>
          <div><b>${labelPinyin}:</b> ${h.example.py || "-"}</div>
          <div><b>${labelKorean}:</b> ${h.example.kr || "-"}</div>
        </div>
      `
          : ""
      }
    </div>
  `
    )
    .join("");
}

function getMountEl(root) {
  if (root && root.nodeType === 1) return root;
  return document.getElementById("app") || document.body;
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <!-- ✅ 标题/说明：跟随语言 -->
      <h1 class="page-title" data-i18n="stroke_title"></h1>
      <p class="page-desc" data-i18n="stroke_desc"></p>

      <div class="section-box">
        <h2 data-i18n="stroke_input_label"></h2>
        <div style="display:flex; gap:8px; align-items:center;">
          <!-- ✅ placeholder 跟随语言 -->
          <input
            id="stroke-input"
            class="input-box"
            data-i18n-placeholder="stroke_input_ph"
          />
          <!-- ✅ 按钮跟随语言 -->
          <button
            id="stroke-load-btn"
            class="btn"
            data-i18n="stroke_load_btn"
          ></button>
        </div>
      </div>

      <div class="section-box">
        <h2 data-i18n="stroke_player_title"></h2>
        <div id="stroke-root"></div>
      </div>

      <div class="section-box">
        <h2 data-i18n="stroke_meaning_title"></h2>
        <div class="hint" data-i18n="stroke_meaning_hint"></div>
        <div id="stroke-meaning-area"></div>
      </div>
    </div>
  `;
}

let _strokeLangHandler = null;

export function mount(root) {
  const el = getMountEl(root);
  render(el);

  // ✅ 首次渲染时应用当前语言
  i18n.apply(el);

  const input = el.querySelector("#stroke-input");
  const btn = el.querySelector("#stroke-load-btn");
  const strokeRoot = el.querySelector("#stroke-root");

  function handleLoad() {
    const ch = (input.value || "").trim().charAt(0);
    if (!ch) return;

    // 🔥 笔顺系统（保留你已跑通的）
    mountStrokeSwitcher(strokeRoot, ch);

    // ✅ 释义系统（保留并升级）
    renderMeaningFromHSK(ch);
  }

  btn.addEventListener("click", handleLoad);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLoad();
  });

  // ⭐ 关键新增：监听语言变化，实时更新本页面
  _strokeLangHandler = () => {
    i18n.apply(el);

    // 如果当前已经加载了汉字，释义区也跟着语言刷新
    const ch = (input.value || "").trim().charAt(0);
    if (ch) renderMeaningFromHSK(ch);
  };

  window.addEventListener("joy:langchanged", _strokeLangHandler);
}

export function unmount() {
  if (_strokeLangHandler) {
    window.removeEventListener("joy:langchanged", _strokeLangHandler);
    _strokeLangHandler = null;
  }
}
