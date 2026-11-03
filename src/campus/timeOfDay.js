// The campus follows the visitor's local clock: night, dawn, day and sunset.
// Pure functions only, so they are easy to test and cheap to call every frame.

export const MODES = ['auto', 'day', 'sunset', 'night', 'dawn'];

// Key states, from the approved prototype.
export const KEYS = {
  night: { top: '#060a1a', hor: '#1b2a50', fog: '#121a33', sun: '#9fb4ff', sunIntensity: 0.28, hemiIntensity: 0.2, elevation: 32, azimuth: 40, windows: 1.6, dark: true },
  dawn: { top: '#5a78b8', hor: '#ffc7a1', fog: '#f0cdb6', sun: '#ffc08a', sunIntensity: 1.4, hemiIntensity: 0.4, elevation: 10, azimuth: -60, windows: 0.5, dark: false },
  day: { top: '#2fb3e3', hor: '#e4f5fb', fog: '#dcf0f8', sun: '#ffe9c7', sunIntensity: 2.4, hemiIntensity: 0.55, elevation: 38, azimuth: -35, windows: 0, dark: false },
  sunset: { top: '#45549a', hor: '#ffad74', fog: '#e7b291', sun: '#ff9257', sunIntensity: 1.6, hemiIntensity: 0.42, elevation: 8, azimuth: 60, windows: 0.7, dark: true },
};

const TIMELINE = [[0, 'night'], [4.75, 'night'], [6, 'dawn'], [7.5, 'day'], [16.5, 'day'], [18, 'sunset'], [19.5, 'night'], [24, 'night']];

export function phaseAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 4.75 || h >= 19.5) return 'night';
  if (h < 7) return 'dawn';
  if (h < 16.5) return 'day';
  return 'sunset';
}

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
// Mixes in linear light so sunrise colours do not go muddy.
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const srgb = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
export function mixHex(a, b, k) {
  const A = hex(a), B = hex(b);
  return toHex(A.map((x, i) => srgb(lin(x) + (lin(B[i]) - lin(x)) * k)));
}

function mix(a, b, k) {
  const out = {};
  for (const key of Object.keys(a)) {
    const va = a[key], vb = b[key];
    if (typeof va === 'number') out[key] = va + (vb - va) * k;
    else if (typeof va === 'boolean') out[key] = k < 0.5 ? va : vb;
    else out[key] = k === 0 ? va : k === 1 ? vb : mixHex(va, vb, k);
  }
  return out;
}

export function skyAt(hour) {
  const h = Math.min(24, Math.max(0, hour));
  for (let i = 0; i < TIMELINE.length - 1; i++) {
    const [h0, k0] = TIMELINE[i], [h1, k1] = TIMELINE[i + 1];
    if (h >= h0 && h <= h1) {
      const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
      return mix(KEYS[k0], KEYS[k1], t * t * (3 - 2 * t));
    }
  }
  return { ...KEYS.night };
}

export function skyFor(mode, hour) {
  return mode === 'auto' || !KEYS[mode] ? skyAt(hour) : { ...KEYS[mode] };
}

export function nextMode(mode) {
  const i = MODES.indexOf(mode);
  return MODES[(i + 1) % MODES.length];
}
