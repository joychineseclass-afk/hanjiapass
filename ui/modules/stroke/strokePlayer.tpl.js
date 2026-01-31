// /ui/modules/stroke/strokePlayer.tpl.js
// ✅ 完善不返工版（ES Module）
// - 仅负责返回模板字符串
// - DOM 结构不变（避免返工）
// - 预留 data-i18n（后续可无痛双语）

export function renderStrokePlayerTpl() {
  return `
    <div class="border rounded-xl p-3 bg-white">
      <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div class="font-semibold" data-i18n="stroke_title">필순(筆順)</div>

        <div class="flex gap-2 flex-wrap justify-end items-center">
          <button type="button" class="btnSpeak px-2 py-1 rounded bg-slate-100 text-xs" data-i18n="stroke_btn_speak">읽기</button>
          <button type="button" class="btnReplay px-2 py-1 rounded bg-slate-100 text-xs" data-i18n="stroke_btn_replay">다시</button>

          <!-- ✅ 따라쓰기(토글) -->
          <button type="button" class="btnTrace px-2 py-1 rounded bg-slate-100 text-xs" data-i18n="stroke_btn_trace">따라쓰기</button>

          <!-- ✅ 완료 후 재연습(토글 없이 버튼만) -->
          <button type="button" class="btnRedo hidden px-2 py-1 rounded bg-slate-100 text-xs" title="다시 쓰기" aria-label="redo">↻</button>

          <!-- ✅ 필요할 때만 쓰는 지우기(캔버스/연습 상태 리셋) -->
          <button type="button" class="btnClear hidden px-2 py-1 rounded bg-slate-100 text-xs" title="지우기" aria-label="clear">지우기</button>
        </div>
      </div>

      <!-- 字按钮 -->
      <div class="flex flex-wrap gap-2 mb-2" id="strokeBtns"></div>

      <!-- ✅ 原底色保持：不加米字格、不加水印、不加缩放label -->
      <div class="w-full aspect-square bg-slate-50 rounded-lg overflow-hidden relative select-none">
        <div id="strokeViewport" class="absolute inset-0" style="touch-action:none;">
          <div id="strokeStage"
               class="w-full h-full flex items-center justify-center text-xs text-gray-400">
            loading...
          </div>
        </div>

        <!-- ✅ 跟写层：默认隐藏（由主控或 trace 开关） -->
        <canvas id="traceCanvas"
          class="absolute inset-0 w-full h-full hidden"
          style="touch-action:none;"></canvas>
      </div>

      <div class="text-[10px] text-gray-400 mt-2" id="strokeFileName"></div>

      <!-- ✅ 可选提示：不影响功能 -->
      <div class="text-xs text-gray-500 mt-2 hidden" id="strokeHint"></div>
    </div>
  `;
}
