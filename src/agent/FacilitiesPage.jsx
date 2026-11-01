import React, { useEffect, useState } from 'react';
import { sendAgentMessage } from '../lib/agent.js';
import { listOpenReports } from '../lib/dashboard.js';
import { strings } from './strings.js';

// Open bin reports, most contaminated first. Resolving goes through the agent so the
// action is recorded like any other agent action.
export default function FacilitiesPage({ lang }) {
  const s = strings(lang);
  const [reports, setReports] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    listOpenReports()
      .then((rows) => alive && setReports([...rows].sort((a, b) => (b.contamination_pct ?? 0) - (a.contamination_pct ?? 0))))
      .catch(() => alive && setReports([]));
    return () => { alive = false; };
  }, []);

  const resolve = async (id) => {
    setBusy(id);
    try {
      const res = await sendAgentMessage({ message: s.resolvePrompt(id), lang });
      if (res.actions.some((a) => a.kind === 'resolved')) setReports((rows) => rows.filter((r) => r.id !== id));
    } catch {
      /* keep the row; the user can retry */
    } finally {
      setBusy(null);
    }
  };

  if (reports === null) return <div className="agent-center">{s.loading}</div>;
  return (
    <div className="dash">
      <h1>{s.reportsTitle}</h1>
      {reports.length === 0 ? (
        <p className="dash-muted">{s.noReports}</p>
      ) : (
        <ul className="dash-list">
          {reports.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.locations?.name}</strong>
                <small>{s.issueLabel[r.issue] ?? r.issue}{r.note ? ` • ${r.note}` : ''} • {new Date(r.created_at).toLocaleString(lang === 'en' ? 'en-US' : 'ar')}</small>
              </div>
              {r.contamination_pct != null && <span className="pct-badge">{Math.round(r.contamination_pct)}%</span>}
              <button type="button" className="dash-btn" disabled={busy === r.id} onClick={() => resolve(r.id)}>{s.resolve}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
