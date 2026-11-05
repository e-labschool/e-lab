import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Arrow3D from "../../components/Arrow3D.jsx";
import Tag from "./Tag.jsx";
import ProtonInstances from "./ProtonInstances.jsx";
import { makeClock } from "./sceneClock.js";
import { useFitZoom } from "./useFitZoom.js";
import { makeSpacedEnsemble } from "../physics/spinEnsemble.js";

export const ENSEMBLE = makeSpacedEnsemble(40, 20240611, { radius: 1.45, minDist: 0.72 });
const CHAMBER_R = 1.8;

/**
 * Step 2: the chamber of proton models. Before B0 the moments point in random directions (and wander slowly); once B0 (+z) is applied
 * each moment moves onto the quantum cone of its state (alpha: 54.7 degrees from B0, beta: 125.3 degrees) and precesses about B0, which is a distinct,
 * slower motion than the turning of the sphere surface. The precession rings show the circle the arrow tip travels on.
 *   live.current = { apply, grow: 1, states, paused, reduced, speed, m0Length }
 * Conceptual picture: the sphere is a teaching aid, not a rotating ball (see the panel).
 */
export default function SpinChamberScene({ live, labels = true }) {
  const clock = useMemo(() => makeClock(), []);
  const { compact } = useFitZoom(0.85);
  const [fieldOpacity, setFieldOpacity] = useState(0);
  const [m0Len, setM0Len] = useState(0);
  const field = useRef();

  useFrame(() => {
    const L = live.current;
    const fo = Math.min(1, L.apply * 1.4); if (Math.abs(fo - fieldOpacity) > 0.02) setFieldOpacity(fo);
    const len = L.m0Length * Math.min(1, Math.max(0, (L.apply - 0.5) * 2));
    if (Math.abs(len - m0Len) > 0.01) setM0Len(len < 0.012 ? 0 : len);
  });

  const z = [0, 0, 1];
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, -4, 5]} intensity={1.1} />
      <mesh>
        <sphereGeometry args={[CHAMBER_R, 40, 28]} />
        <meshStandardMaterial color="#60a5fa" transparent opacity={0.05} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[CHAMBER_R, 24, 16]} />
        <meshBasicMaterial color="#7aa2f7" wireframe transparent opacity={0.08} />
      </mesh>
      <ProtonInstances ens={ENSEMBLE} live={live} clock={clock} radius={0.14} arrowLen={0.5} publishInfo />
      <group ref={field} visible={fieldOpacity > 0.02}>
        {/* the applied field: one bold, labelled arrow beside the sample and a few faint field lines through it */}
        <Arrow3D from={[-2.05, 0, -1.7]} dir={z} length={3.4} color="#38bdf8" radius={0.045} head={0.3} headRadius={0.13} opacity={fieldOpacity} />
        {[[-1.1, 0.9], [1.1, 0.9], [0, -1.1], [1.2, -0.7]].map(([x, y], i) => (
          <Arrow3D key={i} from={[x, y, -2.0]} dir={z} length={4.0} color="#38bdf8" radius={0.009} head={0.16} headRadius={0.04} opacity={0.22 * fieldOpacity} depthTest={false} />
        ))}
        {labels && <Tag position={[-2.05, 0, 1.95]} color="#7dd3fc">{compact ? "B₀" : "B₀ (applied field)"}</Tag>}
        {labels && fieldOpacity > 0.9 && <Tag position={[1.3, 0, 2.0]} color="#5eead4">{compact ? "α" : "α: along B₀ (lower E)"}</Tag>}
        {labels && fieldOpacity > 0.9 && <Tag position={[0.3, 0, -2.1]} color="#c4b5fd">{compact ? "β" : "β: moment against B₀ (higher energy)"}</Tag>}
      </group>
      {m0Len > 0 && <Arrow3D from={[0, 0, -m0Len / 2]} dir={z} length={m0Len} color="#fcd34d" radius={0.06} head={0.28} headRadius={0.16} depthTest={false} />}
      {m0Len > 0 && labels && <Tag position={[0.35, 0, m0Len / 2 + 0.3]} color="#fde68a">M₀ (net)</Tag>}
      <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={10} />
    </>
  );
}
