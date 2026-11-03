import React from 'react';
import CampusStill from './CampusStill.jsx';
import Replay from './Replay.jsx';
import { replayFrames } from './replay.js';
import { fetchSnapshot } from './data.js';
import { composeCampus, gameBins } from './compose.js';
import { layoutFor, SHOTS } from './camera.js';
import { detectDevice, shouldUse3D } from './gate.js';
import { useSky } from './useSky.js';
import { text } from './text.js';
import './campus.css';

const Scene = React.lazy(() => import('./scene/Scene.jsx'));

// ?3d=1 forces the live scene (tests, demos), ?3d=0 forces the still image.
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

function useLayout() {
  const [layout, setLayout] = React.useState(() => layoutFor(typeof window === 'undefined' ? 1024 : window.innerWidth));
  React.useEffect(() => {
    const on = () => setLayout(layoutFor(window.innerWidth));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return layout;
}

class SceneBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

// The university's campus, full-bleed behind a page. bins="plaza" shows the university's own bins,
// bins="game" the four standard bins of the sorting game. Pages drive it through onApi.
export default function Campus({ universityId, lang = 'ar', mode = 'home', shot, bins = 'plaza', onApi, onSnapshot, replay = false, onReplayEnd, children }) {
  const t = text(lang);
  const { sky, phase } = useSky();
  const layout = useLayout();
  const [state, setState] = React.useState({ snapshot: null, error: false, loaded: false });
  const [live, setLive] = React.useState(want3D);
  const [still] = React.useState(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } });
  const drop3D = React.useCallback(() => setLive(false), []);

  React.useEffect(() => {
    if (!universityId) return undefined;
    let alive = true;
    fetchSnapshot(universityId)
      .then((snapshot) => { if (!alive) return; setState({ snapshot, error: false, loaded: true }); onSnapshot?.(snapshot); })
      .catch(() => alive && setState({ snapshot: null, error: true, loaded: true }));
    return () => { alive = false; };
  }, [universityId, onSnapshot]);

  const composition = React.useMemo(() => {
    const c = composeCampus(state.snapshot, lang);
    return bins === 'game' ? { ...c, plazaBins: gameBins(lang) } : c;
  }, [state.snapshot, lang, bins]);

  const view = shot ?? (mode === 'agent' ? SHOTS[layout].agent : mode === 'game' ? SHOTS[layout].game : SHOTS[layout].home[0]);
  const frames = React.useMemo(() => replayFrames(state.snapshot?.events_7d ?? []), [state.snapshot]);
  const still3D = still && !new URLSearchParams(window.location.search).get('3d');
  const showLive = live && !still3D;

  return (
    <div className={`campus campus-${mode}`} data-renderer={showLive ? '3d' : 'still'} data-phase={phase}>
      {showLive ? (
        <SceneBoundary onFail={drop3D}>
          <React.Suspense fallback={<CampusStill phase={phase} layout={layout} lang={lang} />}>
            <Scene composition={composition} sky={sky} shot={view} layout={layout} still={still} onApi={onApi} onContextLost={drop3D} />
          </React.Suspense>
        </SceneBoundary>
      ) : (
        <CampusStill phase={phase} layout={layout} lang={lang} />
      )}
      {state.error && <span className="campus-chip" role="status">{t.offline}</span>}
      {replay && state.loaded && <Replay frames={frames} events={state.snapshot?.events_7d ?? []} lang={lang} onFrame={() => {}} onClose={onReplayEnd} />}
      {children}
    </div>
  );
}
