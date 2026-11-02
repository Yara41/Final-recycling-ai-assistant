// Turns a campus snapshot into a deterministic, non-overlapping layout for the 3D scene.
// Everything sits on a grid of CELL-sized squares: one building per faculty, one kiosk
// (bin station or drop-off point) per location. Real coordinates decide where things go
// when they exist; locations without coordinates are placed on a ring around the centre.

export const CELL = 4;
const BUILDING = 2.6;
const KIOSK = 1;
const PALETTE = ['#ffffff', '#f3fbf6', '#eef7ff', '#fff8ec', '#f6f1ff', '#effaf0'];

const facultyOf = (l) => l.faculty || 'Campus';

// Projects lat/lng to metres around the mean, then scales so the spread is ~radius cells.
function project(located, radius) {
  if (!located.length) return new Map();
  const mLat = located.reduce((s, l) => s + l.lat, 0) / located.length;
  const mLng = located.reduce((s, l) => s + l.lng, 0) / located.length;
  const cos = Math.cos((mLat * Math.PI) / 180);
  const raw = located.map((l) => [l.id, (l.lng - mLng) * cos * 111320, -(l.lat - mLat) * 110540]);
  const spread = Math.max(...raw.map(([, x, z]) => Math.max(Math.abs(x), Math.abs(z))), 1e-9);
  return new Map(raw.map(([id, x, z]) => [id, [(x / spread) * radius, (z / spread) * radius]]));
}

// Cells ordered by distance from (cx, cz); ties broken by fixed order so results are deterministic.
function nearestFree(taken, cx, cz) {
  const ox = Math.round(cx);
  const oz = Math.round(cz);
  for (let r = 0; r < 200; r++) {
    const ring = [];
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const gx = ox + i;
        const gz = oz + j;
        if (!taken.has(`${gx},${gz}`)) ring.push([gx, gz, (gx - cx) ** 2 + (gz - cz) ** 2]);
      }
    }
    if (ring.length) {
      ring.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
      const [gx, gz] = ring[0];
      taken.add(`${gx},${gz}`);
      return [gx, gz];
    }
  }
  throw new Error('campus grid is full');
}

export function layoutCampus(snapshot) {
  const locations = [...(snapshot?.locations ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!locations.length) return { size: 20, buildings: [], kiosks: [] };

  const radius = Math.max(2, Math.ceil(Math.sqrt(locations.length)));
  const hasCoords = (l) => Number.isFinite(l.lat) && Number.isFinite(l.lng);
  const projected = project(locations.filter(hasCoords), radius);
  const missing = locations.filter((l) => !hasCoords(l));
  missing.forEach((l, i) => {
    const a = (i / missing.length) * Math.PI * 2;
    projected.set(l.id, [Math.cos(a) * (radius + 2), Math.sin(a) * (radius + 2)]);
  });

  const groups = new Map();
  for (const l of locations) {
    const f = facultyOf(l);
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(l);
  }
  const faculties = [...groups.keys()].sort();

  const taken = new Set();
  const buildings = faculties.map((faculty, i) => {
    const members = groups.get(faculty);
    const cx = members.reduce((s, l) => s + projected.get(l.id)[0], 0) / members.length;
    const cz = members.reduce((s, l) => s + projected.get(l.id)[1], 0) / members.length;
    const [gx, gz] = nearestFree(taken, cx, cz);
    return {
      id: `b-${faculty}`,
      faculty,
      x: gx * CELL,
      z: gz * CELL,
      w: BUILDING,
      d: BUILDING,
      h: 2 + Math.min(4, members.length),
      color: PALETTE[i % PALETTE.length],
    };
  });
  const byFaculty = new Map(buildings.map((b) => [b.faculty, b]));

  const kiosks = locations.map((l) => {
    const [px, pz] = projected.get(l.id);
    const [gx, gz] = nearestFree(taken, px, pz);
    return { id: `k-${l.id}`, locationId: l.id, kind: l.kind, x: gx * CELL, z: gz * CELL, w: KIOSK, d: KIOSK, buildingId: byFaculty.get(facultyOf(l))?.id ?? null };
  });

  const extent = Math.max(...[...buildings, ...kiosks].map((o) => Math.max(Math.abs(o.x), Math.abs(o.z))));
  return { size: Math.max(20, extent * 2 + 8), buildings, kiosks };
}
