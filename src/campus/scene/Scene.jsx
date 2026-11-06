import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { buildWorld, binTop, reportTop } from './world.js';

// The live 3D campus. Lazy-loaded so three.js never ships in the first download.
// Props: composition, sky (from timeOfDay), shot {p,l} or track() -> {p,l} read every frame,
// layout 'phone'|'wide', still (reduced motion), onApi(api|null), onContextLost(), onReady().
const FROM = [3, 5, 11];

// Paints the sky gradient and sets fog, sun, ambient light, windows and lamps for one sky state.
function applySky({ sky, tex, scene, world, sun, hemi, lampLights = true }) {
  const x = tex.userData.canvas.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, sky.top); g.addColorStop(1, sky.hor);
  x.fillStyle = g; x.fillRect(0, 0, 2, 256); tex.needsUpdate = true;
  scene.background = tex;
  if (!scene.fog) scene.fog = new THREE.Fog(sky.fog, 70, 190);
  scene.fog.color.set(sky.fog);
  const el = (sky.elevation * Math.PI) / 180, az = (sky.azimuth * Math.PI) / 180;
  if (sun) {
    sun.color.set(sky.sun); sun.intensity = sky.sunIntensity * Math.PI;
    sun.position.set(Math.sin(az) * 60 * Math.cos(el), 60 * Math.sin(el) + 4, Math.cos(az) * 60 * Math.cos(el));
  }
  if (hemi) hemi.intensity = sky.hemiIntensity * Math.PI;
  world.windows.forEach((m) => { m.emissiveIntensity = sky.windows; });
  world.lampHeads.forEach((m) => { m.emissiveIntensity = sky.windows * 1.5; });
  // Lamp lights cost a lot per pixel: they are off by day, and phones keep only the glowing lamp heads.
  world.lampLights.forEach((l) => { l.intensity = sky.windows * 18; l.visible = lampLights && l.intensity > 0.05; });
}

const redrawShadows = (gl) => { gl.shadowMap.needsUpdate = true; };

function Sky({ sky, world, shadowSize, lampLights }) {
  const { scene, gl } = useThree();
  const tex = React.useMemo(() => {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.canvas = c; return t;
  }, []);
  const hemi = React.useRef(); const sun = React.useRef();
  React.useEffect(() => {
    applySky({ sky, tex, scene, world, sun: sun.current, hemi: hemi.current, lampLights });
    redrawShadows(gl); // shadows are drawn on demand (see Scene)
  }, [sky, tex, scene, world, gl, lampLights]);
  return (
    <>
      <hemisphereLight ref={hemi} args={['#bfe3ff', '#b49c74', 1]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45}
        shadow-camera-near={1} shadow-camera-far={160} shadow-bias={-0.0004} shadow-normalBias={0.02}
      />
    </>
  );
}

// Follows the shot (or the track function, read every frame) with one time-based ease, so the camera keeps up
// with the finger at any frame rate. Pointer parallax only with a mouse: on touch screens it made the camera jump.
const FINE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
function Rig({ shot, track, still, fov }) {
  const start = track ? track() : shot;
  const cam = React.useRef({ p: new THREE.Vector3(...start.p), l: new THREE.Vector3(...start.l) });
  const target = React.useRef({ p: new THREE.Vector3(), l: new THREE.Vector3() });
  const look = React.useRef({ x: 0, y: 0 });
  useFrame((state, dt) => {
    const s = track ? track() : shot;
    target.current.p.set(...s.p); target.current.l.set(...s.l);
    const k = still || window.__snap ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 9);
    const c = cam.current;
    c.p.lerp(target.current.p, k); c.l.lerp(target.current.l, k);
    state.camera.position.copy(c.p);
    if (!still) {
      const t = state.clock.elapsedTime;
      const m = look.current, e = 1 - Math.exp(-Math.min(dt, 0.1) * 3);
      m.x += ((FINE_POINTER ? state.pointer.x : 0) - m.x) * e; m.y += ((FINE_POINTER ? state.pointer.y : 0) - m.y) * e;
      state.camera.position.x += Math.sin(t * 0.15) * 0.25 + m.x * 0.8;
      state.camera.position.y += Math.sin(t * 0.11) * 0.12 + m.y * 0.4;
    }
    state.camera.lookAt(c.l);
    if (state.camera.fov !== fov) { state.camera.fov = fov; state.camera.updateProjectionMatrix(); }
  });
  return null;
}

// Phones: if the first seconds run below about 40 frames a second, render at a lower pixel ratio.
function Adapt({ phone }) {
  const setDpr = useThree((s) => s.setDpr);
  const acc = React.useRef({ n: 0, t: 0, done: !phone });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.done) return;
    a.n += 1; if (a.n > 20) a.t += dt; // skip the first frames (shader compile)
    if (a.n === 110) { a.done = true; if (a.t / 90 > 1 / 40) setDpr(1); }
  });
  return null;
}

function World({ world, still, onApi, onReport }) {
  const get = useThree((s) => s.get);
  const lids = React.useRef(new Map());
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (world.bottle.visible || lids.current.size) state.gl.shadowMap.needsUpdate = true;
    if (!still) world.sway.forEach((s) => { s.object.rotation.z = Math.sin(t * 1.3 + s.phase) * s.amount; });
    const now = performance.now();
    for (const [id, start] of lids.current) {
      const item = world.plaza.items.get(id); const q = Math.min(1, (now - start) / 600);
      if (item) { item.lid.rotation.x = -Math.sin(q * Math.PI) * 0.9; item.lid.position.z = -Math.sin(q * Math.PI) * 0.3; }
      if (q >= 1) lids.current.delete(id);
    }
  });
  React.useEffect(() => {
    if (!onApi) return undefined;
    const api = {
      project([x, y, z]) {
        const { camera, size } = get();
        const p = new THREE.Vector3(x, y, z).project(camera);
        return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height, visible: p.z < 1 };
      },
      binTop: (id) => binTop(world, id),
      binIds: () => [...world.plaza.items.keys()],
      flight(id, t, from = FROM) {
        if (t === null || t === undefined || t < 0 || t >= 1) { world.bottle.visible = false; return; }
        const [tx, ty, tz] = binTop(world, id);
        const p = new THREE.Vector3(...from).lerp(new THREE.Vector3(tx, ty - 0.15, tz), t);
        p.y += Math.sin(t * Math.PI) * 3;
        world.bottle.position.copy(p); world.bottle.rotation.z = t * 7; world.bottle.visible = true;
      },
      lid(id) { lids.current.set(id, performance.now()); },
      setReport(on) {
        if (world.report.group.visible === Boolean(on)) return;
        world.report.group.visible = Boolean(on); get().gl.shadowMap.needsUpdate = true; onReport?.(Boolean(on));
      },
      reportTop: () => reportTop(world),
    };
    onApi(api);
    return () => onApi(null);
  }, [world, onApi, onReport, get]);
  return <primitive object={world.root} />;
}

export default function Scene({ composition, sky, shot, track, layout = 'wide', still = false, onApi, onContextLost, onReady }) {
  const world = React.useMemo(() => buildWorld(composition), [composition]);
  const [ready, setReady] = React.useState(false);
  const [report, setReport] = React.useState(Boolean(composition.reportBin));
  React.useEffect(() => { setReport(Boolean(composition.reportBin)); }, [composition]);
  const phone = layout === 'phone';
  const onCreated = React.useCallback(({ gl }) => {
    gl.toneMappingExposure = 0.9;
    // The campus barely moves, so shadows are redrawn only when something changes (sky, bottle, report bin).
    gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true;
    gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onContextLost?.(); }, { once: true });
    setReady(true);
    onReady?.();
  }, [onContextLost, onReady]);
  React.useEffect(() => () => {
    world.root.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
  }, [world]);
  return (
    <div className="scene-wrap" data-ready={ready ? 'true' : undefined} data-report={report ? 'true' : 'false'}>
      <Canvas
        shadows={phone ? 'percentage' : 'soft'}
        dpr={[1, phone ? 1.5 : 2]}
        camera={{ fov: phone ? 46 : 34, near: 0.1, far: 500, position: (track ? track() : shot).p }}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
        onCreated={onCreated}
      >
        <Sky sky={sky} world={world} shadowSize={phone ? 1024 : 2048} lampLights={!phone} />
        <Rig shot={shot} track={track} still={still} fov={phone ? 46 : 34} />
        <Adapt phone={phone} />
        <World world={world} still={still} onApi={onApi} onReport={setReport} />
      </Canvas>
    </div>
  );
}
