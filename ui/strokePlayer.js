import { initTraceCanvasLayer } from "./ui-trace-canvas.js";
import { initStrokeTeaching } from "./ui-stroke-teaching.js";

export function mountStrokeSwitcher(targetEl, hanChars) {
  if (!targetEl) return;

  const chars = Array.from(hanChars || []).filter(Boolean);
  if (!chars.length) {
    targetEl.innerHTML = `<div class="text-sm text-gray-500">没有可显示的汉字</div>`;
    return;
  }

  targetEl.innerHTML = `
    <div class="border rounded-xl p-3 bg-white">
      <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div class="font-semibold">笔顺</div>
        <div class="flex gap-2 flex-wrap justify-end items-center">
          <button class="btnSpeak px-2 py-1 rounded bg-slate-100 text-xs">读音</button>
          <button class="btnReplay px-2 py-1 rounded bg-slate-100 text-xs">重播</button>
          <button class="btnTrace px-2 py-1 rounded bg-slate-100 text-xs">描红</button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-2" id="strokeBtns"></div>

      <div class="w-full aspect-square bg-slate-50 rounded-lg overflow-hidden relative select-none">
        <div id="strokeViewport" class="absolute inset-0 cursor-grab active:cursor-grabbing" style="touch-action:none;">
          <div id="strokeStage" class="w-full h-full flex items-center justify-center text-xs text-gray-400">
            loading...
          </div>
        </div>

        <canvas id="traceCanvas" class="absolute inset-0 w-full h-full hidden" style="touch-action:none;"></canvas>

        <div id="strokeZoomLabel" class="absolute right-2 bottom-2 text-[11px] text-gray-500 bg-white/70 px-2 py-1 rounded">
          100%
        </div>
      </div>
    </div>
  `;

  const btnWrap = targetEl.querySelector("#strokeBtns");
  const stage = targetEl.querySelector("#strokeStage");
  const viewport = targetEl.querySelector("#strokeViewport");
  const traceCanvas = targetEl.querySelector("#traceCanvas");
  const zoomLabel = targetEl.querySelector("#strokeZoomLabel");

  let currentChar = chars[0];
  let scale = 1, tx = 0, ty = 0;

  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function updateZoom(){ zoomLabel.textContent = `${Math.round(scale*100)}%`; }
  function applyTransform(){
    const svg = stage.querySelector("svg");
    if(!svg) return;
    svg.style.transformOrigin="center center";
    svg.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
    updateZoom();
  }

  viewport.addEventListener("wheel", e=>{
    e.preventDefault();
    scale = clamp(scale*(e.deltaY>0?1/1.12:1.12),0.5,4);
    applyTransform();
  },{passive:false});

  let dragging=false,lastX=0,lastY=0;
  viewport.addEventListener("mousedown",e=>{dragging=true;lastX=e.clientX;lastY=e.clientY});
  window.addEventListener("mousemove",e=>{
    if(!dragging) return;
    tx+=e.clientX-lastX; ty+=e.clientY-lastY;
    lastX=e.clientX; lastY=e.clientY;
    applyTransform();
  });
  window.addEventListener("mouseup",()=>dragging=false);

  const traceApi = initTraceCanvasLayer(traceCanvas);
  initStrokeTeaching(targetEl, stage, traceApi);

  function strokeUrl(ch){ return window.DATA_PATHS?.strokeUrl?.(ch)||"" }

  async function loadChar(ch){
    currentChar = ch;
    traceApi.clear();
    const res = await fetch(strokeUrl(ch)+"?v="+Date.now());
    stage.innerHTML = await res.text();
    applyTransform();
  }

  btnWrap.innerHTML="";
  chars.forEach((ch,i)=>{
    const b=document.createElement("button");
    b.className="px-3 py-1 rounded-lg border text-sm bg-white hover:bg-slate-50";
    b.textContent=ch;
    b.onclick=()=>loadChar(ch);
    btnWrap.appendChild(b);
    if(i===0) loadChar(ch);
  });

  targetEl.querySelector(".btnSpeak").onclick=()=>window.AIUI?.speak?.(currentChar,"zh-CN");
  targetEl.querySelector(".btnReplay").onclick=()=>loadChar(currentChar);
  targetEl.querySelector(".btnTrace").onclick=()=>traceApi.toggle();
}
