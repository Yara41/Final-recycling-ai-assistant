import React, { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { ensureSession, getProfile } from '../lib/session.js';
import { getMyImpact } from '../lib/dashboard.js';
import AdminPage from './AdminPage.jsx';
import AgentChat from './AgentChat.jsx';
import Campus from '../campus/Campus.jsx';
import FacilitiesPage from './FacilitiesPage.jsx';
import ImpactPage from './ImpactPage.jsx';
import Onboarding from './Onboarding.jsx';
import { strings } from './strings.js';
import './agent.css';

async function loadState() {
  try {
    await ensureSession();
    const profile = await getProfile();
    return profile ? { status: 'ready', profile } : { status: 'onboarding', profile: null };
  } catch {
    return { status: 'error', profile: null };
  }
}

// Entry point for the agent: makes sure there is a session and a profile, then shows the
// university's living campus with the chat as a sheet over it, plus impact / reports / campus pages.
export default function AgentPage({ lang, dir, prompt = '' }) {
  const s = strings(lang);
  const [state, setState] = useState({ status: 'loading', profile: null });
  const [tab, setTab] = useState('chat');
  const [chat, setChat] = useState({ key: 0, prompt });
  const [actions, setActions] = useState(null);
  const [points, setPoints] = useState(null);

  useEffect(() => {
    let alive = true;
    loadState().then((next) => { if (alive) setState(next); });
    return () => { alive = false; };
  }, []);

  const ready = state.status === 'ready';
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    getMyImpact().then((d) => alive && setPoints(Number(d?.points ?? 0))).catch(() => {});
    return () => { alive = false; };
  }, [ready]);

  const onActions = React.useCallback((cards) => {
    setActions((a) => ({ id: (a?.id ?? 0) + 1, cards }));
    const earned = cards.filter((c) => c.kind === 'logged').reduce((n, c) => n + (Number(c.points) || 0), 0);
    if (earned) setPoints((p) => (p ?? 0) + earned);
  }, []);

  const retry = () => {
    setState({ status: 'loading', profile: null });
    loadState().then(setState);
  };

  if (state.status === 'loading') return <div className="agent-center">{s.loading}</div>;
  if (state.status === 'error') {
    return (
      <div className="agent-center">
        <p>{s.serverDown}</p>
        <button type="button" className="btn btn-primary" onClick={retry}>↻</button>
      </div>
    );
  }
  if (state.status === 'onboarding') {
    return <Onboarding lang={lang} onDone={(profile) => setState({ status: 'ready', profile })} />;
  }
  const role = state.profile.role;
  const tabs = [
    { id: 'chat', label: s.tabChat },
    { id: 'impact', label: s.tabImpact },
    ...(role === 'facilities' || role === 'admin' ? [{ id: 'reports', label: s.tabReports }] : []),
    ...(role === 'admin' ? [{ id: 'campus', label: s.tabCampus }] : []),
  ];
  const toOnboarding = () => setState({ status: 'onboarding', profile: null });
  const askAgent = (text) => {
    setChat((c) => ({ key: c.key + 1, prompt: text }));
    setTab('chat');
  };

  return (
    <div className="agent-shell" dir={dir}>
      <div className="agent-bar">
        <nav className="seg" role="tablist" aria-label={s.tabChat}>
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <span className="points-chip" title={s.myPoints}>
          <Leaf size={15} aria-hidden="true" />
          <strong>{points ?? '–'}</strong>
          <span>{s.points}</span>
        </span>
      </div>
      {tab === 'chat' ? (
        <div className="agent-scene">
          <Campus mode="agent" universityId={state.profile.university_id} lang={lang} actions={actions} profileFaculty={state.profile.faculty} />
          <AgentChat key={chat.key} profile={state.profile} lang={lang} dir={dir} prompt={chat.prompt} onNeedsOnboarding={toOnboarding} onActions={onActions} />
        </div>
      ) : (
        <div className="agent-page">
          {tab === 'impact' && <ImpactPage profile={state.profile} lang={lang} />}
          {tab === 'reports' && <FacilitiesPage lang={lang} />}
          {tab === 'campus' && <AdminPage profile={state.profile} lang={lang} onAsk={askAgent} />}
        </div>
      )}
    </div>
  );
}
