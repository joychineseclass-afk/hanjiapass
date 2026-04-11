/**
 * 상황 대화：学生回答与本轮允许答案的基础匹配（HSK1 轻量）
 */

const str = (v) => (typeof v === "string" ? v.trim() : "");

/** 去标点与空白，便于比较中文 */
export function normalizeSituationAnswer(s) {
  return String(s ?? "")
    .replace(/[\s\u3000。．，、！？!?,.:;'"'「」『』]/g, "")
    .trim();
}

function addAcceptableVariants(set, raw) {
  const t = str(raw);
  if (!t) return;
  set.add(t);
  const noPeriod = t.replace(/。$/u, "");
  if (noPeriod !== t) set.add(noPeriod);
  if (!/[。．]$/u.test(t)) set.add(`${t}。`);
}

/** 合并 explicit acceptable + studentRefs 变体 */
export function buildAcceptableSet(studentRefs, explicit) {
  const set = new Set();
  if (Array.isArray(explicit)) explicit.forEach((x) => addAcceptableVariants(set, x));
  if (Array.isArray(studentRefs)) studentRefs.forEach((x) => addAcceptableVariants(set, x));
  return [...set];
}

function matchesCandidate(transcriptNorm, candidateNorm) {
  if (!transcriptNorm || !candidateNorm) return false;
  if (transcriptNorm === candidateNorm) return true;
  if (candidateNorm.length >= 2 && transcriptNorm.includes(candidateNorm)) return true;
  if (transcriptNorm.length >= 2 && candidateNorm.includes(transcriptNorm)) return true;
  return false;
}

/**
 * @param {string} transcript
 * @param {{ acceptable?: string[], closeAnswers?: string[], studentRefs?: string[] }} round
 * @returns {{ tier: 'correct'|'close'|'bad', expectedHint: string }}
 */
export function judgeSituationRound(transcript, round) {
  const acceptable = Array.isArray(round?.acceptable) ? round.acceptable : [];
  const closeList = Array.isArray(round?.closeAnswers) ? round.closeAnswers : [];
  const expectedHint = str(round?.studentRefs?.[0]) || str(acceptable[0]) || "";

  const t = str(transcript);
  if (!t) return { tier: "bad", expectedHint };

  const tn = normalizeSituationAnswer(t);

  for (const a of acceptable) {
    if (matchesCandidate(tn, normalizeSituationAnswer(a))) return { tier: "correct", expectedHint };
  }
  for (const c of closeList) {
    if (matchesCandidate(tn, normalizeSituationAnswer(c))) return { tier: "close", expectedHint };
  }

  return { tier: "bad", expectedHint };
}
