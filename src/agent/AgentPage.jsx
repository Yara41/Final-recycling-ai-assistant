import React, { useEffect, useState } from 'react';
import { ensureSession, getProfile } from '../lib/session.js';
import AgentChat from './AgentChat.jsx';
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
  return (
    <AgentChat
      profile={state.profile}
      lang={lang}
      dir={dir}
      prompt={prompt}
      onNeedsOnboarding={() => setState({ status: 'onboarding', profile: null })}
    />
  );
}
