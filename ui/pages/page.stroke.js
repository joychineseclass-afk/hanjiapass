// ui/pages/page.stroke.js
import { mountStrokeSwitcher } from "../ui-stroke-player.js";

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

    // 🔥 关键：调用你完整的笔顺系统
    mountStrokeSwitcher(strokeRoot, ch);

    // 加载释义
    loadMeaning(ch, el.querySelector("#stroke-meaning-area"));
  }

  btn.addEventListener("click", handleLoad);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") handleLoad();
  });
}

export function unmount() {}
