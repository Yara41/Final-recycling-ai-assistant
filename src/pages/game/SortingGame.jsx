import React from 'react';
import Campus from '../../campus/Campus.jsx';
import { SHOTS, layoutFor } from '../../campus/camera.js';
import { gameBins } from '../../campus/compose.js';
import { text } from '../../campus/text.js';
import { copy } from '../copy.js';
import { DEMO_UNI } from '../Home.jsx';
import { ITEMS, answer, initialState, isOver } from './rules.js';
import './game.css';

const NEXT_MS = 2300;
const TAG_MS = 1300;
const later = (ms) => performance.now() + ms;
const digits = (n, lang) => (lang === 'en' ? String(n) : String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]));

// Sort eight real items into the four bins standing in front of the campus.
// Drag the card onto a bin, or tap the bin's name.
export default function SortingGame({ lang, onAsk }) {
  const c = copy(lang).game;
  const t = text(lang);
  const bins = React.useMemo(() => gameBins(lang), [lang]);
  const [api, setApi] = React.useState(null);
  const [layout] = React.useState(() => layoutFor(window.innerWidth));
  const [game, setGame] = React.useState(initialState);
  const [shown, setShown] = React.useState(0); // the round whose card is on screen
  const [result, setResult] = React.useState(null); // { correct, rightBin, rule }
  const [fly, setFly] = React.useState(null); // where the card flies to
  const [tag, setTag] = React.useState(null); // { binId, good, until }
  const [drag, setDrag] = React.useState(null);
  const [hover, setHover] = React.useState(null);
  const stage = React.useRef(null);
  const drops = React.useRef({});
  const buttons = React.useRef({});
  const tagEl = React.useRef(null);

  // Where a bin is on screen: over the 3D bin when the live scene runs, otherwise over its button.
  const binPoint = React.useCallback((id) => {
    if (api) {
      const [x, y, z] = api.binTop(id);
      const s = api.project([x, y, z]);
      if (s.visible) return { x: s.x, y: s.y };
    }
    const b = buttons.current[id]?.getBoundingClientRect();
    return b ? { x: b.left + b.width / 2, y: b.top } : null;
  }, [api]);

  // Drop zones and the result tag follow the camera, so they are placed every frame.
  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const b of bins) {
        const el = drops.current[b.id]; const pt = binPoint(b.id);
        if (el && pt) el.style.transform = `translate(${pt.x.toFixed(1)}px, ${(pt.y + 20).toFixed(1)}px) translate(-50%, -50%)`;
      }
      const el = tagEl.current;
      if (el) {
        const pt = tag && performance.now() < tag.until ? binPoint(tag.binId) : null;
        el.style.visibility = pt ? 'visible' : 'hidden';
        if (pt) el.style.transform = `translate(${pt.x.toFixed(1)}px, ${(pt.y - 24).toFixed(1)}px) translate(-50%, -100%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bins, binPoint, tag]);

  const busy = result !== null;
  const over = isOver(game) && !busy;
  const current = ITEMS[shown];

  const choose = (binId) => {
    if (busy || isOver(game)) return;
    const r = answer(game, binId);
    setGame(r.state);
    setResult({ correct: r.correct, rightBin: r.rightBin, rule: current.rule[lang === 'en' ? 'en' : 'ar'] });
    setFly(binPoint(binId));
    setTag({ binId, good: r.correct, until: later(TAG_MS) });
    api?.lid(binId);
    setTimeout(() => { setResult(null); setFly(null); setShown((n) => n + 1); }, NEXT_MS);
  };

  const again = () => { setGame(initialState()); setShown(0); setResult(null); setFly(null); setTag(null); };

  // Drag the card onto a bin.
  const nearestBin = (x, y) => {
    let best = null, bd = Infinity;
    for (const b of bins) { const pt = binPoint(b.id); if (!pt) continue; const d = Math.hypot(pt.x - x, pt.y + 20 - y); if (d < bd) { bd = d; best = b.id; } }
    return bd < Math.max(90, window.innerWidth * 0.12) ? best : null;
  };
  const onDown = (e) => { if (busy) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ x: e.clientX, y: e.clientY }); };
  const onMove = (e) => { if (!drag) return; setDrag({ x: e.clientX, y: e.clientY }); setHover(nearestBin(e.clientX, e.clientY)); };
  const onUp = (e) => {
    if (!drag) return;
    const target = nearestBin(e.clientX, e.clientY);
    setDrag(null); setHover(null);
    if (target) choose(target);
  };

  const cardStyle = fly
    ? { left: `${fly.x}px`, top: `${fly.y}px`, transform: 'translate(-50%, -50%) scale(.15) rotate(25deg)', opacity: 0 }
    : drag ? { left: `${drag.x}px`, top: `${drag.y}px`, transition: 'none' } : undefined;
  const binName = (id) => bins.find((b) => b.id === id)?.label ?? id;

  return (
    <section className="game" data-round={shown} ref={stage} aria-label={c.title}>
      <div className="game-campus">
        <Campus universityId={DEMO_UNI} lang={lang} mode="game" bins="game" shot={SHOTS[layout].game} onApi={setApi} />
      </div>
      <div className="game-drops" aria-hidden="true">
        {bins.map((b) => <span key={b.id} className={`game-drop ${hover === b.id ? 'on' : ''}`} data-bin={b.id} ref={(el) => { drops.current[b.id] = el; }} />)}
        <span ref={tagEl} className={`game-tag ${tag?.good ? 'good' : 'bad'}`} style={{ visibility: 'hidden' }}>{tag?.good ? '+10' : t.notHere}</span>
      </div>

      {!over && (
        <div className="game-hud">
          <span>{c.round(digits(Math.min(shown, ITEMS.length - 1) + 1, lang))}</span>
          <span>{c.score} <b>{digits(game.score, lang)}</b></span>
        </div>
      )}

      {!over && current && (
        <div className={`game-item ${drag ? 'dragging' : ''}`} style={cardStyle} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
          <img src={current.image} alt="" draggable="false" />
          <b>{current.name[lang === 'en' ? 'en' : 'ar']}</b>
        </div>
      )}

      <div className={`game-result ${result ? (result.correct ? 'ok' : 'no') : ''}`} role="status" aria-live="polite">
        {result && (
          <>
            <b>{result.correct ? c.right : c.wrong(binName(result.rightBin))}</b>
            {!result.correct && <span>{result.rule}</span>}
          </>
        )}
      </div>

      {!over && (
        <div className="game-bins" dir="ltr">
          {bins.map((b) => (
            <button key={b.id} type="button" style={{ background: b.color }} disabled={busy} ref={(el) => { buttons.current[b.id] = el; }} onClick={() => choose(b.id)}>{b.label}</button>
          ))}
        </div>
      )}

      {over && (
        <div className="game-end">
          <h2>{c.endTitle(digits(game.right, lang))}</h2>
          <p>{c.endText}</p>
          <div className="game-end-row">
            <button type="button" className="btn btn-primary" onClick={again}>{c.again}</button>
            <button type="button" className="btn btn-ghost" onClick={onAsk}>{c.ask}</button>
          </div>
        </div>
      )}
    </section>
  );
}
