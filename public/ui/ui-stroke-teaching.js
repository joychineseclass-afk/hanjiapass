export function initStrokeTeaching(rootEl, stage, traceApi){
  let teaching=false;

  function playDemo(){
    const svg=stage.querySelector("svg");
    if(!svg) return;
    const strokes=[...svg.querySelectorAll('[id^="make-me-a-hanzi-animation-"]')];
    const i=traceApi.getStrokeIndex?.()||0;
    const s=strokes[i]; if(!s) return;
    s.style.animation="none"; s.getBoundingClientRect(); s.style.animation=null;
  }

  const btn=rootEl.querySelector(".btnTrace");
  btn.addEventListener("dblclick",()=>{
    teaching=!teaching;
    if(teaching) playDemo();
  });
}
