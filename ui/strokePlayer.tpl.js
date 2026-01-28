(function () {
  function renderStrokePlayerTpl() {
    return `
      <div class="border rounded-xl p-3 bg-white">
        <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div class="font-semibold">필순(筆順)</div>

          <div class="flex gap-2 flex-wrap justify-end items-center">
            <button type="button" class="btnSpeak px-2 py-1 rounded bg-slate-100 text-xs">읽기</button>
            <button type="button" class="btnReplay px-2 py-1 rounded bg-slate-100 text-xs">다시</button>
            <button type="button" class="btnTrace px-2 py-1 rounded bg-slate-100 text-xs">따라쓰기</button>

            <!-- ✅ 完成后显示 -->
            <button type="button" class="btnRedo hidden px-2 py-1 rounded bg-slate-100 text-xs" title="다시 쓰기">↻</button>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mb-2" id="strokeBtns"></div>

        <div class="w-full aspect-square bg-slate-50 rounded-lg overflow-hidden relative select-none">
          <div id="strokeViewport" class="absolute inset-0" style="touch-action:none;">
            <div id="strokeStage"
                 class="w-full h-full flex items-center justify-center text-xs text-gray-400">
              loading...
            </div>
          </div>
        </div>

        <div class="text-[10px] text-gray-400 mt-2" id="strokeFileName"></div>
      </div>
    `;
  }

  window.StrokePlayerTpl = { renderStrokePlayerTpl };
})();
