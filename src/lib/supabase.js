// The website's single Supabase client (public anon key only; Row Level Security protects data).
import { createClient } from '@supabase/supabase-js';

const env = import.meta.env ?? {};
export const SUPABASE_URL = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = String(env.VITE_SUPABASE_ANON_KEY || '').trim();

let client = null;

export function getSupabase() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ecowaste-auth' },
    });
  }
  return client;
}
