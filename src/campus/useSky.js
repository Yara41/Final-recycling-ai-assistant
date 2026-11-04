// One shared scene time for the whole site. The page theme follows it (html[data-phase] and .dark),
// so text stays readable over the sky in every phase.
import React from 'react';
import { MODES, nextMode, phaseAt, skyFor } from './timeOfDay.js';
import { readMode, writeMode } from './skyMode.js';

const hourNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
const SkyContext = React.createContext(null);

// ?sky=night (etc.) fixes the scene time for one visit, e.g. to render the still images.
function initialMode() {
  try {
    const q = new URLSearchParams(window.location.search).get('sky');
    if (MODES.includes(q)) return q;
  } catch { /* no window */ }
  return readMode();
}

function phaseOf(mode, hour) { return mode === 'auto' ? phaseAt(hour) : mode; }

export function SkyProvider({ children }) {
  const [mode, setMode] = React.useState(initialMode);
  const [hour, setHour] = React.useState(hourNow);

  React.useEffect(() => {
    if (mode !== 'auto') return undefined;
    const id = setInterval(() => setHour(hourNow()), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const value = React.useMemo(() => {
    const sky = skyFor(mode, hour);
    return {
      mode,
      phase: phaseOf(mode, hour),
      sky,
      cycle() { setMode((m) => { const n = nextMode(m); writeMode(n); return n; }); setHour(hourNow()); },
    };
  }, [mode, hour]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.phase = value.phase;
    root.classList.toggle('dark', value.sky.dark);
  }, [value]);

  return React.createElement(SkyContext.Provider, { value }, children);
}

export function useSky() {
  const v = React.useContext(SkyContext);
  if (!v) throw new Error('useSky must be used inside <SkyProvider>');
  return v;
}
