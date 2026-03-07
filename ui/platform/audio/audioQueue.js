/**
 * Lumina Audio Engine v2 — 播放队列
 */
import { audioState } from "./audioState.js";

export function setQueue(list) {
  audioState.queue = list;
  audioState.currentIndex = 0;
}

export function next() {
  audioState.currentIndex++;

  if (audioState.currentIndex >= audioState.queue.length) {
    audioState.status = "idle";
    return null;
  }

  return audioState.queue[audioState.currentIndex];
}

export function clearQueue() {
  audioState.queue = [];
  audioState.currentIndex = -1;
}
