function ensurePanel() {
  // 1) 兼容旧 id
  let wrap = $("learn-panel") || $("learnPanel") || $("learnpanel");
  if (wrap) wrap.id = "learn-panel";

  // 2) 不存在才创建
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "learn-panel";
    document.body.appendChild(wrap);
  }

  // 3) ✅ 关键：每次都覆盖模板（保证按钮一定存在）
  wrap.className =
    "hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4";

  wrap.innerHTML = `
    <div class="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden relative">
      <div class="learnTopBar sticky top-0 z-[10000] bg-white border-b">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="font-semibold">배우기</div>
          <div class="flex items-center gap-2">
            <button id="learnClose" type="button"
              class="px-3 py-1 rounded-lg bg-slate-100 text-sm hover:bg-slate-200">닫기</button>
            <button id="learnCloseX" type="button"
              class="w-9 h-9 rounded-lg bg-slate-100 text-lg leading-none hover:bg-slate-200">×</button>
          </div>
        </div>
      </div>

      <div id="learnBody" class="p-4 space-y-3 max-h-[80vh] overflow-auto"></div>
    </div>
  `;

  // 4) 绑定关闭（用 onclick 覆盖，避免重复绑定）
  const close = () => $("learn-panel")?.classList.add("hidden");

  $("learnClose").onclick = (e) => { e.preventDefault(); e.stopPropagation(); close(); };
  $("learnCloseX").onclick = (e) => { e.preventDefault(); e.stopPropagation(); close(); };

  wrap.onclick = (e) => { if (e.target === wrap) close(); };

  // 5) ESC 只绑一次
  if (!document.body.dataset.learnEscBound) {
    document.body.dataset.learnEscBound = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }
}
