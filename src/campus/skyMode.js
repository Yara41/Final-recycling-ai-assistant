// Remembers the visitor's chosen scene time. Storage can be blocked (private mode), so every access is guarded.
import { MODES } from './timeOfDay.js';

const KEY = 'ecowaste-sky-mode';

export function readMode() {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return MODES.includes(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeMode(mode) {
  try { globalThis.localStorage?.setItem(KEY, mode); } catch { /* storage blocked: keep the mode for this visit only */ }
}
