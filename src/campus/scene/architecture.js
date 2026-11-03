// Limestone halls with a ground-floor arcade, a cornice and windows that light up at night.
import * as THREE from 'three';
import { shadowy } from './materials.js';

function arcadeShape(w, h, n, archW, archH) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + (w / n) * (i + 0.5), r = archW / 2, p = new THREE.Path();
    p.moveTo(cx - r, 0); p.lineTo(cx - r, archH - r); p.absarc(cx, archH - r, r, Math.PI, 0, true); p.lineTo(cx + r, 0); p.lineTo(cx - r, 0);
    s.holes.push(p);
  }
  return s;
}

export { arcadeShape };

// spec: { x, z, ry, w, d, h, arches }. Returns { group, windows (material), roof (world Vector3) }.
export function building(spec, mats) {
  const { x, z, ry = 0, w, d, h, arches = 5 } = spec;
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  const main = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.stoneFor(w, h))); main.position.y = h / 2; g.add(main);
  const cornice = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5), mats.M('#e2d1b0'))); cornice.position.y = h + 0.1; g.add(cornice);
  const arcH = 3.2;
  const arcade = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(arcadeShape(w, arcH, arches, (w / arches) * 0.62, arcH * 0.82), { depth: 0.6, bevelEnabled: false }), mats.stoneFor(w, arcH)));
  arcade.position.set(0, 0, d / 2 + 1.2); g.add(arcade);
  const roof = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 1.8), mats.M('#dfcdab'))); roof.position.set(0, arcH + 0.15, d / 2 + 0.9); g.add(roof);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, arcH), mats.M('#6d6252', 1)); back.position.set(0, arcH / 2, d / 2 + 0.02); g.add(back);
  const windows = mats.M('#3d5566', 0.25, { metalness: 0.4, emissive: '#ffc983', emissiveIntensity: 0 });
  const floors = Math.max(1, Math.floor((h - arcH - 0.6) / 2.2)), cols = Math.max(2, Math.floor(w / 2.4));
  const wg = new THREE.BoxGeometry(1, 1.4, 0.12);
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    const m = new THREE.Mesh(wg, windows); m.position.set(-w / 2 + (w / cols) * (c + 0.5), arcH + 1.4 + f * 2.2, d / 2 + 0.03); g.add(m);
  }
  g.updateMatrixWorld(true);
  const roofTop = new THREE.Vector3(0, h + 1.2, d / 2).applyMatrix4(g.matrixWorld);
  return { group: g, windows, roof: roofTop };
}
