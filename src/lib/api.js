// Calls the EcoWasteAI Supabase Edge Functions (chat, classify).
//
// Only PUBLIC values are used here; they are read from Netlify / .env.local at build time:
//   VITE_SUPABASE_URL       e.g. https://<project-ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY  the project's legacy "anon" public key (role = anon)
// Never put the service_role key, a sb_secret_ key or the Gemini key in a VITE_ variable:
// everything prefixed with VITE_ ends up in the browser. vite.config.js refuses to build
// if a privileged key is placed here by mistake.

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const apiConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export class ApiError extends Error {
  constructor(message, status = 0, code = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function callFunction(name, payload, { timeoutMs = 60000 } = {}) {
  if (!apiConfigured) {
    console.error('EcoWasteAI: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.');
    throw new ApiError('Missing API configuration', 0, 'not_configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(error.name === 'AbortError' ? 'Request timed out' : 'Network error', 0, 'network');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* non-JSON error page */
  }

  if (!response.ok) {
    console.error(`EcoWasteAI ${name} failed:`, response.status, data);
    const code = data?.code || (response.status === 429 ? 'rate_limited' : '');
    throw new ApiError(data?.error || data?.message || data?.msg || `HTTP ${response.status}`, response.status, code);
  }
  return data ?? {};
}
