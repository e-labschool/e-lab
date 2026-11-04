import { useMemo } from "react";
import { OrbitControls, Line } from "@react-three/drei";
import Arrow3D from "../../components/Arrow3D.jsx";
import Tag from "./Tag.jsx";
import { CONE_ANGLE } from "../physics/spinEnsemble.js";

const ring = (r, z, n = 72) => Array.from({ length: n + 1 }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n), z]);

/**
 * One 1H nucleus. The sphere is a deliberately fuzzy "nucleus here" marker, NOT a spinning ball; the arrow is its magnetic moment mu.
 *   showMu   magnetic-moment arrow            inField  place the nucleus in B0: only two orientations (cones) are allowed
 *   state    "alpha" | "beta" (in the field)   phase    precession angle about B0 (display)
 *   analogy  draw the classical spinning-ball analogy (a rotation ring) -- the DOM overlay beside the scene states its limits
 */
export default function ProtonScene({ showMu = true, inField = false, state = "alpha", phase = 0, analogy = false, labels = true }) {
  const th = state === "alpha" ? CONE_ANGLE : Math.PI - CONE_ANGLE;
  const dir = useMemo(() => (inField ? [Math.sin(th) * Math.cos(-phase), Math.sin(th) * Math.sin(-phase), Math.cos(th)] : [0.42, 0.18, 0.89]), [inField, th, phase]);
  const len = 1.5;
  const tip = [dir[0] * len, dir[1] * len, dir[2] * len];
  const cone = useMemo(() => ring(Math.sin(th) * len, Math.cos(th) * len), [th]);
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, -4, 5]} intensity={1.2} />
      <mesh>
        <sphereGeometry args={[0.5, 40, 28]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.22} roughness={0.9} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.28, 32, 22]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.38} roughness={1} depthWrite={false} />
      </mesh>
      {labels && <Tag position={[0.62, -0.1, -0.62]} color="#bae6fd">proton (¹H nucleus)</Tag>}
      {showMu && <Arrow3D dir={dir} length={len} color="#fcd34d" radius={0.035} head={0.26} headRadius={0.1} />}
      {showMu && labels && <Tag position={[tip[0] * 1.12, tip[1] * 1.12, tip[2] * 1.12 + 0.12]} color="#fde68a">μ (magnetic moment)</Tag>}
      {inField && (
        <>
          {[[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]].map(([x, y], i) => <Arrow3D key={i} from={[x, y, -1.5]} dir={[0, 0, 1]} length={3} color="#38bdf8" radius={0.02} head={0.22} opacity={0.5} />)}
          <Line points={cone} color={state === "alpha" ? "#2dd4bf" : "#a78bfa"} lineWidth={1.6} dashed dashSize={0.08} gapSize={0.06} />
          <Line points={[[0, 0, 0], [0, 0, Math.cos(th) * len]]} color={state === "alpha" ? "#2dd4bf" : "#a78bfa"} lineWidth={3} />
          <Line points={[tip, [0, 0, tip[2]]]} color="#94a3b8" lineWidth={1} dashed dashSize={0.05} gapSize={0.05} />
          {labels && <Tag position={[1.95, -1.95, 1.9]} color="#7dd3fc">B₀</Tag>}
          {labels && <Tag position={[0.28, 0, Math.cos(th) * len * 0.5]} color={state === "alpha" ? "#5eead4" : "#c4b5fd"}>{`μz = ${state === "alpha" ? "+" : "−"}γħ/2`}</Tag>}
        </>
      )}
      {analogy && (
        <>
          <Line points={ring(0.78, 0.0)} color="#fb923c" lineWidth={2.4} />
          <Arrow3D from={[0.78, 0, 0]} dir={[0, 1, 0]} length={0.3} color="#fb923c" radius={0.02} head={0.14} />
          {labels && <Tag position={[0, -0.95, 0.0]} color="#fdba74">classical “spin” analogy (limits: see panel)</Tag>}
        </>
      )}
      <OrbitControls makeDefault enablePan={false} minDistance={2.4} maxDistance={9} />
    </>
  );
}
