import React from 'react';
import { text } from './text.js';

// A pre-rendered picture of the campus at the current time of day, for weak devices and reduced motion.
export default function CampusStill({ phase, layout, lang }) {
  return <img className="campus-still" src={`/campus/${phase}-${layout}.webp`} alt={text(lang).stillAlt(phase)} decoding="async" />;
}
