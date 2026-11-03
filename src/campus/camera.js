// Camera shots over the campus (from the approved prototypes) and smooth movement between them.
export const layoutFor = (width) => (width <= 640 ? 'phone' : 'wide');

export const SHOTS = {
  phone: {
    home: [
      { p: [4, 22, 40], l: [0, 1, -10] },
      { p: [3, 4.2, 15], l: [0, 1.8, 3] },
      { p: [4, 3.6, 12], l: [0.5, 1.4, 3.2] },
      { p: [-7, 3.1, 3.6], l: [-12.4, 1.1, 0.9] },
      { p: [2, 2.4, 9], l: [0, 3.6, -12] },
    ],
    agent: { p: [5, 9, 22], l: [0, 0.5, 0] },
    report: { p: [-6.5, 4.5, 6], l: [-12.4, 0.6, 1.2] },
    game: { p: [0, 4.4, 14], l: [0, 2.4, 3.5] },
  },
  wide: {
    home: [
      { p: [-6, 18, 36], l: [-6, 2, -8] },
      { p: [6, 4, 13], l: [2, 1.8, 3] },
      { p: [7, 3, 9.5], l: [2.2, 1.6, 3.2] },
      { p: [-6.6, 2.8, -1.2], l: [-12.4, 1.2, 1.4] },
      { p: [-4, 2.4, 9], l: [-4, 3.6, -12] },
    ],
    agent: { p: [-3, 7.5, 19], l: [3.5, 1.2, 1] },
    report: { p: [-6.6, 2.8, -1.2], l: [-12.4, 1.2, 1.4] },
    game: { p: [0, 2.8, 9.5], l: [0, 1.5, 3.5] },
  },
};

const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// progress 0 is the first shot, 1 the second, and so on; eased within each segment.
export function shotAt(shots, progress) {
  const last = shots.length - 1;
  const t = Math.min(last, Math.max(0, progress));
  const i = Math.min(last - 1, Math.floor(t));
  if (i < 0) return shots[0];
  const f = t - i;
  const k = f * f * (3 - 2 * f);
  if (k === 0) return shots[i];
  if (k === 1) return shots[i + 1];
  return { p: lerp3(shots[i].p, shots[i + 1].p, k), l: lerp3(shots[i].l, shots[i + 1].l, k) };
}
