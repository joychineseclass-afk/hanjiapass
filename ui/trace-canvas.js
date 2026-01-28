export function initTraceCanvasLayer(canvas){
  const ctx=canvas.getContext("2d");
  let tracing=false,drawing=false,lastX=0,lastY=0;

  function resize(){
    const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    canvas.width=r.width*dpr; canvas.height=r.height*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.lineWidth=6; ctx.globalAlpha=0.85;
  }
  resize(); window.addEventListener("resize",resize);

  function pos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}

  canvas.addEventListener("pointerdown",e=>{if(!tracing)return;drawing=true;const p=pos(e);lastX=p.x;lastY=p.y});
  canvas.addEventListener("pointermove",e=>{
    if(!drawing||!tracing)return;
    const p=pos(e);
    ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y); ctx.stroke();
    lastX=p.x; lastY=p.y;
  });
  window.addEventListener("pointerup",()=>drawing=false);

  return {
    toggle(){
      tracing=!tracing;
      canvas.classList.toggle("hidden",!tracing);
      if(tracing) resize();
    },
    clear(){ ctx.clearRect(0,0,canvas.width,canvas.height); }
  };
}
