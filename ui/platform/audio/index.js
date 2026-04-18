/**
 * Lumina Audio Engine v2 — 统一导出入口
 */
import * as AUDIO_ENGINE from "./audioEngine.js";
import * as TTS_ENGINE from "./ttsEngine.js";

export { AUDIO_ENGINE, TTS_ENGINE };
export { stopAllLearningAudio, stopAllPlayback } from "./stopAllLearningAudio.js";
export {
  playSingleText,
  playSequence,
  pauseCurrentPlayback,
  resumeCurrentPlayback,
  setLoopMode,
  TTS_SCOPE,
  getPlaybackSnapshot,
} from "./ttsPlaybackManager.js";
