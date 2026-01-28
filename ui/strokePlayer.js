function mountStrokeSwitcher(targetEl, hanChars) {
  if (!targetEl) return;

  const chars = Array.from(hanChars || []).filter(Boolean);
  if (chars.length === 0) {
    targetEl.innerHTML = `<div class="text-sm text-gray-500">표시할 글자가 없어요.</div>`;
    return;
  }

  targetEl.innerHTML = `
    <div class="border rounded-xl p-3 bg-white">
      <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div class="font-semibold">필순(筆順)</div>

        <!-- ✅ 顶部工具条：읽기 / 다시 + 缩放控制 -->
        <div class="flex gap-2 flex-wrap justify-end items-center">
          <button type="button" class="btnSpeak px-2 py-1 rounded bg-slate-100 text-xs">읽기</button>
          <button type="button" class="btnReplay px-2 py-1 rounded bg-slate-100 text-xs">다시</button>

          <span class="w-px h-5 bg-slate-200 mx-1"></span>

          <button type="button" class="btnZoomOut px-2 py-1 rounded bg-slate-100 text-xs">－</button>
          <button type="button" class="btnZoomIn px-2 py-1 rounded bg-slate-100 text-xs">＋</button>
          <button type="button" class="btnFit px-2 py-1 rounded bg-slate-100 text-xs">맞춤</button>
          <button type="button" class="btnReset px-2 py-1 rounded bg-slate-100 text-xs">초기화</button>
        </div>
      </div>

      <!-- 字按钮 -->
      <div class="flex flex-wrap gap-2 mb-2" id="strokeBtns"></div>

      <!-- ✅ 视口 viewport：可拖动 + 缩放 -->
      <div class="w-full aspect-square bg-slate-50 rounded-lg overflow-hidden relative select-none">
        <div id="strokeViewport"
             class="absolute inset-0 cursor-grab active:cursor-grabbing"
             style="touch-action:none;">
          <div id="strokeStage"
               class="w-full h-full flex items-center justify-center text-xs text-gray-400">
            loading...
          </div>
        </div>

        <!-- 右下角显示缩放比例（可选） -->
        <div id="strokeZoomLabel"
             class="absolute right-2 bottom-2 text-[11px] text-gray-500 bg-white/70 px-2 py-1 rounded">
          100%
        </div>
      </div>

      <div class="text-[10px] text-gray-400 mt-2" id="strokeFileName"></div>

      <div class="text-xs text-gray-500 mt-2">
        💡 글자 버튼을 눌러 다른 글자의 필순도 볼 수 있어요. (휠=확대/축소, 드래그=이동)
      </div>
    </div>
  `;

  const btnWrap = targetEl.querySelector("#strokeBtns");
  const stage = targetEl.querySelector("#strokeStage");
  const viewport = targetEl.querySelector("#strokeViewport");
  const fileNameEl = targetEl.querySelector("#strokeFileName");
  const zoomLabel = targetEl.querySelector("#strokeZoomLabel");

  let currentChar = chars[0];
  let currentUrl = "";

  // ✅ 缩放/平移状态
  let scale = 1;
  let tx = 0;
  let ty = 0;

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 4;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function setZoomLabel() {
    if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  function applyTransform() {
    const svg = stage.querySelector("svg");
    if (!svg) return;

    // 让 svg 可被 transform
    svg.style.transformOrigin = "center center";
    svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    svg.style.maxWidth = "none";
    svg.style.maxHeight = "none";
    setZoomLabel();
  }

  function resetView() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function fitToBox() {
    const svg = stage.querySelector("svg");
    if (!svg) return;

    // 适配：根据 viewport 的大小和 svg 的 viewBox/尺寸估算
    const vpRect = viewport.getBoundingClientRect();

    // 尝试用 viewBox
    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
    let w = vb?.width || svg.getBBox?.().width || 0;
    let h = vb?.height || svg.getBBox?.().height || 0;

    // 兜底：如果拿不到尺寸
    if (!w || !h) {
      resetView();
      return;
    }

    const padding = 0.88; // 留点边距
    const sx = (vpRect.width / w) * padding;
    const sy = (vpRect.height / h) * padding;

    scale = clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE);
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function strokeUrl(ch) {
    return window.DATA_PATHS?.strokeUrl?.(ch) || "";
  }
  function fileName(ch) {
    return window.DATA_PATHS?.strokeFileNameForChar?.(ch) || "";
  }

  function setActive(btn) {
    Array.from(btnWrap.children).forEach((x) =>
      x.classList.remove("border-orange-400", "bg-orange-50")
    );
    btn.classList.add("border-orange-400", "bg-orange-50");
  }

  async function loadChar(ch, { bust = false } = {}) {
    currentChar = ch;
    currentUrl = strokeUrl(ch);

    if (fileNameEl) fileNameEl.textContent = fileName(ch);

    if (!currentUrl) {
      stage.innerHTML = `<div class="text-sm text-red-600">strokeUrl 없음: ${ch}</div>`;
      return;
    }

    const url = bust
      ? (currentUrl.includes("?") ? `${currentUrl}&v=${Date.now()}` : `${currentUrl}?v=${Date.now()}`)
      : currentUrl;

    stage.innerHTML = `<div class="text-xs text-gray-400">loading... (${ch})</div>`;
    setZoomLabel();

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        stage.innerHTML = `<div class="text-sm text-red-600">
          필순 파일이 없어요 (HTTP ${res.status})<br/>
          <span class="text-[11px] break-all">${url}</span>
        </div>`;
        return;
      }

      const svgText = await res.text();
      stage.innerHTML = svgText;

      const svg = stage.querySelector("svg");
      if (svg) {
        // 给 svg 一些基础样式，避免撑爆
        svg.style.width = "80%";
        svg.style.height = "80%";
      }

      // ✅ 加载新字后：先重置，再“适配”
      resetView();
      // 等 DOM 渲染后再 fit
      requestAnimationFrame(() => fitToBox());

      // 如果 SVG 有动画，尽量从头开始
      try {
        const svg2 = stage.querySelector("svg");
        svg2?.setCurrentTime?.(0);
        svg2?.unpauseAnimations?.();
      } catch {}

    } catch (e) {
      stage.innerHTML = `<div class="text-sm text-red-600">
        로드 실패<br/>
        <span class="text-[11px] break-all">${url}</span>
      </div>`;
    }
  }

  // 字按钮
  btnWrap.innerHTML = "";
  chars.forEach((ch, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "px-3 py-1 rounded-lg border text-sm bg-white hover:bg-slate-50";
    b.textContent = ch;

    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setActive(b);
      loadChar(ch);
    });

    btnWrap.appendChild(b);
    if (i === 0) requestAnimationFrame(() => b.click());
  });

  // 控制按钮：읽기 / 다시 / 缩放
  targetEl.querySelector(".btnSpeak")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AIUI?.speak?.(currentChar, "zh-CN");
  });

  targetEl.querySelector(".btnReplay")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    loadChar(currentChar, { bust: true });
  });

  targetEl.querySelector(".btnZoomIn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    scale = clamp(scale * 1.15, MIN_SCALE, MAX_SCALE);
    applyTransform();
  });

  targetEl.querySelector(".btnZoomOut")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    scale = clamp(scale / 1.15, MIN_SCALE, MAX_SCALE);
    applyTransform();
  });

  targetEl.querySelector(".btnReset")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetView();
  });

  targetEl.querySelector(".btnFit")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    fitToBox();
  });

  // ✅ 拖动平移
  let dragging = false;
  let lastX = 0, lastY = 0;

  viewport.addEventListener("mousedown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    tx += dx;
    ty += dy;
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  // ✅ 滚轮缩放（以鼠标为中心的“近似”缩放）
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    const factor = delta > 0 ? 1 / 1.12 : 1.12;
    scale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    applyTransform();
  }, { passive: false });
}

window.StrokePlayer = {
  mountStrokeSwitcher
};
