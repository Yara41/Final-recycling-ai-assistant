import React from 'react';
import CampusFallback from './CampusFallback.jsx';
import { fetchSnapshot, pinsFromSnapshot } from './data.js';
import { layoutCampus } from './layout.js';
import { growthFor } from './growth.js';
import { detectDevice, shouldUse3D } from './gate.js';
import './campus.css';

const CampusScene = React.lazy(() => import('./CampusScene.jsx'));

const TEXT = {
  ar: {
    offline: 'غير متصل',
    empty: 'لا توجد مباني بعد',
    points: (f, n) => `${n} نقطة لكلية ${f} هذا الشهر`,
    wrong: (f, n) => `${n} غرضاً في الحاوية الخطأ في كلية ${f}`,
  },
  en: {
    offline: 'Offline',
    empty: 'No buildings yet',
    points: (f, n) => `${f}: ${n} points this month`,
    wrong: (f, n) => `${f}: ${n} items in the wrong bin`,
  },
};

// ?3d=1 forces the 3D campus (tests, demos), ?3d=0 forces the illustration.
function want3D() {
  try {
    const force = new URLSearchParams(window.location.search).get('3d');
    if (force === '1') return true;
    if (force === '0') return false;
    return shouldUse3D(detectDevice());
  } catch {
    return false;
  }
}

class SceneBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

// The living campus: loads the university's snapshot and draws it in 3D when the device
// can, otherwise as an illustration. mode "showcase" is the home hero, "agent" sits behind the chat.
export default function Campus({ mode = 'showcase', universityId, lang = 'ar', onSnapshot, ecoText, ecoTarget, children }) {
  const t = TEXT[lang === 'en' ? 'en' : 'ar'];
  const [state, setState] = React.useState({ snapshot: null, error: false });
  const [use3D, setUse3D] = React.useState(want3D);
  const [still] = React.useState(() => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  const [tour, setTour] = React.useState(0);
  const drop3D = React.useCallback(() => setUse3D(false), []);

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
    if (state.error) return { layout: layoutCampus(null), growth: {}, pins: [], faculties: [] };
    if (!state.snapshot) return null;
    const growth = {};
    const faculties = state.snapshot.faculties ?? [];
    for (const f of faculties) growth[f.faculty] = growthFor(f);
    return { layout: layoutCampus(state.snapshot), growth, pins: pinsFromSnapshot(state.snapshot), faculties };
  }, [state]);

  const buildings = view?.layout.buildings ?? [];
  const show3D = use3D && buildings.length > 0;

  // In the showcase Eco tours the buildings and reads out each faculty's month.
  React.useEffect(() => {
    if (!show3D || mode !== 'showcase' || ecoTarget || buildings.length < 2) return undefined;
    const id = setInterval(() => setTour((i) => i + 1), 4500);
    return () => clearInterval(id);
  }, [show3D, mode, ecoTarget, buildings.length]);

  let target = ecoTarget;
  let text = ecoText;
  const touring = buildings.filter((b) => view?.faculties.some((x) => x.faculty === b.faculty));
  if (show3D && !target && touring.length) {
    const b = touring[tour % touring.length];
    const f = view.faculties.find((x) => x.faculty === b.faculty);
    target = b.id;
    if (!text) text = view.growth[b.faculty].litter > 0 ? t.wrong(b.faculty, f.wrong_items_30d) : t.points(b.faculty, f.points_30d);
  }

  const fallback = (
    <CampusFallback layout={view?.layout ?? null} growthByFaculty={view?.growth} pins={view?.pins} emptyText={state.error ? '' : t.empty} />
  );

  return (
    <div className={`campus-stage campus-${mode}`} data-renderer={show3D ? '3d' : 'svg'}>
      {show3D ? (
        <SceneBoundary onFail={drop3D}>
          <React.Suspense fallback={fallback}>
            <CampusScene
              layout={view.layout}
              growthByFaculty={view.growth}
              pins={view.pins}
              ecoTarget={target}
              ecoText={text}
              still={still}
              onContextLost={drop3D}
            />
          </React.Suspense>
        </SceneBoundary>
      ) : fallback}
      {state.error && <span className="campus-chip offline" role="status">{t.offline}</span>}
      {children}
    </div>
  );
}
