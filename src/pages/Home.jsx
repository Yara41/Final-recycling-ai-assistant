import React from 'react';
import Campus from '../campus/Campus.jsx';
import { copy } from './copy.js';
import './pages.css';

export const DEMO_UNI = '00000000-0000-4000-8000-000000000001';

// Landing page. Interim layout over the new copy; the scroll-driven campus story replaces it.
export default function Home({ lang, onStart, onPlay }) {
  const c = copy(lang).home;
  const [first, ...rest] = c.screens;
  const title = (t, level = 2) => React.createElement(`h${level}`, null, t[0], <em>{t[1]}</em>, t[2]);
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-text">
          <span className="kicker">{first.kicker}</span>
          {title(first.title, 1)}
          <p className="lede">{first.text}</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={onStart}>{first.cta[0]}</button>
          </div>
        </div>
        <figure className="hero-campus">
          <Campus mode="showcase" universityId={DEMO_UNI} lang={lang} />
        </figure>
      </section>
      {rest.map((s) => (
        <section className="screen-interim" key={s.kicker}>
          <span className="kicker">{s.kicker}</span>
          {title(s.title)}
          {s.text && <p>{s.text}</p>}
          {s.cta && (
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={onStart}>{s.cta[0]}</button>
              <button type="button" className="btn btn-ghost" onClick={onPlay}>{s.cta[1]}</button>
            </div>
          )}
        </section>
      ))}
      <footer className="site-footer">{c.footer}</footer>
    </main>
  );
}
