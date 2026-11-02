import React from 'react';
import Campus from '../campus/Campus.jsx';
import { copy } from './copy.js';
import './pages.css';

export const DEMO_UNI = '00000000-0000-4000-8000-000000000001';

// Landing page: the demo university's living campus, what the agent does, and the research behind it.
export default function Home({ lang, onStart }) {
  const c = copy(lang).home;
  const [stats, setStats] = React.useState(null);

  const onSnapshot = React.useCallback((snap) => {
    const fac = snap?.faculties ?? [];
    const items = fac.reduce((s, f) => s + Number(f.items_30d || 0), 0);
    const wrong = fac.reduce((s, f) => s + Number(f.wrong_items_30d || 0), 0);
    setStats(items ? { items, correct: Math.round(((items - wrong) / items) * 100) } : null);
  }, []);

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-text">
          <span className="kicker">{c.kicker}</span>
          <h1>{c.title}</h1>
          <p className="lede">{c.sub}</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={onStart}>{c.start}</button>
            <a className="btn btn-ghost" href="#how">{c.how}</a>
          </div>
          {stats && (
            <dl className="stat-strip">
              <div><dt>{c.stats.items}</dt><dd>{stats.items}</dd></div>
              <div><dt>{c.stats.correct}</dt><dd>{stats.correct}%</dd></div>
            </dl>
          )}
        </div>
        <figure className="hero-campus">
          <Campus mode="showcase" universityId={DEMO_UNI} lang={lang} onSnapshot={onSnapshot} />
          <figcaption>{c.liveCaption}</figcaption>
        </figure>
      </section>

      <section className="steps" id="how">
        <h2>{c.stepsTitle}</h2>
        <ol>
          {c.steps.map((s, i) => (
            <li key={s.title}>
              <span className="step-no">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="roles">
        <h2>{c.roles.title}</h2>
        <ul>
          {c.roles.items.map((r) => (
            <li key={r.who}><strong>{r.who}</strong><span>{r.what}</span></li>
          ))}
        </ul>
      </section>

      <section className="research">
        <div className="research-text">
          <h2>{c.research.title}</h2>
          <p>{c.research.text}</p>
          <small>{c.research.note}</small>
        </div>
        <div className="beta-bars" role="img" aria-label={`${c.research.low} 0.46, ${c.research.high} 0.87`}>
          <div className="beta"><span>{c.research.low}</span><i style={{ '--v': 0.46 }} /><b>0.46</b></div>
          <div className="beta strong"><span>{c.research.high}</span><i style={{ '--v': 0.87 }} /><b>0.87</b></div>
        </div>
      </section>

      <footer className="site-footer">{c.footer}</footer>
    </main>
  );
}
