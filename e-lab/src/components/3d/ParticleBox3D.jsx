import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import ThreeCanvas from "./ThreeCanvas.jsx";

// The ONE reusable particle engine behind every Structure 1.1 interactive
// that shows particle behaviour (Explore Matter, the Solids/Liquids/Gases
// tabs, Heat/Cool Matter, the Particle Speed Lab) — per the brief's
// explicit instruction not to build unrelated one-off simulations.
//
// Particle COUNT and SIZE never change with state or temperature — only
// arrangement (lattice vs loose vs free) and speed change. This is
// deliberate: visually "growing" particles on heating is a real, common
// misconception the brief explicitly warns against.
const BOX_SIZE = 2.4;
const PARTICLE_RADIUS = 0.11;

function latticePositions(count) {
  const perAxis = Math.ceil(Math.cbrt(count));
  const spacing = (BOX_SIZE * 0.7) / perAxis;
  const offset = (spacing * (perAxis - 1)) / 2;
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const x = i % perAxis, y = Math.floor(i / perAxis) % perAxis, z = Math.floor(i / (perAxis * perAxis));
    positions.push(new THREE.Vector3(x * spacing - offset, y * spacing - offset, z * spacing - offset));
  }
  return positions;
}

function randomPositions(count, spread) {
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    positions.push(new THREE.Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    ));
  }
  return positions;
}

// state: "solid" | "liquid" | "gas". speedFactor: 0 (paused) to ~2 (fast) —
// lets Heat/Cool and the temperature slider drive the SAME engine.
function Particles({ state, count, speedFactor, color }) {
  const groupRef = useRef();
  const basePositions = useMemo(() => {
    if (state === "solid") return latticePositions(count);
    if (state === "liquid") return randomPositions(count, BOX_SIZE * 0.55);
    return randomPositions(count, BOX_SIZE * 0.95);
  }, [state, count]);

  const [velocities] = useState(
    () => basePositions.map(() => new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize())
  );
  const [phase] = useState(() => basePositions.map(() => Math.random() * Math.PI * 2));

  useFrame((_, delta) => {
    if (!groupRef.current || speedFactor === 0) return;
    const bound = BOX_SIZE / 2 - PARTICLE_RADIUS;
    groupRef.current.children.forEach((mesh, i) => {
      const base = basePositions[i];
      if (state === "solid") {
        // Vibrate around a fixed lattice position — never leaves its slot.
        const t = performance.now() * 0.004 * speedFactor + phase[i];
        mesh.position.set(
          base.x + Math.sin(t) * 0.045 * speedFactor,
          base.y + Math.cos(t * 1.3) * 0.045 * speedFactor,
          base.z + Math.sin(t * 0.7) * 0.045 * speedFactor
        );
      } else {
        // Liquid/gas: free movement, bouncing off the box walls — gas
        // just uses a larger effective bound and higher base speed.
        const v = velocities[i];
        const speed = (state === "gas" ? 0.9 : 0.35) * speedFactor;
        mesh.position.addScaledVector(v, speed * delta);
        ["x", "y", "z"].forEach((axis) => {
          if (Math.abs(mesh.position[axis]) > bound) {
            mesh.position[axis] = Math.sign(mesh.position[axis]) * bound;
            v[axis] *= -1;
          }
        });
      }
    });
  });

  return (
    <group ref={groupRef}>
      {basePositions.map((pos, i) => (
        <mesh key={i} position={pos.toArray()}>
          <sphereGeometry args={[PARTICLE_RADIUS, 16, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Box() {
  return (
    <lineSegments>
      <edgesGeometry args={[new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)]} />
      <lineBasicMaterial color="#8A909C" />
    </lineSegments>
  );
}

/**
 * state: "solid" | "liquid" | "gas"
 * count: particle count (kept small deliberately — see file header)
 * speedFactor: 0..~2, drives both vibration/motion speed; a caller (e.g.
 *   a temperature slider) can pass this directly, so ONE prop covers both
 *   play/pause (0 = paused) and "faster at higher temperature".
 * color: hex string, lets a caller distinguish e.g. Particle A vs B.
 */
export default function ParticleBox3D({ state = "solid", count = 24, speedFactor = 1, color = "#6C86EE", height = 300 }) {
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <ThreeCanvas
      height={height}
      cameraDistance={4.5}
      fallbackLabel="3D particle view"
      fallbackDescription={`${state === "solid" ? "Particles packed in a fixed arrangement, only vibrating." : state === "liquid" ? "Particles close together but able to move past one another." : "Particles far apart, moving freely through the container."}`}
    >
      <Particles key={`${state}-${count}`} state={state} count={count} speedFactor={reducedMotion ? 0 : speedFactor} color={color} />
      <Box />
    </ThreeCanvas>
  );
}
