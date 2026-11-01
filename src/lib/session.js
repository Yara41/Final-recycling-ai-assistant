// Sign-in and onboarding helpers. Every function takes an optional client so it can be tested.
import { ApiError } from './errors.js';
import { getSupabase } from './supabase.js';

const KNOWN = ['insufficient_privilege', 'invalid_invite', 'invalid_university', 'not_authenticated'];

function fail(error) {
  const message = String(error?.message || 'Request failed');
  const code = KNOWN.find((k) => message.includes(k)) || (error?.code === '42501' ? 'insufficient_privilege' : 'request_failed');
  throw new ApiError(message, 400, code);
}

// Returns the current session, signing in anonymously when there is none.
export async function ensureSession(client = getSupabase()) {
  const { data } = await client.auth.getSession();
  if (data?.session) return data.session;
  const res = await client.auth.signInAnonymously();
  if (res.error) fail(res.error);
  return res.data.session;
}

export async function getProfile(client = getSupabase()) {
  const { data, error } = await client
    .from('profiles')
    .select('role,faculty,display_name,university_id,universities(id,name,country,bins,default_language)')
    .maybeSingle();
  if (error) fail(error);
  return data ?? null;
}

export async function listUniversities(client = getSupabase()) {
  const { data, error } = await client.from('universities').select('id,name,country').order('name');
  if (error) fail(error);
  return data ?? [];
}

export async function createProfile({ universityId, role, faculty = null, displayName = null }, client = getSupabase()) {
  const { data, error } = await client.rpc('create_profile', {
    p_university: universityId,
    p_role: role,
    p_faculty: faculty,
    p_display_name: displayName,
  });
  if (error) fail(error);
  return data;
}

export async function redeemInvite(code, client = getSupabase()) {
  const { data, error } = await client.rpc('redeem_invite', { p_code: code });
  if (error) fail(error);
  return data;
}

// Facilities and sustainability-office accounts use email + password.
export async function signInStaff(email, password, client = getSupabase()) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) fail(error);
  return data.session;
}

export async function signOut(client = getSupabase()) {
  await client.auth.signOut();
}
