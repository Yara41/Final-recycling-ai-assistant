// Decides what the 3D campus shows for a university: which faculty sits in which hall,
// which bins stand in the plaza, and whether the overflowing bin appears. Pure and testable.
import { text } from './text.js';

// Six halls around a central plaza (from the approved prototype): main hall north, two wings,
// two corner halls, and a far hall behind the main one.
export const SLOTS = [
  { x: 0, z: -16, ry: 0, w: 22, d: 9, h: 9.5, arches: 7 },
  { x: -19, z: -2, ry: Math.PI / 2, w: 16, d: 8, h: 8, arches: 5 },
  { x: 19, z: -3, ry: -Math.PI / 2, w: 16, d: 8, h: 11, arches: 5 },
  { x: -24, z: -26, ry: 0.5, w: 12, d: 8, h: 7, arches: 4 },
  { x: 24, z: -26, ry: -0.5, w: 12, d: 8, h: 8.5, arches: 4 },
  { x: 0, z: -40, ry: 0, w: 18, d: 8, h: 8, arches: 6 },
];

const GAME_COLORS = [['general', '#4b5563'], ['paper', '#2f8f4e'], ['plastic', '#1f6fd1'], ['metal', '#d9a514']];
export const GAME_BINS = GAME_COLORS.map(([id, color]) => ({ id, color }));
export const gameBins = (lang) => GAME_COLORS.map(([id, color]) => ({ id, color, label: text(lang).bins[id] }));

const DROP_ONLY = new Set(['glass', 'hazardous']);

export function composeCampus(snapshot, lang = 'ar') {
  const en = lang === 'en';
  const faculties = [...(snapshot?.faculties ?? [])]
    .filter((f) => f.faculty && f.faculty !== 'Campus')
    .sort((a, b) => (Number(b.points_30d) || 0) - (Number(a.points_30d) || 0) || String(a.faculty).localeCompare(String(b.faculty)));

  const buildings = SLOTS.map((s, slot) => {
    const f = faculties[slot];
    return { id: `b-${slot}`, slot, faculty: f?.faculty ?? null, label: f?.faculty ?? null, ...s };
  });

  const usable = (snapshot?.university?.bins ?? []).filter((b) => (b.accepts ?? []).some((a) => !DROP_ONLY.has(a)));
  const plazaBins = usable.length
    ? usable.slice(0, 4).map((b) => ({ id: b.id, color: b.color, label: (en ? b.label_en : b.label_ar) || b.id }))
    : gameBins(lang);

  const report = (snapshot?.open_reports ?? [])[0];
  return { buildings, plazaBins, reportBin: report ? { locationId: report.location_id ?? null } : null };
}
