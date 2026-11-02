import React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import Eco from "./Eco.jsx";

// The 3D living campus. Loaded lazily so three.js is never part of the first download.
const around = (b, n, offset) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((i + offset) / Math.max(n, 1)) * Math.PI * 2 + offset;
    const r = b.w / 2 + 0.8 + (i % 2) * 0.5;
    return [b.x + Math.cos(a) * r, b.z + Math.sin(a) * r];
  });

// Half-width of the area actually used by buildings and kiosks, plus a margin.
const extentOf = (layout) =>
  Math.max(
    6,
    ...[...layout.buildings, ...layout.kiosks].map(
      (o) => Math.hypot(o.x, o.z) + 3,
    ),
  );

function FitCamera({ extent }) {
  const get = useThree((s) => s.get);
  const view = useThree((s) => s.size);
  React.useEffect(() => {
    const { camera } = get();
    camera.zoom = Math.min(
      view.width / (extent * 2.15),
      view.height / (extent * 1.55),
    );
    camera.updateProjectionMatrix();
  }, [get, view.width, view.height, extent]);
  return null;
}

function Spin({ still, children }) {
  const ref = React.useRef();
  useFrame((_, delta) => {
    if (!still && ref.current) ref.current.rotation.y += delta * 0.06;
  });
  return <group ref={ref}>{children}</group>;
}

function Building({ b }) {
  const rows = Math.max(1, Math.floor(b.h / 1.1));
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshLambertMaterial color={b.color} />
      </mesh>
      <mesh position={[0, b.h + 0.08, 0]}>
        <boxGeometry args={[b.w + 0.2, 0.16, b.d + 0.2]} />
        <meshLambertMaterial color="#127a5c" />
      </mesh>
      {Array.from({ length: rows }, (_, r) => (
        <mesh key={r} position={[0, 0.7 + r * 1.1, b.d / 2 + 0.01]}>
          <planeGeometry args={[b.w * 0.7, 0.36]} />
          <meshBasicMaterial color="#9fd8ff" />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ x, z, s }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.7, 6]} />
        <meshLambertMaterial color="#7a5a3a" />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <coneGeometry args={[0.45, 1.1, 7]} />
        <meshLambertMaterial color="#2fa36f" />
      </mesh>
    </group>
  );
}

function Pin({ x, z, warn, still }) {
  const ref = React.useRef();
  useFrame((state) => {
    if (!still && ref.current)
      ref.current.position.y =
        1.9 + Math.sin(state.clock.elapsedTime * 2 + x) * 0.15;
  });
  return (
    <mesh ref={ref} position={[x, 1.9, z]}>
      <sphereGeometry args={[0.32, 16, 12]} />
      <meshBasicMaterial color={warn ? "#ffb547" : "#c6f36b"} />
    </mesh>
  );
}

export default function CampusScene({
  layout,
  growthByFaculty = {},
  pins = [],
  ecoTarget,
  ecoText,
  still = false,
  onContextLost,
}) {
  const extent = extentOf(layout);
  const pinBy = new Map(pins.map((p) => [p.locationId, p.kind]));
  const target =
    layout.buildings.find((b) => b.id === ecoTarget) ?? layout.buildings[0];
  const ecoAt = target
    ? [
        target.x + target.w / 2 + 0.9,
        target.h + 1.6,
        target.z + target.d / 2 + 0.9,
      ]
    : [0, 4, 0];

  const onCreated = React.useCallback(
    ({ gl }) => {
      gl.domElement.addEventListener(
        "webglcontextlost",
        (e) => {
          e.preventDefault();
          onContextLost?.();
        },
        { once: true },
      );
    },
    [onContextLost],
  );

  const bubbleRef = React.useRef(null);
  const placeBubble = React.useCallback((x, y) => {
    const el = bubbleRef.current;
    if (!el) return;
    const half = el.offsetWidth / 2;
    const max = (el.parentElement?.clientWidth ?? 0) - half - 8;
    const cx = Math.max(half + 8, Math.min(max, x));
    el.style.transform = `translate(${cx.toFixed(1)}px, ${Math.max(el.offsetHeight + 8, y).toFixed(1)}px) translate(-50%, -100%)`;
  }, []);

  return (
    <div className="scene-wrap">
      <Canvas
        orthographic
        flat
        dpr={[1, 2]}
        camera={{ position: [40, 32, 40], near: 0.1, far: 400 }}
        onCreated={onCreated}
        frameloop={still ? "demand" : "always"}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <FitCamera extent={extent} />
        <hemisphereLight args={["#ffffff", "#cfe9da", 1.6]} />
        <directionalLight position={[20, 30, 10]} intensity={1.4} />
        <Spin still={still}>
          <mesh position={[0, -0.25, 0]} receiveShadow>
            <cylinderGeometry args={[extent, extent * 1.02, 0.5, 72]} />
            <meshLambertMaterial color="#bfe8cf" />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[extent * 0.55, extent * 0.6, 72]} />
            <meshBasicMaterial color="#e9f7ee" />
          </mesh>
          {layout.buildings.map((b) => {
            const g = growthByFaculty[b.faculty] ?? {
              trees: 0,
              treeScale: 1,
              litter: 0,
            };
            return (
              <group key={b.id}>
                <Building b={b} />
                {around(b, g.trees, 0.35).map(([x, z], i) => (
                  <Tree key={`t${i}`} x={x} z={z} s={g.treeScale} />
                ))}
                {around(b, g.litter, 1.9).map(([x, z], i) => (
                  <mesh key={`l${i}`} position={[x, 0.15, z]}>
                    <dodecahedronGeometry args={[0.38]} />
                    <meshLambertMaterial color="#8a6f4e" />
                  </mesh>
                ))}
              </group>
            );
          })}
          {layout.kiosks.map((k) => (
            <group key={k.id}>
              <mesh position={[k.x, 0.5, k.z]}>
                <boxGeometry args={[k.w, 1, k.d]} />
                <meshLambertMaterial
                  color={k.kind === "drop_off" ? "#ffd27a" : "#c6f36b"}
                />
              </mesh>
              {pinBy.has(k.locationId) && (
                <Pin
                  x={k.x}
                  z={k.z}
                  warn={pinBy.get(k.locationId) === "warn"}
                  still={still}
                />
              )}
            </group>
          ))}
          <Eco target={ecoAt} still={still} onScreen={placeBubble} />
        </Spin>
      </Canvas>
      <div
        ref={bubbleRef}
        className="eco-bubble"
        role="status"
        dir="auto"
        hidden={!ecoText}
      >
        {ecoText}
      </div>
    </div>
  );
}
