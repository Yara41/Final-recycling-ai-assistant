import React from 'react';

// Illustrated isometric campus in SVG, drawn from the same layout as the 3D scene.
// Used on devices without WebGL2, with reduced motion, and while the 3D scene loads.
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const UNIT = 6; // svg units per campus metre
const LIFT = 7; // svg units per metre of height

const iso = (x, z, y = 0) => [(x - z) * COS * UNIT, (x + z) * SIN * UNIT - y * LIFT];
const pts = (list) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

function Box({ x, z, w, d, h, className, top, left, right }) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  return (
    <g className={className}>
      <polygon points={pts([iso(x0, z1, 0), iso(x1, z1, 0), iso(x1, z1, h), iso(x0, z1, h)])} fill={left} />
      <polygon points={pts([iso(x1, z0, 0), iso(x1, z1, 0), iso(x1, z1, h), iso(x1, z0, h)])} fill={right} />
      <polygon points={pts([iso(x0, z0, h), iso(x1, z0, h), iso(x1, z1, h), iso(x0, z1, h)])} fill={top} />
    </g>
  );
}

// Deterministic spots around a building for its trees and litter.
function around(b, n, offset) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((i + offset) / Math.max(n, 1)) * Math.PI * 2 + offset;
    const r = b.w / 2 + 0.8 + (i % 2) * 0.5;
    return [b.x + Math.cos(a) * r, b.z + Math.sin(a) * r];
  });
}

export default function CampusFallback({ layout, growthByFaculty = {}, pins = [], emptyText }) {
  if (!layout) return <div className="campus-fallback loading" aria-hidden="true" />;
  if (!layout.buildings.length) {
    return (
      <div className="campus-fallback empty">
        <p>{emptyText}</p>
      </div>
    );
  }

  const half = layout.size / 2;
  const corners = [iso(-half, -half), iso(half, -half), iso(half, half), iso(-half, half)];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const pad = 40;
  const viewBox = `${Math.min(...xs) - pad} ${Math.min(...ys) - 70} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + 70 + pad}`;
  const warn = new Set(pins.filter((p) => p.kind === 'warn').map((p) => p.locationId));
  const good = new Set(pins.filter((p) => p.kind === 'good').map((p) => p.locationId));

  const items = [];
  for (const b of layout.buildings) {
    const g = growthByFaculty[b.faculty] ?? { trees: 0, treeScale: 1, litter: 0 };
    items.push({ key: b.id, depth: b.x + b.z, el: (
      <g className="building" data-faculty={b.faculty}>
        <Box x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} top="var(--campus-roof)" left="var(--campus-wall-l)" right="var(--campus-wall-r)" />
        <title>{b.faculty}</title>
      </g>
    ) });
    around(b, g.trees, 0.35).forEach(([tx, tz], i) => {
      const [sx, sy] = iso(tx, tz);
      const s = g.treeScale;
      items.push({ key: `${b.id}-t${i}`, depth: tx + tz, el: (
        <g className="tree" transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${s})`}>
          <rect x="-1.5" y="-9" width="3" height="9" fill="var(--campus-trunk)" />
          <circle cx="0" cy="-14" r="8" fill="var(--campus-leaf)" />
        </g>
      ) });
    });
    around(b, g.litter, 1.9).forEach(([lx, lz], i) => {
      const [sx, sy] = iso(lx, lz);
      items.push({ key: `${b.id}-l${i}`, depth: lx + lz, el: (
        <g className="litter" transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`}>
          <ellipse cx="0" cy="0" rx="4" ry="2" fill="var(--campus-litter)" />
        </g>
      ) });
    });
  }
  for (const k of layout.kiosks) {
    const [px, py] = iso(k.x, k.z, 1.2);
    const pinKind = warn.has(k.locationId) ? 'warn' : good.has(k.locationId) ? 'good' : null;
    items.push({ key: k.id, depth: k.x + k.z, el: (
      <g className={`kiosk ${k.kind}`} data-location={k.locationId}>
        <Box x={k.x} z={k.z} w={k.w} d={k.d} h={1} top="var(--campus-kiosk-top)" left="var(--campus-kiosk-l)" right="var(--campus-kiosk-r)" />
        {pinKind && (
          <g className={`pin ${pinKind}`} transform={`translate(${px.toFixed(1)} ${(py - 14).toFixed(1)})`}>
            <path d="M0 12 C -7 2 -7 -8 0 -8 C 7 -8 7 2 0 12 Z" />
            <circle cx="0" cy="-2" r="2.6" fill="var(--card)" />
          </g>
        )}
      </g>
    ) });
  }
  items.sort((a, b) => a.depth - b.depth);

  return (
    <div className="campus-fallback">
      <svg viewBox={viewBox} role="img" aria-label={layout.buildings.map((b) => b.faculty).join(', ')}>
        <polygon className="ground" points={pts(corners)} />
        {items.map((it) => <React.Fragment key={it.key}>{it.el}</React.Fragment>)}
      </svg>
    </div>
  );
}
