import { next } from "@vercel/functions";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const config = {
  matcher: ["/data/:path*"],
};

function isDataJsonPath(pathname) {
  return pathname.startsWith("/data/") && pathname.toLowerCase().endsWith(".json");
}

function clientIp(request) {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function normalizeHost(h) {
  if (!h) return "";
  return h.split(":")[0].toLowerCase().replace(/^www\./, "");
}

function allowedHostSet(request) {
  const hostHeader = request.headers.get("host");
  const primary = normalizeHost(hostHeader || "");
  const set = new Set();
  if (primary) {
    set.add(primary);
    if (hostHeader?.toLowerCase().startsWith("www.")) set.add(normalizeHost(hostHeader.slice(4)));
  }
  for (const raw of (process.env.ALLOWED_DATA_HOSTS || "").split(",")) {
    const h = normalizeHost(raw.trim());
    if (h) set.add(h);
  }
  return set;
}

function urlHostname(urlStr) {
  try {
    return normalizeHost(new URL(urlStr).hostname);
  } catch {
    return "";
  }
}

function headerHostAllowed(value, allowed) {
  if (!value || value === "null") return true;
  const h = urlHostname(value);
  if (!h) return false;
  for (const a of allowed) {
    if (!a) continue;
    if (h === a || h.endsWith(`.${a}`)) return true;
  }
  return false;
}

/**
 * 跨站由浏览器标记；同站/同源直接放行 Referer 细节。
 * Sec-Fetch 缺失时（curl 等）：不凭 Referer 挡，交给限流。
 */
function originPolicyOk(request) {
  const sec = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (sec === "cross-site") return false;
  if (sec === "same-origin" || sec === "same-site") return true;

  const allowed = allowedHostSet(request);
  if (allowed.size === 0) return true;

  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");

  if (referer && !headerHostAllowed(referer, allowed)) return false;
  if (origin && origin !== "null" && !headerHostAllowed(origin, allowed)) return false;
  return true;
}

function jsonErr(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function parseIntEnv(name, def) {
  const v = process.env[name];
  if (v == null || v === "") return def;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

let burstLimit;
let minuteLimit;

function getLimiters() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { burst: null, minute: null };
  }
  if (burstLimit && minuteLimit) return { burst: burstLimit, minute: minuteLimit };

  const redis = Redis.fromEnv();
  const perMin = parseIntEnv("DATA_GUARD_PER_MINUTE", 220);
  const burstSec = parseIntEnv("DATA_GUARD_BURST_WINDOW", 5);
  const burstMax = parseIntEnv("DATA_GUARD_BURST_MAX", 45);

  burstLimit = new Ratelimit({
    redis,
    prefix: "dg:burst",
    limiter: Ratelimit.slidingWindow(burstMax, `${burstSec} s`),
    analytics: true,
  });
  minuteLimit = new Ratelimit({
    redis,
    prefix: "dg:min",
    limiter: Ratelimit.slidingWindow(perMin, "60 s"),
    analytics: true,
  });
  return { burst: burstLimit, minute: minuteLimit };
}

export default async function middleware(request) {
  if (process.env.DATA_GUARD_DISABLED === "1") {
    return next();
  }

  const url = new URL(request.url);
  if (!isDataJsonPath(url.pathname)) {
    return next();
  }

  if (request.method === "OPTIONS") {
    return next();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonErr(405, { error: "method_not_allowed" });
  }

  if (!originPolicyOk(request)) {
    return jsonErr(403, { error: "forbidden_origin" });
  }

  const ip = clientIp(request);
  const { burst, minute } = getLimiters();

  if (burst) {
    const r1 = await burst.limit(ip);
    if (!r1.success) {
      const retry = Math.max(1, Math.ceil((r1.reset - Date.now()) / 1000));
      console.warn("[data-guard] burst_limit ip=%s path=%s", ip, url.pathname);
      return jsonErr(
        429,
        { error: "too_many_requests", scope: "burst", retryAfter: r1.reset },
        { "Retry-After": String(retry) }
      );
    }
  }

  if (minute) {
    const r2 = await minute.limit(ip);
    if (!r2.success) {
      const retry = Math.max(1, Math.ceil((r2.reset - Date.now()) / 1000));
      console.warn("[data-guard] rate_limit ip=%s path=%s", ip, url.pathname);
      return jsonErr(
        429,
        { error: "too_many_requests", scope: "per_minute", retryAfter: r2.reset },
        { "Retry-After": String(retry) }
      );
    }
  }

  return next({
    headers: {
      "X-Data-Guard": "1",
    },
  });
}
