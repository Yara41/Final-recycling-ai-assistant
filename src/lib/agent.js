// Sends one message (and optionally a photo) to the EcoWasteAI agent Edge Function.
import { ApiError } from './errors.js';
import { getSupabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase.js';

export async function sendAgentMessage(
  { message, image = null, conversationId = null, lang = 'ar' },
  { client = getSupabase(), fetchImpl = fetch, url = SUPABASE_URL, anonKey = SUPABASE_ANON_KEY, timeoutMs = 90000 } = {},
) {
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new ApiError('Not signed in', 401, 'unauthorized');

  const body = { message, conversationId, lang };
  if (image) {
    body.image = image.data;
    body.mimeType = image.mimeType;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(`${url}/functions/v1/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(error?.name === 'AbortError' ? 'Request timed out' : 'Network error', 0, 'network');
  } finally {
    clearTimeout(timer);
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(payload?.error || `HTTP ${res.status}`, res.status, payload?.code || (res.status === 429 ? 'rate_limited' : ''));
  }
  return { reply: payload?.reply ?? '', actions: payload?.actions ?? [], conversationId: payload?.conversationId ?? null };
}
