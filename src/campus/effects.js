// Turns the agent's action cards into things that happen on the campus:
// an item flying into its plaza bin, and the overflowing bin appearing or clearing.
// Effect = { type: 'flight', binId, points } | { type: 'report' } | { type: 'resolved' }
export function effectsForCards(cards, { plazaBins = [] } = {}) {
  const out = [];
  for (const card of cards ?? []) {
    if (card.kind === 'logged') {
      const points = Number(card.points) || 0;
      if (points <= 0 || !plazaBins.length) continue;
      const binId = plazaBins.some((b) => b.id === card.bin) ? card.bin : plazaBins[0].id;
      out.push({ type: 'flight', binId, points });
    } else if (card.kind === 'report' || (card.kind === 'audit' && card.location_id)) {
      out.push({ type: 'report' });
    } else if (card.kind === 'resolved') {
      out.push({ type: 'resolved' });
    }
  }
  return out;
}
