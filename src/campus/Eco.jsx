import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

// Eco, the agent's character: a small leaf with eyes that flies to the building it is talking about.
// onScreen(x, y) receives Eco's head position in canvas pixels every frame (for the speech bubble).
export default function Eco({ target = [0, 4, 0], still = false, onScreen }) {
  const ref = React.useRef();
  const tmp = React.useRef(null);
  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const k = still ? 1 : Math.min(1, delta * 2.2);
    g.position.x += (target[0] - g.position.x) * k;
    g.position.z += (target[2] - g.position.z) * k;
    const bob = still ? 0 : Math.sin(state.clock.elapsedTime * 2.4) * 0.18;
    g.position.y += (target[1] + bob - g.position.y) * k;
    if (!still) g.rotation.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.4;
    if (onScreen) {
      if (!tmp.current) tmp.current = new Vector3();
      const p = g.getWorldPosition(tmp.current);
      p.y += 2.2;
      p.project(state.camera);
      onScreen(((p.x + 1) / 2) * state.size.width, ((1 - p.y) / 2) * state.size.height);
    }
  });

  return (
    <group ref={ref} position={target} scale={1.5}>
      <mesh scale={[0.62, 0.8, 0.42]} castShadow>
        <sphereGeometry args={[1, 20, 16]} />
        <meshLambertMaterial color="#5fd18f" />
      </mesh>
      <mesh position={[0, 0.95, 0]} rotation={[0, 0, 0.5]} scale={[0.12, 0.4, 0.12]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshLambertMaterial color="#127a5c" />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <group key={x} position={[x, 0.15, 0.38]}>
          <mesh><sphereGeometry args={[0.13, 12, 10]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh position={[0, 0, 0.09]}><sphereGeometry args={[0.065, 10, 8]} /><meshBasicMaterial color="#0b3b2c" /></mesh>
        </group>
      ))}
    </group>
  );
}
