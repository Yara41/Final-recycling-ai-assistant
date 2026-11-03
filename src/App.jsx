import React, { useEffect, useState } from 'react';
import AgentPage from './agent/AgentPage.jsx';
import Home from './pages/Home.jsx';
import Learn from './pages/Learn.jsx';
import ClockButton from './campus/ClockButton.jsx';
import { copy } from './pages/copy.js';
import './app-shell.css';

const PAGES = ['home', 'agent', 'learn'];

function readLang() {
  try {
    return localStorage.getItem('eco_lang') === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

// Site shell: header (logo, navigation, language) and the current page.
export default function App() {
  const [lang, setLang] = useState(readLang);
  const [page, setPage] = useState('home');
  const [agentPrompt] = useState('');
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const c = copy(lang);

  useEffect(() => {
    try { localStorage.setItem('eco_lang', lang); } catch { /* private mode */ }
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const go = (next) => {
    setPage(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className={`site page-${page}`} dir={dir}>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go('home')} aria-label="EcoWasteAI">
          <img src="/logo.png" alt="" />
        </button>
        <nav aria-label={lang === 'en' ? 'Main' : 'التنقل'}>
          {PAGES.map((p) => (
            <button key={p} type="button" className={page === p ? 'active' : ''} aria-current={page === p ? 'page' : undefined} onClick={() => go(p)}>
              {c.nav[p]}
            </button>
          ))}
        </nav>
        <ClockButton lang={lang} />
        <button type="button" className="lang" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{c.langSwitch}</button>
      </header>

      {page === 'home' && <Home lang={lang} onStart={() => go('agent')} onPlay={() => go('learn')} />}
      {page === 'learn' && <Learn lang={lang} />}
      {page === 'agent' && (
        <main className="agent-main">
          <AgentPage lang={lang} dir={dir} prompt={agentPrompt} />
        </main>
      )}
    </div>
  );
}
