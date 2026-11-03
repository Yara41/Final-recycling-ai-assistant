import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { buildWorld, binTop, reportTop } from './world.js';

// The live 3D campus. Lazy-loaded so three.js never ships in the first download.
// Props: composition, sky (from timeOfDay), shot {p,l}, layout 'phone'|'wide', still (reduced motion),
// onApi(api|null), onContextLost(), onReady().
const FROM = [3, 5, 11];

// Paints the sky gradient and sets fog, sun, ambient light, windows and lamps for one sky state.
function applySky({ sky, tex, scene, world, sun, hemi }) {
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
  world.lampLights.forEach((l) => { l.intensity = sky.windows * 18; });
}

function Sky({ sky, world, shadowSize }) {
  const { scene } = useThree();
  const tex = React.useMemo(() => {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.canvas = c; return t;
  }, []);
  const hemi = React.useRef(); const sun = React.useRef();
  React.useEffect(() => { applySky({ sky, tex, scene, world, sun: sun.current, hemi: hemi.current }); }, [sky, tex, scene, world]);
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

function Rig({ shot, still, fov }) {
  const cam = React.useRef({ p: new THREE.Vector3(...shot.p), l: new THREE.Vector3(...shot.l) });
  const target = React.useMemo(() => ({ p: new THREE.Vector3(...shot.p), l: new THREE.Vector3(...shot.l) }), [shot]);
  useFrame((state) => {
    const k = still || window.__snap ? 1 : 0.08;
    const c = cam.current;
    c.p.lerp(target.p, k); c.l.lerp(target.l, k);
    state.camera.position.copy(c.p);
    if (!still) {
      const t = state.clock.elapsedTime;
      state.camera.position.x += Math.sin(t * 0.15) * 0.5 + state.pointer.x * 1.2;
      state.camera.position.y += Math.sin(t * 0.11) * 0.25 + state.pointer.y * 0.6;
    }
    state.camera.lookAt(c.l);
    if (state.camera.fov !== fov) { state.camera.fov = fov; state.camera.updateProjectionMatrix(); }
  });
  return null;
}

function World({ world, still, onApi }) {
  const get = useThree((s) => s.get);
  const lids = React.useRef(new Map());
  useFrame((state) => {
    const t = state.clock.elapsedTime;
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
      flight(id, t, from = FROM) {
        if (t === null || t === undefined || t < 0 || t >= 1) { world.bottle.visible = false; return; }
        const [tx, ty, tz] = binTop(world, id);
        const p = new THREE.Vector3(...from).lerp(new THREE.Vector3(tx, ty - 0.15, tz), t);
        p.y += Math.sin(t * Math.PI) * 3;
        world.bottle.position.copy(p); world.bottle.rotation.z = t * 7; world.bottle.visible = true;
      },
      lid(id) { lids.current.set(id, performance.now()); },
      setReport(on) { world.report.group.visible = Boolean(on); },
      reportTop: () => reportTop(world),
    };
    onApi(api);
    return () => onApi(null);
  }, [world, onApi, get]);
  return <primitive object={world.root} />;
}

export default function Scene({ composition, sky, shot, layout = 'wide', still = false, onApi, onContextLost, onReady }) {
  const world = React.useMemo(() => buildWorld(composition), [composition]);
  const [ready, setReady] = React.useState(false);
  const phone = layout === 'phone';
  const onCreated = React.useCallback(({ gl }) => {
    gl.toneMappingExposure = 0.9;
    gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onContextLost?.(); }, { once: true });
    setReady(true);
    onReady?.();
  }, [onContextLost, onReady]);
  React.useEffect(() => () => {
    world.root.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
  }, [world]);
  return (
    <div className="scene-wrap" data-ready={ready ? 'true' : undefined}>
      <Canvas
        shadows="soft"
        dpr={[1, phone ? 1.75 : 2]}
        camera={{ fov: phone ? 46 : 34, near: 0.1, far: 500, position: shot.p }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={onCreated}
      >
        <Sky sky={sky} world={world} shadowSize={phone ? 1024 : 2048} />
        <Rig shot={shot} still={still} fov={phone ? 46 : 34} />
        <World world={world} still={still} onApi={onApi} />
      </Canvas>
    </div>
  );
}
