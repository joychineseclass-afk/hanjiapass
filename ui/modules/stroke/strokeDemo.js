// /ui/modules/stroke/strokeDemo.js
// ✅ 完善不返工版（ES Module）
// - 只负责“示范动画”：单笔/全部
// - 无 window 依赖
// - 与 strokePlayer.canvas 的 resetTraceState / setProgress 配套
// - stop() 可随时终止播放（切字/切模式时用）

import { resetTraceState, setNumberLayerVisible, setProgress } from "./strokePlayer.canvas.js";

let demoTimer = null;
let playing = false;

export function stop() {
  playing = false;
  if (demoTimer) {
    clearTimeout(demoTimer);
    demoTimer = null;
  }
}

function cleanupStrokeEl(el) {
  if (!el) return;
  el.classList.remove("demo-stroke");
  el.style.strokeDasharray = "";
  el.style.strokeDashoffset = "";
  el.style.transition = "";
}

function cleanupAll(strokeEls) {
  (strokeEls || []).forEach(cleanupStrokeEl);
}

function ensureStrokePaint(strokeEls) {
  (strokeEls || []).forEach((p) => {
    // 确保 stroke 动画可见
    p.style.fill = "none";
    p.style.stroke = "#111";
    p.style.strokeWidth = "8";
    p.style.strokeLinecap = "round";
    p.style.strokeLinejoin = "round";
  });
}

function getLen(el) {
  try {
    const L = el.getTotalLength?.();
    if (!L) return 0;
    return Math.max(80, Math.min(2000, L));
  } catch {
    return 0;
  }
}

function animateOne(el, { duration = 420 } = {}) {
  return new Promise((resolve) => {
    if (!el) return resolve();

    // 当前笔高亮
    el.classList.remove("trace-stroke-dim");
    el.classList.add("trace-stroke-on");
    el.classList.add("demo-stroke");

    const len = getLen(el);
    if (!len) return resolve();

    el.style.transition = "none";
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);

    requestAnimationFrame(() => {
      el.style.transition = `stroke-dashoffset ${duration}ms linear`;
      el.style.strokeDashoffset = "0";

      demoTimer = setTimeout(() => {
        el.style.transition = "";
        resolve();
      }, duration + 40);
    });
  });
}

/**
 * playAll({ svg, strokeEls, speed, onStroke, showNumbersAfter })
 * - svg: 当前 SVG（用于 resetTraceState / setNumberLayerVisible）
 * - strokeEls: path list
 * - speed: 1.0 = 默认；>1 更快；<1 更慢
 */
export async function playAll({
  svg,
  strokeEls,
  speed = 1.0,
  onStroke,
  showNumbersAfter = true,
} = {}) {
  if (!strokeEls?.length) return;

  stop();
  cleanupAll(strokeEls);
  playing = true;

  // 播放前：清进度、隐藏序号
  if (svg) {
    resetTraceState({ svg, strokeEls });
    setNumberLayerVisible(svg, false);
    setProgress({ svg, strokeEls, doneCount: 0 });
  }

  ensureStrokePaint(strokeEls);

  for (let i = 0; i < strokeEls.length; i++) {
    if (!playing) break;

    // 让外部更新进度（doneCount=i）
    try { onStroke?.(i); } catch {}

    const el = strokeEls[i];
    const L = getLen(el);
    const baseMs = 420;
    const dur = Math.round((baseMs + L * 0.55) / Math.max(0.2, speed));

    await animateOne(el, { duration: dur });

    // 完成这一笔
    el.classList.remove("trace-stroke-on");
    el.classList.add("trace-stroke-done");
  }

  playing = false;

  // 播放结束：显示序号（你需要的效果）
  if (svg && showNumbersAfter) {
    setNumberLayerVisible(svg, true);
  }
}

/**
 * playOne({ svg, strokeEls, index, speed })
 * - 用于“进入 따라쓰기 自动示范一笔”
 */
export async function playOne({
  svg,
  strokeEls,
  index = 0,
  speed = 1.0,
} = {}) {
  if (!strokeEls?.length) return;

  stop();
  cleanupAll(strokeEls);
  playing = true;

  if (svg) {
    resetTraceState({ svg, strokeEls });
    setNumberLayerVisible(svg, true);
    setProgress({ svg, strokeEls, doneCount: index });
  }

  ensureStrokePaint(strokeEls);

  const el = strokeEls[index];
  if (el) {
    const L = getLen(el);
    const baseMs = 420;
    const dur = Math.round((baseMs + L * 0.55) / Math.max(0.2, speed));

    await animateOne(el, { duration: dur });
    el.classList.remove("trace-stroke-on");
    el.classList.add("trace-stroke-done");
  }

  playing = false;
}
