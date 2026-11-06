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
// Scroll progress in screens (0..4).
const progress = () => Math.min(4, Math.max(0, window.scrollY / window.innerHeight));

// The landing page: five screens, each one idea, while the camera moves over the demo campus.
export default function Home({ lang, onStart, onPlay }) {
  const c = copy(lang).home;
  const t = text(lang);
  const [screen, setScreen] = React.useState(0);
  const [api, setApi] = React.useState(null);
  const [layout, setLayout] = React.useState(() => layoutFor(window.innerWidth));
  const plus = React.useRef(null);
  const warn = React.useRef(null);
  const card = React.useRef(null);
  const result = React.useRef(null);
  const layoutRef = React.useRef(layout);
  React.useEffect(() => { layoutRef.current = layout; }, [layout]);

  React.useEffect(() => {
    const onResize = () => setLayout(layoutFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    // Each swipe lands on one screen (CSS scroll snap, home page only).
    document.documentElement.classList.add('snap-home');
    return () => { window.removeEventListener('resize', onResize); document.documentElement.classList.remove('snap-home'); };
  }, []);

  // The camera reads the scroll position every frame; the scene eases toward it (one ease, no lag build-up).
  const track = React.useCallback(() => shotAt(SHOTS[layoutRef.current].home, progress()), []);

  // One loop places the cards and tags and drives the bottle and the report bin. No React render per frame.
  React.useEffect(() => {
    let raf = 0, last = -1;
    const place = (el, at, show) => {
      if (!el) return;
      if (!api || !show) { el.style.visibility = 'hidden'; return; }
      const s = api.project(at);
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.visibility = s.visible ? 'visible' : 'hidden';
    };
    const tick = () => {
      const p = progress();
      const n = Math.round(p);
      if (n !== last) { last = n; setScreen(n); }
      const snap = clamp01((near(p, 1) - 0.35) / 0.65);
      if (card.current) {
        card.current.style.opacity = snap.toFixed(3);
        card.current.style.visibility = snap > 0 ? 'visible' : 'hidden';
        card.current.style.transform = `translate(-50%, -50%) scale(${(0.92 + snap * 0.08).toFixed(3)})`;
      }
      if (result.current) result.current.style.opacity = clamp01((p - 0.85) / 0.15).toFixed(3);
      if (api) {
        const ids = api.binIds();
        const bin = ids.includes('plastic') ? 'plastic' : ids[0];
        const f = clamp01((p - 1.3) / 0.5);
        api.flight(bin, p > 1.25 && p < 2.5 && f < 1 ? f : null, layoutRef.current === 'phone' ? [2.5, 3.5, 9] : [4, 3.5, 9]);
        api.setReport(p > 2.5);
        const top = api.binTop(bin);
        place(plus.current, [top[0], top[1] + 1.3, top[2]], p > 1.8 && p < 2.45);
        place(warn.current, api.reportTop(), near(p, 3) > 0.5);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [api]);

  // Numbers such as +10 keep their order inside Arabic text.
  const title = (tt, level) => React.createElement(level === 1 ? 'h1' : 'h2', null, tt[0], <em dir={/^[+\d]/.test(tt[1]) ? 'ltr' : undefined}>{tt[1]}</em>, tt[2]);

  return (
    <main className="home" data-screen={screen}>
      <div className="home-campus">
        <Campus universityId={DEMO_UNI} lang={lang} track={track} onApi={setApi} />
      </div>
      <div className="home-scrim" aria-hidden="true" />
      <div className="story-tags" aria-hidden="true">
        <span ref={plus} className="story-tag plus" style={{ visibility: 'hidden' }}>+10</span>
        <span ref={warn} className="story-tag warn" style={{ visibility: 'hidden' }}>{t.reportSent}</span>
      </div>
      <div ref={card} className="snap-card" aria-hidden="true" style={{ opacity: 0, visibility: 'hidden' }}>
        <img src="/items/bottle.webp" alt="" />
        <i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" />
        <span className="scan" />
        <span ref={result} className="result" style={{ opacity: 0 }}><b />{c.scan}</span>
      </div>
      <nav className="rail" aria-hidden="true">{c.screens.map((s, i) => <i key={s.kicker} className={i === screen ? 'on' : undefined} />)}</nav>

      {c.screens.map((s, i) => (
        <section className={`screen${i === screen ? ' active' : ''}`} data-screen={i} key={s.kicker}>
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
