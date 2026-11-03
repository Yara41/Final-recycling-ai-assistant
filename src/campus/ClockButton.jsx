import React from 'react';
import { useSky } from './useSky.js';

const LABEL = {
  ar: { auto: 'تلقائي', day: 'نهار', sunset: 'مغرب', night: 'ليل', dawn: 'فجر', title: 'وقت المشهد' },
  en: { auto: 'auto', day: 'day', sunset: 'sunset', night: 'night', dawn: 'dawn', title: 'Scene time' },
};
const ICON = {
  day: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  night: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
  sunset: <path d="M17 18a5 5 0 00-10 0M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4-4-4 4" />,
  dawn: <path d="M17 18a5 5 0 00-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4" />,
};

// Cycles the scene time: auto (the visitor's clock), day, sunset, night, dawn.
export default function ClockButton({ lang = 'ar' }) {
  const { mode, phase, cycle } = useSky();
  const t = LABEL[lang === 'en' ? 'en' : 'ar'];
  return (
    <button type="button" className="clock-btn" onClick={cycle} aria-label={`${t.title}: ${t[mode]}`} title={`${t.title}: ${t[mode]}`} data-mode={mode}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{ICON[phase]}</svg>
      <span className="clock-text">{t[mode]}</span>
    </button>
  );
}
