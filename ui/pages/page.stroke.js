// ui/pages/page.stroke.js
// ✅ 修复：root 可能是 undefined，render 不能直接用
// ✅ 兜底：优先用 router 传入 root，否则自动找 #app
// ✅ 先让页面不报错，再接 svg 词库

function getMountEl(root) {
  // 1) router 正常传入的 DOM
  if (root && root.nodeType === 1) return root;

  // 2) 常见容器：#app
  const app = document.getElementById("app");
  if (app) return app;

  // 3) 兜底：body
  return document.body;
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <h1 class="page-title">汉字笔顺练习</h1>

      <div class="section-box">
        <h2>🔤 输入汉字</h2>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <input id="stroke-input" class="input-box" placeholder="输入一个汉字" />
          <button id="stroke-load-btn" class="btn">加载</button>
          <small id="stroke-file-hint" style="opacity:.7;"></small>
        </div>
      </div>

      <div class="section-box">
        <h2>▶️ 笔顺演示区</h2>
        <div id="stroke-demo-area" class="stroke-area">
          （输入一个汉字后，将自动加载 SVG 笔顺）
        </div>
      </div>

      <div class="section-box">
        <h2>✍️ 描红练习区</h2>
        <div id="stroke-trace-area" class="stroke-area">
          （后续可接描红系统）
        </div>
      </div>

      <div class="section-box">
        <h2>📖 汉字释义</h2>
        <div id="stroke-meaning-area" class="stroke-area">
          （以后接字义/HSK等级）
        </div>
      </div>
    </div>
  `;
}

function toDecCodePoint(ch) {
  return ch.codePointAt(0);
}

async function loadStrokeSVG(ch, demoArea, hintEl) {
  const code = toDecCodePoint(ch);
  const url = `./data/strokes/${code}.svg`;
  if (hintEl) hintEl.textContent = `파일: ${code}.svg`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("NOT_FOUND");

    const svgText = await res.text();
    demoArea.innerHTML = svgText;

    const svg = demoArea.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "auto";
      svg.style.maxHeight = "420px";
      svg.style.display = "block";
    }
  } catch (e) {
    demoArea.innerHTML = `
      <div style="padding:12px; color:#b91c1c;">
        ❌ 找不到该汉字的笔顺 SVG：<b>${ch}</b><br/>
        路径：<code>${url}</code>
      </div>
    `;
  }
}

export function mount(root) {
  const el = getMountEl(root);     // ✅ 关键：这里兜底
  render(el);

  const input = el.querySelector("#stroke-input");
  const btn = el.querySelector("#stroke-load-btn");
  const demoArea = el.querySelector("#stroke-demo-area");
  const hintEl = el.querySelector("#stroke-file-hint");

  function handleLoad() {
    const ch = (input?.value || "").trim().charAt(0);
    if (!ch) return;
    loadStrokeSVG(ch, demoArea, hintEl);
  }

  btn?.addEventListener("click", handleLoad);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLoad();
  });

  let t = null;
  input?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(handleLoad, 300);
  });
}

export function unmount() {}
