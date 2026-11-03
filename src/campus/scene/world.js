// Builds the whole campus from a composition (see ../compose.js). Plain three.js, no React.
import * as THREE from 'three';
import { makeMaterials, shadowy } from './materials.js';
import { building } from './architecture.js';
import { trees } from './nature.js';
import { bench, binSet, lamp } from './furniture.js';

export const PLAZA_BINS_AT = new THREE.Vector3(0, 0, 3.5);
export const REPORT_BIN_AT = new THREE.Vector3(-12.4, 0, 1);

const LAWNS = [[-9, 6, 7, 5], [9, 6, 7, 5], [0, -4, 10, 3], [-17, 12, 6, 6], [17, 12, 6, 6]];
const CYPRESSES = [[-6, -9.5], [6, -9.5], [-13, -10], [13, -10], [-14.5, 10], [14.5, 10], [-28, -8], [28, -8], [-4, -27], [4, -27], [-10, -28], [10, -28], [-30, 6], [30, 6]];
const OLIVES = [[-9, 6], [9, 6], [-3, -4], [3.5, -4], [-17, 12], [17, 12]];
const LAMPS = [[-5, 2], [5, 2], [-12, -6], [12, -6], [-12, 9], [12, 9]];

// composition: { buildings, plazaBins }. Returns handles the scene animates.
export function buildWorld(composition) {
  const mats = makeMaterials();
  const root = new THREE.Group();
  const windows = [], lampHeads = [], lampLights = [], sway = [];

  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 72), mats.M('#d8cbb2', 0.95, { map: mats.pave }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  for (const [x, z, w, d] of LAWNS) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.2, d + 0.3), mats.M('#d4c5a8')); kerb.position.set(x, 0.08, z); kerb.receiveShadow = true; root.add(kerb);
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), mats.grassFor(w, d)); lawn.position.set(x, 0.13, z); lawn.receiveShadow = true; root.add(lawn);
  }
  const roofs = new Map();
  for (const b of composition.buildings) {
    const hall = building(b, mats);
    root.add(hall.group); windows.push(hall.windows); roofs.set(b.id, hall.roof);
  }
  const t = trees(mats);
  CYPRESSES.forEach(([x, z], i) => { const c = t.cypress(x, z, 0.85 + (i % 3) * 0.12); root.add(c.object); sway.push(c.sway); });
  OLIVES.forEach(([x, z]) => { const o = t.olive(x, z, 1.15); root.add(o.object); sway.push(o.sway); });
  for (const [x, z] of LAMPS) { const l = lamp(x, z, mats); root.add(l.group); lampHeads.push(l.head); lampLights.push(l.light); }
  root.add(bench(-9, 2.6, mats), bench(9, 2.6, mats));

  const plaza = binSet(composition.plazaBins, mats);
  plaza.group.position.copy(PLAZA_BINS_AT); root.add(plaza.group);
  const report = binSet(composition.plazaBins, mats, { full: true });
  report.group.position.copy(REPORT_BIN_AT); report.group.rotation.y = Math.PI / 2; report.group.visible = false; root.add(report.group);

  const bottle = shadowy(new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.14, 0.05], [0.14, 0.42], [0.06, 0.55], [0.05, 0.66], [0, 0.66]].map(([a, b]) => new THREE.Vector2(a, b)), 16),
    mats.M('#a9dcff', 0.1, { metalness: 0.1, transparent: true, opacity: 0.85 }),
  ));
  bottle.scale.setScalar(1.3); bottle.visible = false; root.add(bottle);

  root.updateMatrixWorld(true);
  return { root, windows, lampHeads, lampLights, sway, plaza, report, bottle, roofs };
}

// World position just above a plaza bin.
export function binTop(world, binId) {
  const item = world.plaza.items.get(binId) ?? world.plaza.items.values().next().value;
  if (!item) return [0, 1.4, PLAZA_BINS_AT.z];
  const v = new THREE.Vector3(); item.group.getWorldPosition(v);
  return [v.x, 1.4, v.z];
}

// Where the overflowing bin's tag sits.
export function reportTop(world) {
  const second = [...world.report.items.values()][1] ?? world.report.items.values().next().value;
  const v = new THREE.Vector3(); (second?.group ?? world.report.group).getWorldPosition(v);
  return [v.x, 2.5, v.z];
}
