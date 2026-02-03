// ui/pages/page.stroke.js
import { i18n } from "../i18n.js";
import { mountStrokeSwitcher } from "../ui-stroke-player.js";
import { findInHSK } from "../hskLookup.js";

/** 释义区：从 HSK 里查并渲染（随语言切换） */
async function renderMeaningFromHSK(ch) {
  const area = document.getElementById("stroke-meaning-area");
  if (!area) return;

  area.innerHTML = `<div style="opacity:.6">${i18n.t("stroke_loading")}</div>`;

  const hits = await findInHSK(ch, { max: 8 });

  if (!hits.length) {
    area.innerHTML = `<div style="opacity:.6">${i18n.t("stroke_not_found")}</div>`;
    return;
  }

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
      <h1 class="page-title" data-i18n="stroke_title"></h1>
      <p class="page-desc" data-i18n="stroke_desc"></p>

      <div class="section-box">
        <h2 data-i18n="stroke_input_label"></h2>
        <div style="display:flex; gap:8px; align-items:center;">
          <input
            id="stroke-input"
            class="input-box"
            data-i18n-placeholder="stroke_input_ph"
          />
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

// ✅ 新增：多字串顺序练习状态
let _seq = {
  text: "", // 用户输入的字符串
  idx: 0 // 当前练到第几个字
};

// ✅ 新增：用于卸载事件
let _onNextChar = null;

export function mount(root) {
  const el = getMountEl(root);
  render(el);

  i18n.apply(el);

  const input = el.querySelector("#stroke-input");
  const btn = el.querySelector("#stroke-load-btn");
  const strokeRoot = el.querySelector("#stroke-root");

  function loadCharAt(index) {
    const s = (_seq.text || "").trim();
    if (!s) return;

    const i = Math.max(0, Math.min(index, s.length - 1));
    _seq.idx = i;

    const ch = s.charAt(_seq.idx);
    if (!ch) return;

    // 🔥 笔顺系统（保留你已跑通的）
    mountStrokeSwitcher(strokeRoot, ch);

    // ✅ 释义系统（保留并升级）
    renderMeaningFromHSK(ch);

    // ✅ 让输入框内容保持原样，但可选：把光标移动到当前字后面（更直观）
    try {
      input.focus();
      input.setSelectionRange(_seq.idx + 1, _seq.idx + 1);
    } catch {}
  }

  function handleLoad() {
    const s = (input.value || "").trim();
    if (!s) return;

    // ✅ 保存整串，从第 0 个字开始
    _seq.text = s;
    _seq.idx = 0;

    loadCharAt(0);
  }

  btn.addEventListener("click", handleLoad);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLoad();
  });

  // ✅ 新增：监听“写完自动跳下一个字”
  // 说明：这个事件来自 ui-stroke-teaching.js 中的 rootEl.dispatchEvent(new CustomEvent("stroke:nextchar"))
  _onNextChar = () => {
    const s = (_seq.text || "").trim();

    // 如果用户后来改了输入框，就以最新输入为准
    const currentInput = (input.value || "").trim();
    if (currentInput && currentInput !== s) {
      _seq.text = currentInput;
    }

    const text = (_seq.text || "").trim();
    if (!text) return;

    const next = _seq.idx + 1;

    // ✅ 到尾巴了：不再跳（你如果想循环练，从头开始，把 return 改成 loadCharAt(0)）
    if (next >= text.length) return;

    loadCharAt(next);
  };

  strokeRoot.addEventListener("stroke:nextchar", _onNextChar);

  // ⭐ 语言变化：保持你原来的逻辑
  _strokeLangHandler = () => {
    i18n.apply(el);

    // 当前显示的字：按顺序状态刷新释义
    const s = (_seq.text || "").trim();
    const ch = s ? s.charAt(_seq.idx) : (input.value || "").trim().charAt(0);

    if (ch) renderMeaningFromHSK(ch);
  };

  window.addEventListener("joy:langchanged", _strokeLangHandler);
}

export function unmount() {
  const el = getMountEl(null);
  const strokeRoot = el?.querySelector?.("#stroke-root");

  if (_onNextChar && strokeRoot) {
    strokeRoot.removeEventListener("stroke:nextchar", _onNextChar);
    _onNextChar = null;
  }

  if (_strokeLangHandler) {
    window.removeEventListener("joy:langchanged", _strokeLangHandler);
    _strokeLangHandler = null;
  }
}
