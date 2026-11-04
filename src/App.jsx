import React, { useEffect, useState } from 'react';
import AgentPage from './agent/AgentPage.jsx';
import Home from './pages/Home.jsx';
import Learn from './pages/Learn.jsx';
import ClockButton from './campus/ClockButton.jsx';
import Campus from './campus/Campus.jsx';
import { DEMO_UNI } from './pages/Home.jsx';
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
const STILL_VIEW = (() => { try { return new URLSearchParams(window.location.search).has('still'); } catch { return false; } })();

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

  // ?still=1 shows only the campus, used to render the still images for weak devices.
  if (STILL_VIEW) {
    return <div className="still-view"><Campus universityId={DEMO_UNI} lang={lang} /></div>;
  }

  return (
    <div className={`site page-${page}`} dir={dir}>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go('home')} aria-label="EcoWasteAI">
          <span className="logo-eco">Eco</span><span className="logo-rest">WasteAI</span>
        </button>
        <nav aria-label={lang === 'en' ? 'Main' : 'التنقل'}>
          {PAGES.map((p) => (
            <button key={p} type="button" className={`${page === p ? 'active' : ''} nav-${p}`} aria-current={page === p ? 'page' : undefined} onClick={() => go(p)}>
              {c.nav[p]}
            </button>
          ))}
        </nav>
        <ClockButton lang={lang} />
        <button type="button" className="lang" aria-label={c.langSwitch} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
          <span className="long">{c.langSwitch}</span><span className="short" aria-hidden="true">{lang === 'en' ? 'ع' : 'EN'}</span>
        </button>
      </header>

      {page === 'home' && <Home lang={lang} onStart={() => go('agent')} onPlay={() => go('learn')} />}
      {page === 'learn' && <Learn lang={lang} onAsk={() => go('agent')} />}
      {page === 'agent' && (
        <main className="agent-main">
          <AgentPage lang={lang} dir={dir} prompt={agentPrompt} />
        </main>
      )}
    </div>
  );
}
