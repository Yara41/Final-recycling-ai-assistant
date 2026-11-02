// Loads the anonymised campus snapshot (buildings, faculty growth, recent events, open reports).
import { getSupabase } from '../lib/supabase.js';

export async function fetchSnapshot(universityId, client = getSupabase()) {
  const { data, error } = await client.rpc('campus_snapshot', { p_university: universityId });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('empty campus snapshot');
  return data;
}

// Report pins per kiosk: one amber pin for every location with an open report.
export function pinsFromSnapshot(snapshot) {
  const seen = new Set();
  const pins = [];
  for (const r of snapshot?.open_reports ?? []) {
    if (!r.location_id || seen.has(r.location_id)) continue;
    seen.add(r.location_id);
    pins.push({ locationId: r.location_id, kind: 'warn', issue: r.issue });
  }
  return pins;
}
