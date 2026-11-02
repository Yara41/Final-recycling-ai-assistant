import React from 'react';
import SortingGame from '../components/SortingGame.jsx';
import { copy } from './copy.js';
import './pages.css';

// Sorting rules, the illustrated guide and the sorting game.
export default function Learn({ lang, onAsk }) {
  const c = copy(lang).learn;
  return (
    <main className="learn">
      <section className="learn-hero">
        <span className="kicker">{c.kicker}</span>
        <h1>{c.title}</h1>
        <p className="lede">{c.sub}</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={onAsk}>{c.ask}</button>
          <a className="btn btn-ghost" href="/guide.jpg" target="_blank" rel="noreferrer">{c.guide}</a>
        </div>
      </section>
      <ul className="rules">
        {c.rules.map((r) => (
          <li key={r.title}><h3>{r.title}</h3><p>{r.text}</p></li>
        ))}
      </ul>
      <SortingGame lang={lang} />
    </main>
  );
}
