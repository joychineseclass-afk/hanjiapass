/**
 * Lumina Audio Engine v2 — 本地音频文件驱动
 */
let audio = null;

export function play(url) {
  if (audio) {
    audio.pause();
  }

  audio = new Audio(url);
  audio.play();
}

export function stop() {
  if (audio) {
    audio.pause();
    audio = null;
  }
}
