import React from 'react';
import SortingGame from './game/SortingGame.jsx';
import './pages.css';

// The sorting game, played in front of the campus bins.
export default function Learn({ lang, onAsk }) {
  return (
    <main className="learn">
      <SortingGame lang={lang} onAsk={onAsk} />
    </main>
  );
}
