// Cypress and olive trees, the trees of a Jordanian campus. Each returns { object, sway }.
import * as THREE from 'three';
import { shadowy } from './materials.js';

const CYPRESS = [[0, 0], [0.5, 0.4], [0.7, 1.6], [0.62, 3.2], [0.42, 4.6], [0.14, 5.6], [0, 5.9]].map(([a, b]) => new THREE.Vector2(a, b));

export function trees(mats) {
  const leaf = mats.M('#2f5236', 0.95), oliveLeaf = mats.M('#8fa47c', 0.95), bark = mats.M('#7a6a58', 1);
  const cypressGeo = new THREE.LatheGeometry(CYPRESS, 14);
  return {
    cypress(x, z, s = 1) {
      const m = shadowy(new THREE.Mesh(cypressGeo, leaf)); m.position.set(x, 0.3, z); m.scale.setScalar(s);
      return { object: m, sway: { object: m, phase: mats.rnd() * 6, amount: 0.015 } };
    },
    olive(x, z, s = 1) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
      const trunk = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 1.6, 7), bark)); trunk.position.y = 0.8; trunk.rotation.z = 0.12; g.add(trunk);
      [[0, 2, 0, 1], [0.7, 1.8, 0.2, 0.7], [-0.6, 1.9, -0.2, 0.75], [0.1, 2.5, 0.3, 0.6]].forEach(([a, b, c, r]) => {
        const m = shadowy(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), oliveLeaf)); m.position.set(a, b, c); g.add(m);
      });
      return { object: g, sway: { object: g, phase: mats.rnd() * 6, amount: 0.02 } };
    },
  };
}
