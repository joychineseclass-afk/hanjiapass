/**
 * Small UI helpers for async actions (prevent double submits, etc.).
 */

/**
 * Runs `fn` while marking a button disabled and `[data-busy="1"]` for styling.
 * Re-entrant calls while busy are ignored. If `btn` is absent, runs `fn` without locking.
 *
 * Restores prior `disabled` state in `finally`.
 *
 * @param {HTMLButtonElement | null | undefined} btn
 * @param {() => void | Promise<void>} fn
 * @returns {Promise<void>}
 */
export async function withButtonLock(btn, fn) {
  if (!btn) {
    await fn();
    return;
  }
  if (btn.dataset.busy === "1") return;
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  btn.dataset.busy = "1";
  try {
    await fn();
  } finally {
    btn.disabled = wasDisabled;
    delete btn.dataset.busy;
  }
}
