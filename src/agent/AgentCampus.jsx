import React from 'react';
import Campus from '../campus/Campus.jsx';
import { SHOTS, layoutFor } from '../campus/camera.js';
import { effectsForCards } from '../campus/effects.js';
import { text } from '../campus/text.js';

const FLIGHT_MS = 900;
const PLUS_MS = 1600;
const REPORT_VIEW_MS = 6000;
const FROM = [3, 5, 11];

// The campus behind the agent chat. Each new batch of action cards plays once on it:
// the item flies into its bin with +N, a report turns the camera to the full bin and tags it.
export default function AgentCampus({ universityId, lang, actions, replay, onReplayEnd }) {
  const t = text(lang);
  const [api, setApi] = React.useState(null);
  const [layout, setLayout] = React.useState(() => layoutFor(window.innerWidth));
  const [reportView, setReportView] = React.useState(false);
  const plus = React.useRef(null);
  const warn = React.useRef(null);
  const tags = React.useRef({ plus: null, warn: false });
  const played = React.useRef(new Set());

  React.useEffect(() => {
    const on = () => setLayout(layoutFor(window.innerWidth));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  React.useEffect(() => {
    if (!api || !actions?.id || played.current.has(actions.id)) return undefined;
    played.current.add(actions.id);
    const fx = effectsForCards(actions.cards, { plazaBins: api.binIds().map((id) => ({ id })) });
    const timers = [];
    let raf = 0;
    for (const e of fx) {
      if (e.type === 'flight') {
        const start = performance.now();
        const step = (now) => {
          const k = (now - start) / FLIGHT_MS;
          if (k < 1) { api.flight(e.binId, k, FROM); raf = requestAnimationFrame(step); return; }
          api.flight(e.binId, null);
          api.lid(e.binId);
          if (plus.current) plus.current.textContent = `+${e.points}`;
          tags.current.plus = { binId: e.binId, until: performance.now() + PLUS_MS };
        };
        raf = requestAnimationFrame(step);
      } else if (e.type === 'report') {
        api.setReport(true);
        setReportView(true);
        tags.current.warn = true;
        timers.push(setTimeout(() => { setReportView(false); tags.current.warn = false; }, REPORT_VIEW_MS));
      } else if (e.type === 'resolved') {
        api.setReport(false);
        tags.current.warn = false;
      }
    }
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [api, actions]);

  // Tags follow the camera, so they are placed every frame.
  React.useEffect(() => {
    if (!api) return undefined;
    let raf = 0;
    const place = (el, at, show) => {
      if (!el) return;
      const s = api.project(at);
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.visibility = show && s.visible ? 'visible' : 'hidden';
    };
    const tick = () => {
      const p = tags.current.plus;
      const top = api.binTop(p?.binId ?? api.binIds()[0]);
      place(plus.current, [top[0], top[1] + 1.3, top[2]], Boolean(p && performance.now() < p.until));
      place(warn.current, api.reportTop(), tags.current.warn);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [api]);

  const shot = reportView ? SHOTS[layout].report : SHOTS[layout].agent;
  return (
    <Campus mode="agent" universityId={universityId} lang={lang} shot={shot} onApi={setApi} replay={replay} onReplayEnd={onReplayEnd}>
      <div className="agent-tags" aria-hidden="true">
        <span ref={plus} className="agent-tag plus" style={{ visibility: 'hidden' }}>+10</span>
        <span ref={warn} className="agent-tag warn" style={{ visibility: 'hidden' }}>{t.reportSent}</span>
      </div>
    </Campus>
  );
}
