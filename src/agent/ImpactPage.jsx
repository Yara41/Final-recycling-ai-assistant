import React, { useEffect, useState } from 'react';
import { getLeaderboard, getMyImpact } from '../lib/dashboard.js';
import { strings } from './strings.js';

// The user's own recorded behaviour, plus the faculty ranking at their university.
export default function ImpactPage({ profile, lang }) {
  const s = strings(lang);
  const [impact, setImpact] = useState(null);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    let alive = true;
    getMyImpact().then((d) => alive && setImpact(d)).catch(() => alive && setImpact(false));
    getLeaderboard(profile.university_id).then((d) => alive && setBoard(d)).catch(() => {});
    return () => { alive = false; };
  }, [profile.university_id]);

  if (impact === null) return <div className="agent-center">{s.loading}</div>;
  const d = impact || { items: 0, est_co2e_kg: 0, points: 0, correct_pct: 0, streak_days: 0 };
  const top = Math.max(1, ...board.map((r) => Number(r.points)));

  return (
    <div className="dash">
      <h1>{s.tabImpact}</h1>
      <div className="dash-grid">
        <div className="stat-tile"><span>{s.points}</span><strong>{d.points}</strong></div>
        <div className="stat-tile"><span>{s.items}</span><strong>{d.items}</strong></div>
        <div className="stat-tile"><span>{s.verified}</span><strong>{d.verified_items ?? 0}</strong></div>
        <div className="stat-tile"><span>{s.co2}</span><strong>{Number(d.est_co2e_kg).toFixed(2)}</strong><small>({s.estimate})</small></div>
        <div className="stat-tile"><span>{s.correct}</span><strong>{d.correct_pct}%</strong></div>
        <div className="stat-tile"><span>{s.streak}</span><strong>{d.streak_days}</strong></div>
      </div>
      {Number(d.items) === 0 ? <p className="dash-muted">{s.noData}</p> : <p className="dash-muted">{s.verifiedHint}</p>}
      <div className="dash-card">
        <h2>{s.ranking}</h2>
        <ul className="dash-list">
          {board.map((r) => (
            <li key={r.faculty}>
              <div style={{ flex: 1 }}>
                <strong>{r.faculty}</strong>
                <div className="bar"><i style={{ width: `${(Number(r.points) / top) * 100}%` }} /></div>
              </div>
              <strong>{r.points}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
