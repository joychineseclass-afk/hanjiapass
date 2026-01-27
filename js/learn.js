// js/learn.js
// 点击播放/暂停/重播：通过把 SVG 以 inline 方式插入，才能控制动画
// 多字兼容：stroke-viewer-{index} 独立容器，不会串台

(function () {
  function buildSvgPath(ch) {
    const code = ch.codePointAt(0);
    return `data/strokes/${code}.svg`;
  }

  function escapeHtml(s) {
    return (s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function fallback(viewer, ch, msg) {
    viewer.innerHTML = `
      <div style="
        width:220px;height:220px;
        display:flex;align-items:center;justify-content:center;
        border:1px dashed #ddd;border-radius:12px;
        font-size:12px;color:#666;background:#fafafa;
        text-align:center;padding:12px;line-height:1.4;">
        <div>
          <div style="font-size:28px;font-weight:700;margin-bottom:6px;">${escapeHtml(ch)}</div>
          <div>${escapeHtml(msg || "필순 파일이 없어요")}</div>
          <div style="margin-top:6px;color:#999;">(data/strokes 확인)</div>
        </div>
      </div>
    `;
  }

  function setPlayState(svgEl, playing) {
    // 把所有可动画元素的 animation-play-state 统一控制
    const nodes = svgEl.querySelectorAll("*");
    nodes.forEach((n) => {
      const st = n.style;
      // 只改 play-state，不改其它 animation
      st.animationPlayState = playing ? "running" : "paused";
    });
    svgEl.dataset.playing = playing ? "1" : "0";
  }

  function restartSvg(svgEl) {
    // 重播最稳的方式：clone 替换（动画从头开始）
    const parent = svgEl.parentNode;
    if (!parent) return svgEl;
    const clone = svgEl.cloneNode(true);
    parent.replaceChild(clone, svgEl);
    return clone;
  }

  // 状态缓存：每个 index 对应一个 svg 元素 & 播放状态
  const STATE = new Map(); // idx -> { svgEl, playing }

  async function renderInlineSvg(ch, index) {
    const viewer = document.getElementById(`stroke-viewer-${index}`);
    if (!viewer) return;

    viewer.innerHTML = "";

    const url = buildSvgPath(ch);

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        fallback(viewer, ch, `SVG 로드 실패 (${res.status})`);
        return;
      }
      const svgText = await res.text();

      // 插入 inline SVG
      viewer.innerHTML = svgText;

      const svgEl = viewer.querySelector("svg");
      if (!svgEl) {
        fallback(viewer, ch, "SVG 형식 오류");
        return;
      }

      // 统一尺寸（避免不同 SVG 外观不一致）
      svgEl.setAttribute("width", "220");
      svgEl.setAttribute("height", "220");
      svgEl.style.maxWidth = "220px";
      svgEl.style.maxHeight = "220px";
      svgEl.style.display = "block";

      // 默认：先暂停，等用户点击播放
      setPlayState(svgEl, false);

      STATE.set(index, { svgEl, playing: false });
    } catch (e) {
      fallback(viewer, ch, `에러: ${e.message}`);
    }
  }

  // ✅ 对外接口：渲染一个字（默认暂停）
  window.strokeUI = {
    async mount(ch, index = 0) {
      await renderInlineSvg(ch, index);
    },

    play(index = 0) {
      const st = STATE.get(index);
      if (!st?.svgEl) return;
      setPlayState(st.svgEl, true);
      st.playing = true;
    },

    pause(index = 0) {
      const st = STATE.get(index);
      if (!st?.svgEl) return;
      setPlayState(st.svgEl, false);
      st.playing = false;
    },

    toggle(index = 0) {
      const st = STATE.get(index);
      if (!st?.svgEl) return;
      const playing = st.svgEl.dataset.playing === "1";
      setPlayState(st.svgEl, !playing);
      st.playing = !playing;
    },

    replay(index = 0) {
      const st = STATE.get(index);
      if (!st?.svgEl) return;
      const newSvg = restartSvg(st.svgEl);
      st.svgEl = newSvg;
      // 重播：直接 running
      setPlayState(newSvg, true);
      st.playing = true;
    },
  };
})();
