// ui/pages/page.stroke.js
// ✅ 不返工版：保留你原来的 render 结构
// ✅ 兼容 Router：必须 export mount()
// ✅ 接入 SVG 词库：./data/strokes/<十进制>.svg

// （可选）如果你那三个模块已经写好了并且有导出函数名，就把下面三行打开并改成真实导出名
// import { initStrokePlayer } from "../ui-stroke-player.js";
// import { initTeachingMode } from "../ui-stroke-teaching.js";
// import { initTraceCanvas } from "../ui-trace-canvas.js";

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

// ✅ 核心：把汉字转换成 svg 文件名（十进制）
function toDecCodePoint(ch) {
  return ch.codePointAt(0); // 十进制
}

async function loadStrokeSVG(ch, demoArea, hintEl) {
  const code = toDecCodePoint(ch);
  const url = `./data/strokes/${code}.svg`;

  if (hintEl) hintEl.textContent = `파일: ${code}.svg`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("NOT_FOUND");

    const svgText = await res.text();

    // 直接显示 SVG
    demoArea.innerHTML = svgText;

    // 让 SVG 自适应显示
    const svg = demoArea.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "auto";
      svg.style.maxHeight = "420px";
      svg.style.display = "block";
    }

    // ✅ 预留：如果你那三个笔顺模块已完成，就在这里“挂载”
    // initStrokePlayer?.(demoArea, { char: ch, code, url });
    // initTeachingMode?.(demoArea, { char: ch, code, url });
    // initTraceCanvas?.(document.getElementById("stroke-trace-area"), { char: ch, code, url });

  } catch (e) {
    demoArea.innerHTML = `
      <div style="padding:12px; color:#b91c1c;">
        ❌ 找不到该汉字的笔顺 SVG：<b>${ch}</b><br/>
        路径：<code>${url}</code><br/>
        <div style="margin-top:6px; opacity:.8;">
          ✅ 请确认这个网址能直接打开：<br/>
          <code>${location.origin}${location.pathname.replace(/index\\.html?$/, "")}data/strokes/${code}.svg</code>
        </div>
      </div>
    `;
  }
}

// ✅ Router 需要的入口：mount / unmount
export function mount(root) {
  render(root);

  const input = root.querySelector("#stroke-input");
  const btn = root.querySelector("#stroke-load-btn");
  const demoArea = root.querySelector("#stroke-demo-area");
  const hintEl = root.querySelector("#stroke-file-hint");

  function handleLoad() {
    const ch = (input.value || "").trim().charAt(0);
    if (!ch) return;
    loadStrokeSVG(ch, demoArea, hintEl);
  }

  // 点击加载
  btn?.addEventListener("click", handleLoad);

  // 回车加载
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLoad();
  });

  // 输入后 300ms 自动加载（更顺滑）
  let t = null;
  input?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(handleLoad, 300);
  });
}

export function unmount(root) {
  // 先不做清理也没问题；后续如果你模块里有销毁函数再加
}
