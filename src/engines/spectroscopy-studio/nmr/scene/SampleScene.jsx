import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Arrow3D from "../../components/Arrow3D.jsx";
import Tag from "./Tag.jsx";
import ProtonInstances from "./ProtonInstances.jsx";
import { makeProtonGeometry, orient } from "./protonGeometry.js";
import { advanceClock, makeClock, publish } from "./sceneClock.js";
import { useFitZoom } from "./useFitZoom.js";
import { makeSpacedEnsemble } from "../physics/spinEnsemble.js";

export const SAMPLE_N = 48;
export const SAMPLE_ENSEMBLE = makeSpacedEnsemble(SAMPLE_N, 77, { radius: 1.45, minDist: 0.62 });
/** Step 1 has no field: every nucleus is "free" (no alpha / beta assignment yet). */
export const NO_STATES = { alpha: new Array(SAMPLE_N).fill(false), nAlpha: 0, nBeta: SAMPLE_N };
const ease = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const HERO_R = 0.85;
const MU0 = new THREE.Vector3(0.42, 0.18, 0.89).normalize();

/**
 * Step 1. ONE large proton model (sphere with a turning surface stripe, and its magnetic-moment arrow with a cone head) that is replaced by an
 * ensemble of small proton models, each with its own spin cue and its own randomly oriented moment arrow (no preferred direction, so no net moment).
 * live.current = { p, grow, apply: 0, states: NO_STATES, paused, reduced, speed }: p 0..1 morph progress, grow = ease(p). All motion happens in the frame loop.
 * The turning surface is a conceptual aid only: proton spin is a quantum property, not a ball rotating like a planet (the panel says so).
 */
export default function SampleScene({ live, labels = true, single = true }) {
  const clock = useMemo(() => makeClock(), []);
  useFitZoom(1);
  const sphere = useRef(); const arrow = useRef();
  const geo = useMemo(() => makeProtonGeometry(44, 30), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const dir = [MU0.x, MU0.y, MU0.z]; const len = 2.15;

  useFrame((state, delta) => {
    const L = live.current; advanceClock(clock, L, state.clock.elapsedTime, delta);
    const f = 1 - ease(Math.min(1, L.p * 1.6));
    if (sphere.current) { sphere.current.visible = f > 0.01; sphere.current.scale.setScalar(Math.max(0.0001, f * HERO_R)); orient(sphere.current.quaternion, dir, clock.spin); }
    if (arrow.current) { const g = 1 - ease(Math.min(1, L.p * 2.2)); arrow.current.visible = g > 0.02; arrow.current.scale.setScalar(Math.max(0.0001, g)); }
    if (L.p < 0.02) publish(state, clock, { hero: 1, "spin-angle": (clock.spin % (2 * Math.PI)).toFixed(3), motion: L.paused || L.reduced ? "static" : "running" });
  });

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, -4, 5]} intensity={1.2} />
      <mesh ref={sphere} geometry={geo}>
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.05} emissive="#1d3b7a" emissiveIntensity={0.35} />
      </mesh>
      <group ref={arrow}>
        <Arrow3D dir={dir} length={len} color="#fcd34d" radius={0.055} head={0.38} headRadius={0.17} />
      </group>
      <ProtonInstances ens={SAMPLE_ENSEMBLE} live={live} clock={clock} radius={0.15} arrowLen={0.52} spread={1.3} publishInfo />
      {labels && single && <Tag position={[1.0, -0.1, -1.1]} color="#bae6fd">proton (¹H nucleus)</Tag>}
      {labels && single && <Tag position={[dir[0] * len * 1.02, dir[1] * len * 1.02, dir[2] * len * 1.02 + 0.14]} color="#fde68a">μ (magnetic moment)</Tag>}
      <OrbitControls makeDefault enablePan={false} minDistance={2.6} maxDistance={9} />
    </>
  );
}
