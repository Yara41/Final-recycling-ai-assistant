import React from 'react';
import Campus from '../campus/Campus.jsx';
import { SHOTS, layoutFor, shotAt } from '../campus/camera.js';
import { text } from '../campus/text.js';
import { copy } from './copy.js';
import './pages.css';

export const DEMO_UNI = '00000000-0000-4000-8000-000000000001';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// How much screen n is in view: 1 when centred, 0 one screen away.
const near = (p, n) => clamp01(1 - Math.abs(p - n));

// The landing page: five screens, each one idea, while the camera moves over the demo campus.
export default function Home({ lang, onStart, onPlay }) {
  const c = copy(lang).home;
  const t = text(lang);
  const [p, setP] = React.useState(0);
  const [api, setApi] = React.useState(null);
  const [layout, setLayout] = React.useState(() => layoutFor(window.innerWidth));
  const plus = React.useRef(null);
  const warn = React.useRef(null);
  const reduce = React.useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);

  // Smoothed scroll progress in screens (0..4).
  React.useEffect(() => {
    let raf = 0, smooth = window.scrollY / window.innerHeight;
    const tick = () => {
      const target = Math.min(4, window.scrollY / window.innerHeight);
      smooth += (target - smooth) * (reduce || window.__snap ? 1 : 0.08);
      setP((old) => (Math.abs(old - smooth) > 0.001 ? Math.round(smooth * 1000) / 1000 : old));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onResize = () => setLayout(layoutFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [reduce]);

  const shot = React.useMemo(() => shotAt(SHOTS[layout].home, p), [layout, p]);
  const screen = Math.round(p);

  // Drive the scene: bottle flight on screen 3 and the report bin on screen 4.
  const pRef = React.useRef(p);
  React.useEffect(() => { pRef.current = p; }, [p]);
  React.useEffect(() => {
    if (!api) return;
    const ids = api.binIds();
    const bin = ids.includes('plastic') ? 'plastic' : ids[0];
    const from = layout === 'phone' ? [2.5, 3.5, 9] : [4, 3.5, 9];
    const f = clamp01((p - 1.3) / 0.5);
    api.flight(bin, p > 1.25 && p < 2.5 && f < 1 ? f : null, from);
    api.setReport(p > 2.5);
  }, [api, p, layout]);

  // The tags follow the camera, so they are placed every frame.
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
      const q = pRef.current;
      const ids = api.binIds();
      const top = api.binTop(ids.includes('plastic') ? 'plastic' : ids[0]);
      place(plus.current, [top[0], top[1] + 1.3, top[2]], q > 1.8 && q < 2.45);
      place(warn.current, api.reportTop(), near(q, 3) > 0.5);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [api]);

  const snap = clamp01((near(p, 1) - 0.35) / 0.65);
  // Numbers such as +10 keep their order inside Arabic text.
  const title = (tt, level) => React.createElement(level === 1 ? 'h1' : 'h2', null, tt[0], <em dir={/^[+\d]/.test(tt[1]) ? 'ltr' : undefined}>{tt[1]}</em>, tt[2]);

  return (
    <main className="home" data-screen={screen}>
      <div className="home-campus">
        <Campus universityId={DEMO_UNI} lang={lang} shot={shot} onApi={setApi} />
      </div>
      <div className="home-scrim" aria-hidden="true" />
      <div className="story-tags" aria-hidden="true">
        <span ref={plus} className="story-tag plus" style={{ visibility: 'hidden' }}>+10</span>
        <span ref={warn} className="story-tag warn" style={{ visibility: 'hidden' }}>{t.reportSent}</span>
      </div>
      <div className="snap-card" aria-hidden="true" style={{ opacity: snap, visibility: snap > 0 ? 'visible' : 'hidden', transform: `translate(-50%, -50%) scale(${0.92 + snap * 0.08})` }}>
        <img src="/items/bottle.webp" alt="" />
        <i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" />
        <span className="scan" />
        <span className="result" style={{ opacity: clamp01((p - 0.85) / 0.15) }}><b />{c.scan}</span>
      </div>
      <nav className="rail" aria-hidden="true">{c.screens.map((s, i) => <i key={s.kicker} className={i === screen ? 'on' : undefined} />)}</nav>

      {c.screens.map((s, i) => (
        <section className="screen" data-screen={i} key={s.kicker}>
          <div className="screen-text">
            <span className="kicker">{s.kicker}</span>
            {title(s.title, i === 0 ? 1 : 2)}
            {s.text && <p>{s.text}</p>}
            {s.cta && (
              <div className="screen-cta">
                <button type="button" className="btn btn-primary" onClick={onStart}>{s.cta[0]}</button>
                {s.cta[1] && <button type="button" className="btn btn-ghost" onClick={onPlay}>{s.cta[1]}</button>}
              </div>
            )}
            {s.hint && <span className="hint"><i />{s.hint}</span>}
          </div>
        </section>
      ))}
      <footer className="site-footer">{c.footer}</footer>
    </main>
  );
}
