import React, { useEffect, useState } from 'react';
import { getCampusStats, getLatestInsight } from '../lib/dashboard.js';
import { strings } from './strings.js';

// Sustainability-office view: campus numbers, the agent's latest weekly report,
// and a shortcut to ask the agent about the data.
export default function AdminPage({ profile, lang, onAsk }) {
  const s = strings(lang);
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState(null);
  const [insight, setInsight] = useState(undefined);

  useEffect(() => {
    let alive = true;
    getCampusStats(profile.university_id, days).then((d) => alive && setStats(d)).catch(() => alive && setStats({}));
    return () => { alive = false; };
  }, [profile.university_id, days]);

  useEffect(() => {
    let alive = true;
    getLatestInsight().then((d) => alive && setInsight(d)).catch(() => alive && setInsight(null));
    return () => { alive = false; };
  }, []);

  const t = stats?.totals ?? {};
  return (
    <div className="dash">
      <h1>{s.campusTitle} — {profile.universities?.name}</h1>
      <div className="seg seg-small">
        {[7, 30].map((d) => (
          <button key={d} type="button" className={days === d ? 'active' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>
            {d === 7 ? s.last7 : s.last30}
          </button>
        ))}
      </div>
      {stats === null ? (
        <p className="dash-muted">{s.loading}</p>
      ) : (
        <div className="dash-grid">
          <div className="stat-tile"><span>{s.items}</span><strong>{t.items ?? 0}</strong></div>
          <div className="stat-tile"><span>{s.correct}</span><strong>{Math.round((t.correct_rate ?? 0) * 100)}%</strong></div>
          <div className="stat-tile"><span>{s.activeUsers}</span><strong>{t.active_users ?? 0}</strong></div>
          <div className="stat-tile"><span>{s.co2}</span><strong>{Number(t.est_co2e_kg ?? 0).toFixed(1)}</strong><small>({s.estimate})</small></div>
        </div>
      )}
      <div className="dash-card">
        <h2>{s.latestInsight}</h2>
        {insight === undefined ? <p className="dash-muted">{s.loading}</p> : insight ? (
          <>
            <p>{insight.report}</p>
            <small className="dash-muted">{insight.period_start} → {insight.period_end}</small>
          </>
        ) : <p className="dash-muted">{s.noInsight}</p>}
      </div>
      {(stats?.top_missorted ?? []).length > 0 && (
        <div className="dash-card">
          <h2>{s.topMissorted}</h2>
          <ul className="dash-list">
            {stats.top_missorted.map((m) => (
              <li key={`${m.item}-${m.wrong_bin}`}><span>{m.item}{m.wrong_bin ? ` → ${m.wrong_bin}` : ''}</span><strong>{m.count}</strong></li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className="btn btn-primary dash-ask" onClick={() => onAsk(s.askCampusPrompt)}>{s.askAboutCampus}</button>
    </div>
  );
}
