import React from 'react';
import CampusFallback from './CampusFallback.jsx';
import { fetchSnapshot, pinsFromSnapshot } from './data.js';
import { layoutCampus } from './layout.js';
import { growthFor } from './growth.js';
import './campus.css';

const TEXT = {
  ar: { offline: 'غير متصل', empty: 'لا توجد مباني بعد' },
  en: { offline: 'Offline', empty: 'No buildings yet' },
};

// The living campus: loads the university's snapshot and draws it.
// mode "showcase" is the home-page hero; mode "agent" sits behind the agent chat.
export default function Campus({ mode = 'showcase', universityId, lang = 'ar', onSnapshot, children }) {
  const t = TEXT[lang === 'en' ? 'en' : 'ar'];
  const [state, setState] = React.useState({ snapshot: null, error: false });

  React.useEffect(() => {
    if (!universityId) return undefined;
    let live = true;
    fetchSnapshot(universityId)
      .then((snapshot) => {
        if (!live) return;
        setState({ snapshot, error: false });
        onSnapshot?.(snapshot);
      })
      .catch(() => live && setState({ snapshot: null, error: true }));
    return () => { live = false; };
  }, [universityId, onSnapshot]);

  const view = React.useMemo(() => {
    if (state.error) return { layout: null, growth: {}, pins: [] };
    if (!state.snapshot) return null;
    const growth = {};
    for (const f of state.snapshot.faculties ?? []) growth[f.faculty] = growthFor(f);
    return { layout: layoutCampus(state.snapshot), growth, pins: pinsFromSnapshot(state.snapshot) };
  }, [state]);

  return (
    <div className={`campus-stage campus-${mode}`}>
      <CampusFallback
        layout={view?.layout ?? (state.error ? layoutCampus(null) : null)}
        growthByFaculty={view?.growth}
        pins={view?.pins}
        emptyText={state.error ? '' : t.empty}
      />
      {state.error && <span className="campus-chip offline" role="status">{t.offline}</span>}
      {children}
    </div>
  );
}
