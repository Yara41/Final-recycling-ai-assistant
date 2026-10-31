// Minimal Supabase REST helpers for the Edge Functions.
//   getUser     verifies a user's access token with Supabase Auth
//   restGet     PostgREST read with the USER's token (Row Level Security applies)
//   rpcAsUser   PostgREST RPC with the user's token
//   serviceRpc  PostgREST RPC with the service role (only for the SECURITY DEFINER write functions)
import { env, HttpError, timedFetch } from "./security.ts";

// Errors raised on purpose by the SQL functions; shown to the agent as tool errors.
const KNOWN_DB_ERRORS = [
  "invalid_location",
  "invalid_quantity",
  "invalid_category",
  "invalid_bin",
  "invalid_invite",
  "invalid_university",
  "insufficient_privilege",
  "no_profile",
  "report_not_found",
];

function base(): string {
  return env("SUPABASE_URL").replace(/\/+$/, "");
}

export async function getUser(jwt: string): Promise<{ id: string; isAnonymous: boolean } | null> {
  if (!jwt) return null;
  const res = await timedFetch(
    `${base()}/auth/v1/user`,
    { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${jwt}` } },
    10_000,
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.id) return null;
  return { id: String(data.id), isAnonymous: data.is_anonymous === true };
}

async function dbError(res: Response): Promise<HttpError> {
  const data = await res.json().catch(() => ({}));
  const message = String(data?.message ?? "");
  const known = KNOWN_DB_ERRORS.find((code) => message.includes(code));
  if (known) return new HttpError(400, known, known);
  if (data?.code === "42501") return new HttpError(400, "insufficient_privilege", "insufficient_privilege");
  console.error(`database call failed (HTTP ${res.status}):`, message.slice(0, 300));
  return new HttpError(502, "db_failed", "Database request failed.");
}

async function rest<T>(path: string, key: string, init: RequestInit = {}): Promise<T> {
  const res = await timedFetch(
    `${base()}/rest/v1/${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: env("SUPABASE_ANON_KEY") || key,
        Authorization: `Bearer ${key}`,
        ...(init.headers ?? {}),
      },
    },
    10_000,
  );
  if (!res.ok) throw await dbError(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function restGet<T>(jwt: string, path: string): Promise<T> {
  return rest<T>(path, jwt);
}

export function rpcAsUser<T>(jwt: string, fn: string, args: Record<string, unknown>): Promise<T> {
  return rest<T>(`rpc/${fn}`, jwt, { method: "POST", body: JSON.stringify(args) });
}

export function serviceRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return rest<T>(`rpc/${fn}`, key, {
    method: "POST",
    body: JSON.stringify(args),
    headers: { apikey: key },
  });
}
