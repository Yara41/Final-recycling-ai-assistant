// Decides whether this device gets the 3D campus or the illustrated fallback.
export function shouldUse3D({ webgl2, reducedMotion, cores }) {
  if (!webgl2 || reducedMotion) return false;
  return cores === undefined || cores === null || cores >= 4;
}

export function detectDevice() {
  let webgl2 = false;
  try {
    webgl2 = Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    webgl2 = false;
  }
  return {
    webgl2,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    cores: navigator.hardwareConcurrency,
  };
}
