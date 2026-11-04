// Procedural textures and materials for the limestone campus (no image downloads).
import * as THREE from 'three';

export function seeded(seed = 11) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function canvasTexture(draw, w = 512, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeMaterials() {
  const rnd = seeded(11);
  const stone = canvasTexture((x) => {
    x.fillStyle = '#e6d6b8'; x.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 8; r++) {
      let col = (r % 2) * -40;
      while (col < 512) {
        const w = 70 + rnd() * 70;
        x.globalAlpha = 0.35; x.fillStyle = `hsl(38,32%,${84 + rnd() * 10}%)`; x.fillRect(col, r * 64, w, 64); x.globalAlpha = 1;
        x.strokeStyle = 'rgba(120,100,70,.35)'; x.lineWidth = 2; x.strokeRect(col, r * 64, w, 64);
        col += w;
      }
    }
    for (let i = 0; i < 3500; i++) { x.fillStyle = `rgba(90,70,40,${rnd() * 0.08})`; x.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  });
  const pave = canvasTexture((x) => {
    x.fillStyle = '#d8cbb2'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = `hsl(38,26%,${76 + rnd() * 7}%)`; x.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); }
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(100,80,50,${rnd() * 0.06})`; x.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  });
  pave.repeat.set(12, 12);
  const grass = canvasTexture((x) => {
    x.fillStyle = '#7fa65c'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) { x.fillStyle = `hsl(${85 + rnd() * 20},${35 + rnd() * 15}%,${30 + rnd() * 20}%)`; x.fillRect(rnd() * 256, rnd() * 256, 1.5, 3); }
  }, 256, 256);

  const M = (color, roughness = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const stoneFor = (w, h) => { const t = stone.clone(); t.needsUpdate = true; t.repeat.set(w / 6, h / 4); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }); };
  const grassFor = (w, d) => { const t = grass.clone(); t.needsUpdate = true; t.repeat.set(w / 3, d / 3); return new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); };
  return { rnd, M, stoneFor, grassFor, pave };
}

export const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
