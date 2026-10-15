// Shared request handling for the EcoWasteAI edge functions (chat, classify).
//
// Layers of protection, from the outside in:
//   1. Supabase gateway (verify_jwt = true): rejects any request without a valid
//      project JWT. The website sends the public "anon" key, so this blocks random
//      traffic but is NOT a secret on its own.
//   2. Origin allowlist (this file): browsers can only call the functions from the
//      EcoWasteAI site, Netlify previews of it, or local development.
//   3. Per-IP rate limit (this file): best effort, kept in memory per function
//      instance, so it slows down abuse but is not a hard global quota.
//   4. Input size limits in each function.
//   5. A spending/quota cap on the Gemini API key in Google AI Studio / Cloud
//      (configured outside the code; this is the real cost ceiling).

// Default origins that may call the functions. Extra origins (for example a custom
// domain) can be added without code changes through the ALLOWED_ORIGINS secret:
//   supabase secrets set ALLOWED_ORIGINS="https://example.com,https://www.example.com"
const DEFAULT_ORIGIN_PATTERNS: RegExp[] = [
  // Production site and every Netlify deploy preview / branch deploy of it
  /^https:\/\/([a-z0-9-]+--)?recycling-ai-assistant2026\.netlify\.app$/,
  // Local development (vite dev = 5173, vite preview = 4173)
  /^http:\/\/(localhost|127\.0\.0\.1):(5173|4173)$/,
];

const ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";

// Reads a secret / environment variable and removes accidental spaces and quotes.
export function env(name: string): string {
  return String(Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

function extraOrigins(): string[] {
  return env("ALLOWED_ORIGINS")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (extraOrigins().includes(origin)) return true;
  return DEFAULT_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function json(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, ...extra, "Content-Type": "application/json; charset=utf-8" },
  });
}

// Error that carries an HTTP status and a short machine-readable code.
// The message is safe to show to users; internal details only go to the logs.
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------- best-effort rate limit (per function instance) ----------
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
}

// Returns the number of seconds to wait, or 0 if the request is allowed.
export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()): number {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    // keep memory bounded
    for (const [k, times] of hits) {
      if (!times.some((t) => now - t < windowMs)) hits.delete(k);
    }
  }
  return 0;
}

export function resetRateLimits(): void {
  hits.clear();
}

// ---------- common request checks ----------
export type GuardOptions = {
  name: string; // function name, used as rate-limit namespace
  perMinute: number; // max requests per IP per minute (per instance)
  maxBodyChars: number; // max size of the JSON body
};

// Runs origin, method, rate-limit, content-type and size checks.
// Returns either a Response to send straight back, or the parsed JSON body
// together with the CORS headers to use for the real response.
export async function guard(
  req: Request,
  opts: GuardOptions,
): Promise<Response | { body: Record<string, unknown>; cors: Record<string, string> }> {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (!isAllowedOrigin(origin)) {
    console.warn(`[${opts.name}] blocked origin:`, origin ?? "(none)");
    return json({ error: "Origin not allowed", code: "origin_not_allowed" }, 403, cors);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed", code: "method_not_allowed" }, 405, cors);
  }

  const wait = rateLimit(`${opts.name}:${clientIp(req)}`, opts.perMinute);
  if (wait > 0) {
    return json(
      { error: "Too many requests. Please wait a moment and try again.", code: "rate_limited" },
      429,
      cors,
      { "Retry-After": String(wait) },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Content-Type must be application/json", code: "bad_content_type" }, 415, cors);
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > opts.maxBodyChars) {
    return json({ error: "Request is too large", code: "too_large" }, 413, cors);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ error: "Could not read the request", code: "bad_request" }, 400, cors);
  }
  if (raw.length > opts.maxBodyChars) {
    return json({ error: "Request is too large", code: "too_large" }, 413, cors);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ error: "Invalid JSON body", code: "bad_json" }, 400, cors);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Invalid JSON body", code: "bad_json" }, 400, cors);
  }

  return { body: body as Record<string, unknown>, cors };
}

export async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new HttpError(504, "upstream_timeout", `Request timed out after ${ms / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Reads Gemini's error message without leaking it to the user.
export async function upstreamReason(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text)?.error?.message ?? text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}
