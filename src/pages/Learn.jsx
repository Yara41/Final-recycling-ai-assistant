import React from 'react';
import SortingGame from '../components/SortingGame.jsx';
import './pages.css';

// The sorting game. Interim wrapper; the game in front of the campus bins replaces it.
export default function Learn({ lang }) {
  return (
    <main className="learn">
      <SortingGame lang={lang} />
    </main>
  );
}
