// Turns the agent's action cards into things that happen on the campus:
// a bottle flying into a building, a report pin appearing or disappearing, and Eco reacting.
// Effect = { type: 'flight'|'pin'|'unpin'|'eco', buildingId, locationId?, points?, tone?, text? }
export function effectsForCards(cards, { layout, profileFaculty } = {}) {
  const buildings = layout?.buildings ?? [];
  if (!buildings.length) return [];
  const kioskBy = new Map((layout.kiosks ?? []).map((k) => [k.locationId, k]));
  const facultyBuilding = buildings.find((b) => b.faculty === profileFaculty);

  const where = (card) => {
    const loc = card.location_id ?? card.locationId ?? null;
    const kiosk = loc ? kioskBy.get(loc) : null;
    const buildingId = kiosk?.buildingId ?? facultyBuilding?.id ?? buildings[0].id;
    return { buildingId, locationId: kiosk ? loc : null };
  };
  // A pin needs a bin; without a known one, use the first bin of the building.
  const binOf = (buildingId, locationId) =>
    locationId ?? (layout.kiosks ?? []).find((k) => k.buildingId === buildingId)?.locationId ?? null;

  const out = [];
  let eco = null;
  for (const card of cards ?? []) {
    const { buildingId, locationId } = where(card);
    if (card.kind === 'logged') {
      const points = Number(card.points) || 0;
      if (points > 0) out.push({ type: 'flight', buildingId, points, tone: 'good' });
      eco ??= { buildingId, text: card.title, tone: points > 0 ? 'good' : undefined };
    } else if (card.kind === 'report' || card.kind === 'audit') {
      const bin = binOf(buildingId, locationId);
      if (card.kind === 'report' || locationId) out.push({ type: 'pin', buildingId, locationId: bin, tone: 'warn' });
      eco ??= { buildingId, text: card.title, tone: 'warn' };
    } else if (card.kind === 'resolved') {
      out.push({ type: 'unpin', buildingId, locationId });
      eco ??= { buildingId, text: card.title, tone: 'good' };
    }
  }
  if (eco) out.push({ type: 'eco', ...eco });
  return out;
}
