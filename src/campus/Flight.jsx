import React from 'react';

// A recycled item flying from the chat into its building, then "+N" rising above it.
// With reduced motion only the "+N" appears. Points are {x, y} in stage pixels.
export default function Flight({ from, to, points, still = false, onDone }) {
  const bottle = React.useRef(null);

  React.useEffect(() => {
    const el = bottle.current;
    let anim = null;
    if (el && !still && el.animate) {
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 90 };
      const at = (p, s = 1, r = 0) => ({ transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) rotate(${r}deg) scale(${s})` });
      anim = el.animate([at(from, 1, 0), at(mid, 1.15, 200), at(to, 0.5, 400)], { duration: 700, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
    }
    const done = setTimeout(() => onDone?.(), still ? 1800 : 2300);
    return () => { clearTimeout(done); anim?.cancel(); };
  }, [from, to, still, onDone]);

  return (
    <div className="flight" aria-hidden="true">
      {!still && (
        <svg ref={bottle} className="flight-bottle" width="26" height="34" viewBox="0 0 26 34">
          <rect x="9" y="1" width="8" height="5" rx="1.5" fill="#127a5c" />
          <path d="M8 6h10l3 6v18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V12z" fill="#9fd8ff" stroke="#127a5c" strokeWidth="1.5" />
          <rect x="5" y="16" width="16" height="7" fill="#c6f36b" />
        </svg>
      )}
      <span
        className={`flight-points ${still ? 'now' : ''}`}
        style={{ transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -100%)` }}
      >
        +{points}
      </span>
    </div>
  );
}
