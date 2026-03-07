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

// ✅ 多字串顺序练习状态
let _seq = { text: "", idx: 0 };

// ✅ 卸载事件句柄
let _onNextChar = null;

function isHan(ch) {
  return /[\u3400-\u9FFF]/.test(ch);
}

export function mount(root) {
  const el = getMountEl(root);
  render(el);
  i18n.apply(el);

  const input = el.querySelector("#stroke-input");
  const btn = el.querySelector("#stroke-load-btn");
  const strokeRoot = el.querySelector("#stroke-root");

  function getTextArray() {
    const raw = String((_seq.text || "").trim());
    const arr = Array.from(raw).filter(isHan);
    return arr;
  }

  function loadCharAt(index) {
    const arr = getTextArray();
    if (!arr.length) return;

    const i = Math.max(0, Math.min(index, arr.length - 1));
    _seq.idx = i;

    const ch = arr[_seq.idx];
    if (!ch) return;

    // 🔥 笔顺系统（保留你已跑通的）
    mountStrokeSwitcher(strokeRoot, ch);

    // ✅ 释义系统
    renderMeaningFromHSK(ch);

    // ✅ 光标跟随（可选）
    try {
      input.focus();
      // 这里用原始字符串 idx（可能含非汉字），所以只做“尽力而为”
      input.setSelectionRange(Math.min(_seq.idx + 1, input.value.length), Math.min(_seq.idx + 1, input.value.length));
    } catch {}
  }

  function handleLoad() {
    const s = String((input.value || "").trim());
    if (!s) return;

    _seq.text = s;
    _seq.idx = 0;

    loadCharAt(0);
  }

  btn.addEventListener("click", handleLoad);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLoad();
  });

  // ✅ 监听：写完整个字 → 自动跳下一个字
  _onNextChar = () => {
    const currentInput = String((input.value || "").trim());
    if (currentInput && currentInput !== _seq.text) {
      _seq.text = currentInput;
    }

    const arr = getTextArray();
    if (!arr.length) return;

    const next = _seq.idx + 1;
    if (next >= arr.length) return; // 到尾巴就停（你想循环就改成 loadCharAt(0)）

    loadCharAt(next);
  };

  strokeRoot.addEventListener("stroke:nextchar", _onNextChar);

  // ✅ 语言变化：刷新静态文案 + 当前字释义
  _strokeLangHandler = () => {
    i18n.apply(el);

    const arr = getTextArray();
    const ch = arr.length ? arr[Math.min(_seq.idx, arr.length - 1)] : String((input.value || "").trim()).charAt(0);

    if (ch) renderMeaningFromHSK(ch);
  };

  window.addEventListener("joy:langChanged", _strokeLangHandler);
}

export function unmount() {
  const el = getMountEl(null);
  const strokeRoot = el?.querySelector?.("#stroke-root");

  if (_onNextChar && strokeRoot) {
    strokeRoot.removeEventListener("stroke:nextchar", _onNextChar);
    _onNextChar = null;
  }

  if (_strokeLangHandler) {
    window.removeEventListener("joy:langChanged", _strokeLangHandler);
    _strokeLangHandler = null;
  }
}
