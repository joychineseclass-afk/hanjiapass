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

    // 다른 데이터셋 대비
    const alt = [...svg.querySelectorAll('[data-stroke], .stroke, [id*="animation"]')];
    return alt;
  }

  function replayCssAnimation(el) {
    el.style.animation = "none";
    // eslint-disable-next-line no-unused-expressions
    el.getBoundingClientRect();
    el.style.animation = "";
  }

  // ✅ (핵심) 완료/진행 상태에 맞게 "파란색"을 정리해주는 redraw
  // - activeIndex: 현재 파란색으로 보여줄 획 인덱스
  // - finished=true 이면 파란색을 모두 제거(전부 검정)
  function redrawStrokeColor({ activeIndex, finished = false } = {}) {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return;

    const total = strokes.length;

    // ✅ finished면 active = -1 (파란색 없음)
    const active = finished ? -1 : Math.max(0, Math.min(activeIndex ?? 0, total - 1));

    strokes.forEach((el, idx) => {
  let color;

  if (finished) {
    // 全部完成 → 维持黑色
    color = "#111827";
  } else if (idx < active) {
    // 学生已经写过的笔 → 橘色
    color = "#FB923C";
  } else if (idx === active) {
    // 当前要示范 / 跟写的笔 → 浅蓝
    color = "#93C5FD";
  } else {
    // 还没轮到的笔 → 浅灰
    color = "#D1D5DB";
  }

  try {
    const st = el.getAttribute?.("stroke");
    if (st !== "none") el.setAttribute("stroke", color);

    const fi = el.getAttribute?.("fill");
    if (fi !== "none") el.setAttribute("fill", color);

    el.style.setProperty("stroke", color, "important");
    el.style.setProperty("fill", color, "important");
  } catch {}
});


  // ✅ 自己 + 子节点都处理（有的 stroke 元素是 g/use，真正的 path 在里面）
  const targets = [s, ...(s?.querySelectorAll?.("*") || [])];

  targets.forEach((el) => {
    // 1) 用 important 强压 CSS（关键）
    try {
      el.style?.setProperty?.("stroke", color, "important");
      el.style?.setProperty?.("fill", color, "important");
    } catch {}

    // 2) 同时写属性（兼容某些 SVG）
    try {
      const st = el.getAttribute?.("stroke");
      if (st !== "none") el.setAttribute?.("stroke", color);

      const fi = el.getAttribute?.("fill");
      if (fi !== "none") el.setAttribute?.("fill", color);
    } catch {}
  });
});

  }

  // ✅ “한 획 시범” (teaching 켜졌을 때)
  // - 시범은 index를 바꾸지 않음 (학생 진행은 다른 곳에서)
  function playDemoOneStroke() {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return false;

    const strokes = getStrokeAnims(svg);
    if (!strokes.length) return false;

    // traceApi가 stroke index를 제공하면 그걸 사용
    const i = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;
    const s = strokes[i] || strokes[0];
    if (!s) return false;

    // ✅ 시범: 해당 획을 파란색으로 잠깐 강조 + 애니메이션 리플레이
    redrawStrokeColor({ activeIndex: i, finished: false });
    replayCssAnimation(s);

    return true;
  }

  // ✅ (핵심) "학생이 한 획을 끝냈다"를 감지하면 호출
  // - 마지막 획 완료 시 finished로 강제 redraw → 마지막 파란색이 검정으로 바뀜
  function onUserFinishedOneStroke() {
    const svg = stage?.querySelector?.("svg");
    if (!svg) return;

    const strokes = getStrokeAnims(svg);
    const total = strokes.length || 0;
    if (!total) return;

    const idx = Number(traceApi?.getStrokeIndex?.() ?? 0) || 0;

    // idx는 "지금 쓰는 획" 기준일 수 있으므로
    // ✅ 안전하게: idx가 마지막을 넘어가면 finished로 처리
    if (idx >= total - 1) {
  // 마지막까지 간걸로 간주
  redrawStrokeColor({ finished: true });

  // ✅ 通知外层 UI：已完成（用于统一把最后一笔也变黑）
  queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));

  // 완료 후 잠금(원하면 유지)
  traceApi?.setEnabled?.(false);
  return;
}

    // 다음 획을 파란색으로 보여줌
    redrawStrokeColor({ activeIndex: idx + 1, finished: false });
  }

  // ✅ teaching on/off
  function setTeaching(next) {
    teaching = !!next;

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
      // 1) 시범 중에는 잠깐 쓰기 잠금 → 시범 후 다시 활성
      traceApi?.setEnabled?.(false);

      const ok = playDemoOneStroke();
      if (!ok) {
        console.warn("[stroke] demo stroke not found in svg");
      }

      // 2) 시범 끝난 뒤 쓰기 활성(짧게 딜레이)
      setTimeout(() => traceApi?.setEnabled?.(true), 250);
    } else {
  traceApi?.setEnabled?.(false);
  // teaching OFF면 파란색도 정리(원하면)
  redrawStrokeColor({ finished: true });

  // ✅ 关闭教学时也兜底一次，避免残留蓝色
  queueMicrotask(() => rootEl?.dispatchEvent?.(new CustomEvent("stroke:complete")));
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
  btnTrace.addEventListener("click", () => {
    if (!teaching) return;
    traceApi?.setEnabled?.(false);
    playDemoOneStroke();
    setTimeout(() => traceApi?.setEnabled?.(true), 250);
  });

  // ✅ (매우 중요) traceApi가 "한 획 완료" 이벤트를 제공하면 여기에 연결
  // 아래 중 너의 traceApi에 맞는 것이 하나는 있을 확률이 높음.
  // - 있으면 자동으로 마지막 파란색이 검정으로 바뀜.
  try {
    if (typeof traceApi?.on === "function") {
      // 예: traceApi.on("strokeComplete", cb)
      traceApi.on("strokeComplete", onUserFinishedOneStroke);
      traceApi.on("complete", onUserFinishedOneStroke);
    } else if (typeof traceApi?.setOnStrokeComplete === "function") {
      traceApi.setOnStrokeComplete(onUserFinishedOneStroke);
    } else if (typeof traceApi?.onStrokeComplete === "function") {
      traceApi.onStrokeComplete(onUserFinishedOneStroke);
    }
  } catch (e) {
    console.warn("[stroke] cannot bind stroke complete event", e);
  }

  // 초기 상태
  setTeaching(false);
}
