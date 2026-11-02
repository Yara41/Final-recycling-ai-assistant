// Turns the last 7 days of events into a timeline played over `durationMs`.
export function replayFrames(events, { durationMs = 20000 } = {}) {
  const sorted = [...(events ?? [])].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const last = sorted.length - 1;
  return sorted.map((e, i) => ({
    atMs: last === 0 ? durationMs : Math.round((i / last) * durationMs),
    at: e.created_at,
    locationId: e.location_id ?? null,
    faculty: e.faculty ?? null,
    kind: !e.correct_bin ? 'wrong' : e.verification === 'photo' ? 'good' : 'self',
  }));
}
