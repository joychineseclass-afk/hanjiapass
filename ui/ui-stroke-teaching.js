// ui-stroke-teaching.js
export function initStrokeTeaching(rootEl, stage, traceApi) {
  let teaching = false;

  const btnTrace = rootEl.querySelector(".btnTrace");
  if (!btnTrace) return;

  // ✅ (선택) teaching 상태를 작게 보여줄 라벨
  let tag = rootEl.querySelector("#teachingTag");
  if (!tag) {
    tag = document.createElement("div");
    tag.id = "teachingTag";
    tag.className =
      "absolute left-2 top-2 text-[11px] text-white bg-slate-900/80 px-2 py-1 rounded hidden";
    // stage가 들어있는 카드 안에 relative 컨테이너가 있으면 거기에 붙이는 게 베스트
    // 없으면 rootEl에라도 붙임(안 깨지게)
    const box = rootEl.querySelector(".aspect-square")?.parentElement || rootEl;
    box.style.position = box.style.position || "relative";
    box.appendChild(tag);
  }

  function setTag(on) {
    if (!tag) return;
    if (on) {
      tag.textContent = "Teaching ON";
      tag.classList.remove("hidden");
    } else {
      tag.classList.add("hidden");
    }
  }

  // ✅ SVG에서 한 획 애니메이션 엘리먼트 찾기
  function getStrokeAnims(svg) {
    // make-me-a-hanzi 방식
    const list = [...svg.querySelectorAll('[id^="make-me-a-hanzi-animation-"]')];
    if (list.length) return list;

    // 다른 데이터셋 대비(있을 수도 있는 클래스/속성)
    const alt = [...svg.querySelectorAll('[data-stroke], .stroke, [id*="animation"]')];
    return alt;
  }

  function replayCssAnimation(el) {
    // CSS 애니메이션 재시작 트릭
    el.style.animation = "none";
    // eslint-disable-next-line no-unused-expressions
    el.getBoundingClientRect();
    el.style.animation = "";
  }

  // ✅ “한 획 시범” (teaching 켜졌을 때)
  function playDemoOneStroke() {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return false;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return false;

    // traceApi가 stroke index를 제공하면 그걸 사용
    const i = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;
    const s = strokes[i] || strokes[0];
    if (!s) return false;
    // 假设 total = 总笔画数
// strokeIndex = 当前正在写的笔（0-based）

strokeIndex++;

if (strokeIndex >= total) {
  // ✅ 最后一笔写完：强制进入“完成态”
  strokeIndex = total;        // 让系统知道已经结束
  traceApi?.setEnabled(false); // 可选：全部写完就锁住
  redraw();                   // ✅ 强制刷新一次，让蓝色变黑
  return;
}

redraw(); // 普通情况：刷新进入下一笔

    replayCssAnimation(s);
    return true;
  }

  // ✅ teaching on/off
  function setTeaching(next) {
    teaching = !!next;

    // 버튼 표시(네 디자인에 맞게 최소만)
    btnTrace.classList.toggle("trace-active", teaching);
    if (teaching) {
      btnTrace.classList.add("bg-orange-500", "text-white");
      btnTrace.classList.remove("bg-slate-100");
    } else {
      btnTrace.classList.remove("bg-orange-500", "text-white");
      btnTrace.classList.add("bg-slate-100");
    }

    setTag(teaching);

    if (teaching) {
      // 1) (선택) 시범 중에는 잠깐 쓰기 잠금 → 시범 후 다시 활성
      traceApi?.setEnabled?.(false);

      const ok = playDemoOneStroke();
      if (!ok) {
        // 시범 불가 안내 (SVG에 애니메이션 레이어가 없는 경우)
        // 너무 시끄럽지 않게 콘솔/짧은 안내만
        // 필요하면 rootEl의 메시지 박스로 연결 가능
        console.warn("[stroke] demo stroke not found in svg");
      }

      // 2) 시범 끝난 뒤 쓰기 활성(짧게 딜레이)
      setTimeout(() => traceApi?.setEnabled?.(true), 250);
    } else {
      traceApi?.setEnabled?.(false);
    }
  }

  // ✅ 조작 방식: 모바일/PC 둘 다 편하게
  // - 더블클릭: 기존 유지
  btnTrace.addEventListener("dblclick", () => setTeaching(!teaching));

  // - 길게누르기(모바일): 450ms
  let pressTimer = null;
  btnTrace.addEventListener("pointerdown", () => {
    pressTimer = setTimeout(() => setTeaching(!teaching), 450);
  });
  btnTrace.addEventListener("pointerup", () => clearTimeout(pressTimer));
  btnTrace.addEventListener("pointerleave", () => clearTimeout(pressTimer));

  // - (선택) 버튼 한번 클릭 시: teaching이 켜져 있으면 “다음 시범”만 재생
  //   (학생이 쓰다가 막히면 한번 눌러서 다시 시범 보기)
  btnTrace.addEventListener("click", () => {
    if (!teaching) return;
    traceApi?.setEnabled?.(false);
    playDemoOneStroke();
    setTimeout(() => traceApi?.setEnabled?.(true), 250);
  });

  // 초기 상태
  setTeaching(false);
}
