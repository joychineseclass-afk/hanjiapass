// ui/pages/page.stroke.js
import { i18n } from "./i18n.js";
import { mountStrokeSwitcher } from "../ui-stroke-player.js";
import { findInHSK } from "../hskLookup.js";
async function renderMeaningFromHSK(ch) {
  const area = document.getElementById("stroke-meaning-area");
  if (!area) return;

  area.innerHTML = "불러오는 중..."; // 韩语优先

  const hits = await findInHSK(ch, { max: 8 });

  if (!hits.length) {
    area.innerHTML = "<div style='opacity:.6'>HSK 단어장에서 정보를 찾지 못했어요</div>";
    return;
  }

  area.innerHTML = hits.map(h => `
    <div style="margin:12px 0; padding:12px; border:1px solid #eee; border-radius:12px">
      <div><b>${h.word}</b> <span style="opacity:.7">HSK${h.level}</span></div>
      <div><b>Pinyin:</b> ${h.pinyin || "-"}</div>
      <div><b>한국어:</b> ${h.kr || "-"}</div>
      ${h.example?.cn ? `
        <div style="margin-top:8px; opacity:.85">
          <div><b>예문:</b> ${h.example.cn}</div>
          <div><b>Pinyin:</b> ${h.example.py || "-"}</div>
          <div><b>한국어:</b> ${h.example.kr || "-"}</div>
        </div>
      ` : ""}
    </div>
  `).join("");
}


function getMountEl(root) {
  if (root && root.nodeType === 1) return root;
  return document.getElementById("app") || document.body;
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <h1 class="page-title">한자 필순 연습</h1>

      <div class="section-box">
        <h2>한자 입력</h2>
        <div style="display:flex; gap:8px; align-items:center;">
          <input id="stroke-input" class="input-box" placeholder="한 글자 입력" />
          <button id="stroke-load-btn" class="btn">불러오기</button>
        </div>
      </div>

      <div class="section-box">
        <h2>필순 학습</h2>
        <div id="stroke-root"></div>
      </div>

      <div class="section-box">
        <h2>뜻 / 예문</h2>
        <div id="stroke-meaning-area"></div>
      </div>
    </div>
  `;
}

export function mount(root) {
  const el = getMountEl(root);
  render(el);

  const input = el.querySelector("#stroke-input");
  const btn = el.querySelector("#stroke-load-btn");
  const strokeRoot = el.querySelector("#stroke-root");

 function handleLoad() {
  const ch = (input.value || "").trim().charAt(0);
  if (!ch) return;

  // 🔥 笔顺系统
  mountStrokeSwitcher(strokeRoot, ch);

  // ✅ 释义系统
  renderMeaningFromHSK(ch, el.querySelector("#stroke-meaning-area"));
}


  btn.addEventListener("click", handleLoad);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") handleLoad();
  });
}

export function unmount() {}
