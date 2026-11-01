import React, { useEffect, useState } from 'react';
import { ensureSession, getProfile } from '../lib/session.js';
import AdminPage from './AdminPage.jsx';
import AgentChat from './AgentChat.jsx';
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

// Entry point for the agent: makes sure there is a session and a profile,
// then shows the chat (Task 9 adds the impact / reports / campus tabs).
export default function AgentPage({ lang, dir, prompt = '' }) {
  const s = strings(lang);
  const [state, setState] = useState({ status: 'loading', profile: null });
  const [tab, setTab] = useState('chat');
  const [chat, setChat] = useState({ key: 0, prompt });

  useEffect(() => {
    let alive = true;
    loadState().then((next) => { if (alive) setState(next); });
    return () => { alive = false; };
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
        <button type="button" className="onboarding-primary" onClick={retry}>↻</button>
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
      <nav className="agent-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            className={`agent-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'chat' && (
        <div className="agent-body">
          <AgentChat key={chat.key} profile={state.profile} lang={lang} dir={dir} prompt={chat.prompt} onNeedsOnboarding={toOnboarding} />
        </div>
      )}
      {tab === 'impact' && <ImpactPage profile={state.profile} lang={lang} />}
      {tab === 'reports' && <FacilitiesPage lang={lang} />}
      {tab === 'campus' && <AdminPage profile={state.profile} lang={lang} onAsk={askAgent} />}
    </div>
  );
}
