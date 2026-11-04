// Bins with their names, lamps and benches.
import * as THREE from 'three';
import { canvasTexture, shadowy } from './materials.js';

export const BIN_GAP = 1.05;

function labelTexture(label) {
  return canvasTexture((x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#13284a'; x.textAlign = 'center'; x.direction = 'rtl';
    let size = 64;
    do { x.font = `700 ${size}px "IBM Plex Sans Arabic", "Segoe UI", sans-serif`; size -= 4; } while (x.measureText(label).width > w - 40 && size > 24);
    x.fillText(label, w / 2, h / 2 + size * 0.35);
  }, 512, 256);
}

// bins: [{ id, color, label }]. full: the second bin overflows with an open lid.
// Returns { group, items: Map(id → { group, lid }) }.
export function binSet(bins, mats, { full = false } = {}) {
  const group = new THREE.Group();
  const items = new Map();
  bins.forEach((bin, i) => {
    const b = new THREE.Group();
    b.position.x = (i - (bins.length - 1) / 2) * BIN_GAP;
    const body = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.8), mats.M(bin.color, 0.55))); body.position.y = 0.58; b.add(body);
    const lid = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.9), mats.M(bin.color, 0.45))); lid.position.y = 1.2; b.add(lid);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.33), mats.M('#ffffff', 0.6, { map: labelTexture(bin.label) })); label.position.set(0, 0.72, 0.41); b.add(label);
    if (full && i === 1) {
      lid.rotation.x = -0.9; lid.position.set(0, 1.45, -0.45);
      for (let k = 0; k < 9; k++) {
        const s = shadowy(new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + mats.rnd() * 0.12), mats.M(['#d9d2c3', '#9fd8ff', '#c9a36b', '#e8e8e8'][k % 4], 0.7)));
        s.position.set((mats.rnd() - 0.5) * 0.8, 1.25 + mats.rnd() * 0.35, (mats.rnd() - 0.5) * 0.6); b.add(s);
      }
    }
    group.add(b);
    items.set(bin.id, { group: b, lid, body });
  });
  return { group, items };
}

export function lamp(x, z, mats) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 8), mats.M('#2c2f33', 0.6)); pole.position.set(x, 1.6, z); g.add(pole);
  const head = mats.M('#fff3d6', 0.5, { emissive: '#ffcf7a', emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), head); bulb.position.set(x, 3.3, z); g.add(bulb);
  const light = new THREE.PointLight('#ffcf7a', 0, 14, 2); light.position.set(x, 3.1, z); g.add(light);
  return { group: g, head, light };
}

export function bench(x, z, mats) {
  const g = new THREE.Group();
  const seat = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.6), mats.M('#8a6a4a', 0.8))); seat.position.set(x, 0.55, z); g.add(seat);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.4), mats.M('#d4c5a8')); base.position.set(x, 0.25, z); g.add(base);
  return g;
}
