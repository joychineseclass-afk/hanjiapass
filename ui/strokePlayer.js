function mountStrokeSwitcher(targetEl, hanChars) {

  // ===== 教学跟写状态 =====
  let traceApi = null;
  let teachingMode = false;   // 是否处于教学模式
  let demoPlaying = false;    // 当前是否正在播放示范笔画

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

        <!-- ✅ 顶部工具条：읽기 / 다시 + 缩放控制 + 따라쓰기 -->
        <div class="flex gap-2 flex-wrap justify-end items-center">
          <button type="button" class="btnSpeak px-2 py-1 rounded bg-slate-100 text-xs">읽기</button>
          <button type="button" class="btnReplay px-2 py-1 rounded bg-slate-100 text-xs">다시</button>

          <span class="w-px h-5 bg-slate-200 mx-1"></span>

          <button type="button" class="btnZoomOut px-2 py-1 rounded bg-slate-100 text-xs">－</button>
          <button type="button" class="btnZoomIn px-2 py-1 rounded bg-slate-100 text-xs">＋</button>

          <!-- ✅ B 方案：맞춤 -> 따라쓰기 -->
          <button type="button" class="btnTrace px-2 py-1 rounded bg-slate-100 text-xs">따라쓰기</button>
          <button type="button" class="btnReset px-2 py-1 rounded bg-slate-100 text-xs">초기화</button>
        </div>
      </div>

      <!-- 字按钮 -->
      <div class="flex flex-wrap gap-2 mb-2" id="strokeBtns"></div>

      <!-- ✅ 视口 viewport：可拖动 + 缩放 + 触屏跟写 -->
      <div class="w-full aspect-square bg-slate-50 rounded-lg overflow-hidden relative select-none">
        <div id="strokeViewport"
             class="absolute inset-0 cursor-grab active:cursor-grabbing"
             style="touch-action:none;">
          <div id="strokeStage"
               class="w-full h-full flex items-center justify-center text-xs text-gray-400">
            loading...
          </div>
        </div>

        <!-- ✅ 跟写层：默认隐藏（盖在最上层） -->
        <canvas id="traceCanvas"
          class="absolute inset-0 w-full h-full hidden"
          style="touch-action:none;"></canvas>

        <!-- 右下角显示缩放比例（可选） -->
        <div id="strokeZoomLabel"
             class="absolute right-2 bottom-2 text-[11px] text-gray-500 bg-white/70 px-2 py-1 rounded">
          100%
        </div>
      </div>

      <div class="text-[10px] text-gray-400 mt-2" id="strokeFileName"></div>

      <div class="text-xs text-gray-500 mt-2">
        💡 글자 버튼을 눌러 다른 글자의 필순도 볼 수 있어요. (휠=확대/축소, 드래그=이동, 따라쓰기=터치로 따라쓰기)
      </div>
    </div>
  `;

  const btnWrap = targetEl.querySelector("#strokeBtns");
  const stage = targetEl.querySelector("#strokeStage");
  const viewport = targetEl.querySelector("#strokeViewport");
  const fileNameEl = targetEl.querySelector("#strokeFileName");
  const zoomLabel = targetEl.querySelector("#strokeZoomLabel");
  const traceCanvas = targetEl.querySelector("#traceCanvas");

  let currentChar = chars[0];
  let currentUrl = "";

  // ✅ 缩放/平移状态
  let scale = 1;
  let tx = 0;
  let ty = 0;

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 4;

  // ✅ 跟写状态
  let tracingOn = false;
  let drawing = false;
  let lastX = 0, lastY = 0;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function setZoomLabel() {
    if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  function applyTransform() {
    const svg = stage.querySelector("svg");
    if (!svg) return;

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

  // ✅ 跟写：canvas 尺寸适配（支持 DPR）
  function resizeTraceCanvas() {
    if (!traceCanvas) return;
    const rect = traceCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    traceCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    traceCanvas.height = Math.max(1, Math.floor(rect.height * dpr));

    const ctx = traceCanvas.getContext("2d");
    // 用 CSS 像素坐标绘制
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;      // 想更粗改 6~8
    ctx.globalAlpha = 0.85;
  }

  function clearTrace() {
    if (!traceCanvas) return;
    const ctx = traceCanvas.getContext("2d");
    ctx.clearRect(0, 0, traceCanvas.width, traceCanvas.height);
  }

  function setTracing(on) {
    tracingOn = !!on;
    if (!traceCanvas) return;

    if (tracingOn) {
      traceCanvas.classList.remove("hidden");
      resizeTraceCanvas();
      // 开启时按钮高亮
      targetEl.querySelector(".btnTrace")?.classList.add("bg-orange-100", "border", "border-orange-300");
    } else {
      traceCanvas.classList.add("hidden");
      targetEl.querySelector(".btnTrace")?.classList.remove("bg-orange-100", "border", "border-orange-300");
    }
  }

  function getPos(e) {
    const rect = traceCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ✅ 绑定跟写 pointer 事件（触屏/鼠标都能写）
  if (traceCanvas) {
    traceCanvas.addEventListener("pointerdown", (e) => {
      if (!tracingOn) return;
      e.preventDefault();
      drawing = true;
      traceCanvas.setPointerCapture?.(e.pointerId);
      const p = getPos(e);
      lastX = p.x; lastY = p.y;
    });

    traceCanvas.addEventListener("pointermove", (e) => {
      if (!tracingOn || !drawing) return;
      e.preventDefault();
      const ctx = traceCanvas.getContext("2d");
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x; lastY = p.y;
    });

    const end = (e) => {
      if (!tracingOn) return;
      e.preventDefault();
      drawing = false;
    };
    traceCanvas.addEventListener("pointerup", end);
    traceCanvas.addEventListener("pointercancel", end);

    // 窗口大小改变时重新适配（保持笔迹会清空更简单稳）
    window.addEventListener("resize", () => {
      if (tracingOn) {
        clearTrace();
        resizeTraceCanvas();
      }
    });
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

    // ✅ 切换字时清空跟写
    clearTrace();

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
  svg.style.width = "80%";
  svg.style.height = "80%";
}

// ⭐ 初始化 따라쓰기
traceApi = window.StrokeTrace?.initTraceMode({
  viewport,
  svg,
  getColor: () => targetEl.querySelector(".inpColor")?.value || "#ff3b30",
  getSize: () => Number(targetEl.querySelector(".inpSize")?.value || 8),
});

// ⭐ 따라쓰기 按钮逻辑
let tracing = false;

targetEl.querySelector(".btnTrace")?.addEventListener("click", () => {
  tracing = !tracing;
  traceApi?.setEnabled(tracing);
  targetEl.querySelector(".btnTrace").classList.toggle("bg-orange-200", tracing);
});

targetEl.querySelector(".btnClear")?.addEventListener("click", () => {
  traceApi?.clearCurrent();
});
 
      // ✅ 加载新字后：重置视图
      resetView();

      // ✅ 如果跟写开着，重新适配 canvas（并保持清空）
      if (tracingOn) {
        resizeTraceCanvas();
        clearTrace();
      }

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

  // 控制按钮：읽기 / 다시 / 缩放 / 따라쓰기 / 초기화
  targetEl.querySelector(".btnSpeak")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AIUI?.speak?.(currentChar, "zh-CN");
  });

  targetEl.querySelector(".btnReplay")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // ✅ 다시：清空跟写 + bust 重载
    clearTrace();
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

  // ✅ 따라쓰기：开/关跟写层
  targetEl.querySelector(".btnTrace")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setTracing(!tracingOn);
  });

  // ✅ 초기화：清空跟写 + 复位视图
  targetEl.querySelector(".btnReset")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearTrace();
    resetView();
  });

  // ✅ 拖动平移（跟写开启时，不拖动）
  let dragging = false;
  let lastMX = 0, lastMY = 0;

  viewport.addEventListener("mousedown", (e) => {
    if (tracingOn) return; // 跟写时不拖动
    dragging = true;
    lastMX = e.clientX;
    lastMY = e.clientY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastMX;
    const dy = e.clientY - lastMY;
    lastMX = e.clientX;
    lastMY = e.clientY;
    tx += dx;
    ty += dy;
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  // ✅ 滚轮缩放（跟写开启时也允许缩放：你要禁用就加 if(tracingOn)return;）
  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
      scale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
      applyTransform();
    },
    { passive: false }
  );
}

window.StrokePlayer = {
  mountStrokeSwitcher,
};
