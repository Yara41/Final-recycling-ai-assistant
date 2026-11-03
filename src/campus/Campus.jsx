import React from 'react';
import CampusFallback from './CampusFallback.jsx';
import Flight from './Flight.jsx';
import Replay from './Replay.jsx';
import { replayFrames } from './replay.js';
import { fetchSnapshot, pinsFromSnapshot } from './data.js';
import { effectsForCards } from './effects.js';
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

const ECO_SAYS_MS = 6000;

// The living campus: loads the university's snapshot and draws it in 3D when the device
// can, otherwise as an illustration. mode "showcase" is the home hero, "agent" sits behind the chat.
// actions = { id, cards } is the agent's latest batch of action cards; each batch plays once.
// replay = true plays "Your week" over the campus; onReplayEnd closes it.
export default function Campus({ mode = 'showcase', universityId, lang = 'ar', onSnapshot, actions, profileFaculty, replay = false, onReplayEnd, children }) {
  const t = TEXT[lang === 'en' ? 'en' : 'ar'];
  const stage = React.useRef(null);
  const project3D = React.useRef(null);
  const [state, setState] = React.useState({ snapshot: null, error: false });
  const [use3D, setUse3D] = React.useState(want3D);
  const [still] = React.useState(() => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  const [tour, setTour] = React.useState(0);
  const [pinEdits, setPinEdits] = React.useState({});
  const [say] = React.useState(null);
  const [flights, setFlights] = React.useState([]);
  const [replayPins, setReplayPins] = React.useState({});
  const played = React.useRef(new Set());
  const drop3D = React.useCallback(() => setUse3D(false), []);
  const onApi = React.useCallback((fn) => { project3D.current = fn; }, []);

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

  const buildings = React.useMemo(() => view?.layout.buildings ?? [], [view]);
  const show3D = use3D && buildings.length > 0;

  // Where a building's roof is on screen, in stage pixels.
  const roofOf = React.useCallback((buildingId) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return null;
    if (project3D.current) return project3D.current(buildingId);
    const b = buildings.find((x) => x.id === buildingId);
    const el = b && stage.current.querySelector(`.campus-fallback .building[data-faculty="${CSS.escape(b.faculty)}"]`);
    if (!el) return { x: box.width / 2, y: box.height / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left - box.left + r.width / 2, y: r.top - box.top };
  }, [buildings]);

  // Play each new batch of agent actions once.
  React.useEffect(() => {
    if (!actions?.id || !view || played.current.has(actions.id)) return undefined;
    played.current.add(actions.id);
    // Interim bridge to the new effects shape; the realistic scene replaces this component.
    const fx = effectsForCards(actions.cards, { plazaBins: [{ id: 'any' }] });
    const box = stage.current?.getBoundingClientRect();
    const from = box ? { x: box.width / 2, y: box.height - 12 } : { x: 0, y: 0 };
    const reportLoc = (actions.cards ?? []).find((c) => c.location_id && (c.kind === 'report' || c.kind === 'audit' || c.kind === 'resolved'))?.location_id;
    const home = view.layout.buildings.find((x) => x.faculty === profileFaculty)?.id ?? view.layout.buildings[0]?.id;
    const timer = null;
    for (const e of fx) {
      if (e.type === 'report' && reportLoc) setPinEdits((p) => ({ ...p, [reportLoc]: 'warn' }));
      if (e.type === 'resolved' && reportLoc) setPinEdits((p) => ({ ...p, [reportLoc]: null }));
      if (e.type === 'flight') {
        const to = roofOf(home) ?? from;
        setFlights((f) => [...f, { id: `${actions.id}-${f.length}`, from, to, points: e.points }]);
      }
    }
    return () => clearTimeout(timer);
  }, [actions, view, profileFaculty, roofOf]);

  const frames = React.useMemo(() => replayFrames(state.snapshot?.events_7d ?? []), [state.snapshot]);
  const onFrame = React.useCallback((f) => {
    if (f.locationId) setReplayPins((p) => ({ ...p, [f.locationId]: f.kind === 'wrong' ? 'warn' : f.kind }));
  }, []);
  const closeReplay = React.useCallback(() => {
    setReplayPins({});
    onReplayEnd?.();
  }, [onReplayEnd]);

  const pins = React.useMemo(() => {
    if (replay) return Object.entries(replayPins).map(([locationId, kind]) => ({ locationId, kind }));
    const base = new Map((view?.pins ?? []).map((p) => [p.locationId, p]));
    for (const [loc, kind] of Object.entries(pinEdits)) {
      if (kind) base.set(loc, { locationId: loc, kind });
      else base.delete(loc);
    }
    return [...base.values()];
  }, [view, pinEdits, replay, replayPins]);

  // In the showcase Eco tours the buildings and reads out each faculty's month.
  React.useEffect(() => {
    if (!show3D || mode !== 'showcase' || buildings.length < 2) return undefined;
    const id = setInterval(() => setTour((i) => i + 1), 4500);
    return () => clearInterval(id);
  }, [show3D, mode, buildings.length]);

  let target = say?.target;
  let text = say?.text;
  if (!target && view) {
    if (mode === 'showcase') {
      const touring = buildings.filter((b) => view.faculties.some((x) => x.faculty === b.faculty));
      if (touring.length) {
        const b = touring[tour % touring.length];
        const f = view.faculties.find((x) => x.faculty === b.faculty);
        target = b.id;
        text = view.growth[b.faculty].litter > 0 ? t.wrong(b.faculty, f.wrong_items_30d) : t.points(b.faculty, f.points_30d);
      }
    } else {
      target = buildings.find((b) => b.faculty === profileFaculty)?.id;
    }
  }

  const endFlight = React.useCallback((id) => setFlights((f) => f.filter((x) => x.id !== id)), []);

  const fallback = (
    <CampusFallback layout={view?.layout ?? null} growthByFaculty={view?.growth} pins={pins} emptyText={state.error ? '' : t.empty} />
  );

  return (
    <div ref={stage} className={`campus-stage campus-${mode}`} data-renderer={show3D ? '3d' : 'svg'}>
      {show3D ? (
        <SceneBoundary onFail={drop3D}>
          <React.Suspense fallback={fallback}>
            <CampusScene
              layout={view.layout}
              growthByFaculty={view.growth}
              pins={pins}
              ecoTarget={target}
              ecoText={text}
              still={still}
              onContextLost={drop3D}
              onApi={onApi}
            />
          </React.Suspense>
        </SceneBoundary>
      ) : fallback}
      {flights.map((f) => (
        <Flight key={f.id} from={f.from} to={f.to} points={f.points} still={still} onDone={() => endFlight(f.id)} />
      ))}
      {replay && view && (
        <Replay frames={frames} events={state.snapshot?.events_7d ?? []} lang={lang} onFrame={onFrame} onClose={closeReplay} />
      )}
      {state.error && <span className="campus-chip offline" role="status">{t.offline}</span>}
      {children}
    </div>
  );
}
