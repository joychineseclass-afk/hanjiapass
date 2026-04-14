/**
 * Lumina 跟读：后端 ASR 客户端（正式评分主链）
 */

export function getShadowingAsrEndpointUrl() {
  try {
    const o = typeof window !== "undefined" ? window.location.origin : "";
    if (o) return `${o.replace(/\/$/, "")}/api/shadowing-asr`;
  } catch (_) {}
  return "/api/shadowing-asr";
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown> }>}
 */
export async function postShadowingAsr(formData) {
  const url = getShadowingAsrEndpointUrl();
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data };
}
