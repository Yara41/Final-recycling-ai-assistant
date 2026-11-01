// Read-only data for the impact, facilities and admin pages (Row Level Security applies).
import { getSupabase } from './supabase.js';
import { ApiError } from './errors.js';

function check({ data, error }) {
  if (error) throw new ApiError(error.message, 400, 'request_failed');
  return data;
}

export async function getMyImpact(client = getSupabase()) {
  const rows = check(await client.from('my_impact').select('*').limit(1));
  return rows?.[0] ?? { items: 0, est_kg: 0, est_co2e_kg: 0, points: 0, correct_pct: 0, streak_days: 0 };
}

export async function getLeaderboard(universityId, client = getSupabase()) {
  return check(await client.rpc('faculty_leaderboard', { p_university: universityId })) ?? [];
}

export async function getCampusStats(universityId, days = 7, client = getSupabase()) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return check(await client.rpc('university_stats', { p_university: universityId, p_from: from.toISOString(), p_to: to.toISOString() })) ?? {};
}

export async function getLatestInsight(client = getSupabase()) {
  const rows = check(await client.from('insights').select('id,report,period_start,period_end,created_at').order('created_at', { ascending: false }).limit(1));
  return rows?.[0] ?? null;
}

export async function listOpenReports(client = getSupabase()) {
  return check(await client
    .from('bin_reports')
    .select('id,issue,note,contamination_pct,created_at,locations(name)')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(50)) ?? [];
}
