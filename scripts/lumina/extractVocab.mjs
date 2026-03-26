/**
 * Stage-aware vocabulary extraction from lesson dialogue (longest-match on stage list).
 *
 *   import { extractVocabFromDialogue, extractVocabFromText } from "./extractVocab.mjs";
 *   extractVocabFromText("谢谢。不客气。再见。", "hsk1");
 *   // → ["谢谢", "不客气", "再见"]
 */
import {
  PUNCTUATION_STRIP_RE,
  DEFAULT_STAGE_ID,
  getStageVocabLongestFirst,
} from "./config.js";

/** Strip punctuation / spaces before matching (requirement #6). */
export function stripForMatching(text) {
  return String(text || "").replace(PUNCTUATION_STRIP_RE, "");
}

/**
 * Tokenize one continuous string: stage words longest-first, then single Hanzi fallback.
 * Does not dedupe (caller handles unique + order).
 */
export function tokenizeStripped(stripped, stageId = DEFAULT_STAGE_ID) {
  const sorted = getStageVocabLongestFirst(stageId);
  const s = String(stripped || "");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (const w of sorted) {
      if (w && s.startsWith(w, i)) {
        tokens.push(w);
        i += w.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = s[i];
    if (/[\u4e00-\u9fff]/.test(ch)) {
      tokens.push(ch);
    }
    i += 1;
  }
  return tokens;
}

/**
 * Unique tokens in order of first appearance across lines.
 * @param {string[]} dialogueLines - raw lines (punctuation kept; stripped per line before match)
 * @param {string} [stageId]
 */
export function extractVocabFromDialogue(dialogueLines, stageId = DEFAULT_STAGE_ID) {
  const seen = new Set();
  const out = [];
  for (const line of dialogueLines || []) {
    const stripped = stripForMatching(line);
    if (!stripped) continue;
    for (const t of tokenizeStripped(stripped, stageId)) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * Same as full dialogue pass on one string (e.g. whole lesson text).
 */
export function extractVocabFromText(text, stageId = DEFAULT_STAGE_ID) {
  return extractVocabFromDialogue([text], stageId);
}
