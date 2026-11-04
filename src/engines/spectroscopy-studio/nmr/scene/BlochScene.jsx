import { useMemo } from "react";
import { OrbitControls, Line } from "@react-three/drei";
import Arrow3D from "../../components/Arrow3D.jsx";
import Tag from "./Tag.jsx";

const circle = (axis, r = 1, n = 96) => Array.from({ length: n + 1 }, (_, i) => {
  const a = (2 * Math.PI * i) / n; const c = r * Math.cos(a); const s = r * Math.sin(a);
  return axis === "z" ? [c, s, 0] : axis === "y" ? [c, 0, s] : [0, c, s];
});
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return l < 1e-9 ? [0, 0, 1] : [v[0] / l, v[1] / l, v[2] / l]; };

/**
 * The magnetisation vector M (in units of M0) with B0 along +z.
 *  m          M in the frame rotating at the RF frequency (from blochSim.stateAt)
 *  trail      tip positions so far (rotating frame)
 *  frame      "rotating" | "lab": in the lab view everything that is static in the rotating frame (M, trail, B1) is spun about z by `labPhase`
 *             (display angle: the real precession is ~10^8 times faster than anything that could be shown)
 *  b1Amount   0..1 how strongly the RF arrow is drawn (1 during the pulse, 0 after)
 *  effDir     direction of B_eff = (B1, 0, DeltaB0) in the rotating frame (optional)
 */
export default function BlochScene({ m, trail, frame = "rotating", labPhase = 0, b1Amount = 0, effDir, showEff = true, labels = true }) {
  const mag = Math.hypot(m[0], m[1], m[2]);
  const dir = useMemo(() => unit(m), [m[0], m[1], m[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const tilt = Math.hypot(m[0], m[1]);
  const lab = frame === "lab";
  const xName = lab ? "x" : "x′"; const yName = lab ? "y" : "y′";
  const eff = effDir ? unit(effDir) : null;
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, -4, 5]} intensity={1.0} />
      <mesh><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#3b82f6" transparent opacity={0.07} depthWrite={false} /></mesh>
      <Line points={circle("z")} color="#7aa2f7" lineWidth={1.2} opacity={0.65} transparent />
      <Line points={circle("x")} color="#7aa2f7" lineWidth={0.8} opacity={0.3} transparent />
      <Line points={circle("y")} color="#7aa2f7" lineWidth={0.8} opacity={0.3} transparent />
      {/* axes (z = B0 axis; x/y fixed axes of the laboratory frame, or the rotating-frame axes x', y' when the rotating frame is shown) */}
      <Arrow3D dir={[0, 0, 1]} length={1.35} color="#38bdf8" radius={0.014} head={0.1} />
      <Line points={[[0, 0, 0], [0, 0, -1.2]]} color="#38bdf8" lineWidth={1} opacity={0.5} transparent />
      <Line points={[[-1.25, 0, 0], [1.25, 0, 0]]} color="#94a3b8" lineWidth={1} opacity={0.7} transparent />
      <Line points={[[0, -1.25, 0], [0, 1.25, 0]]} color="#94a3b8" lineWidth={1} opacity={0.7} transparent />
      {labels && <Tag position={[0.12, 0, 1.5]} color="#7dd3fc">z (B₀)</Tag>}
      {labels && <Tag position={[1.38, 0, 0]} color="#cbd5e1">{xName}</Tag>}
      {labels && <Tag position={[0, 1.38, 0]} color="#cbd5e1">{yName}</Tag>}
      <group rotation={[0, 0, lab ? -labPhase : 0]}>
        {lab && <Line points={[[0, 0, 0], [1.25, 0, 0]]} color="#fb923c" lineWidth={1.2} dashed dashSize={0.06} gapSize={0.05} opacity={0.8} transparent />}
        {lab && labels && <Tag position={[1.38, 0.0, 0.0]} color="#fdba74">rotating x′</Tag>}
        {b1Amount > 0.01 && <Arrow3D dir={[1, 0, 0]} length={0.95 * b1Amount} color="#fb923c" radius={0.03} head={0.14} />}
        {b1Amount > 0.01 && labels && <Tag position={[0.55 * b1Amount, 0, 0.14]} color="#fdba74">B₁ (RF)</Tag>}
        {showEff && eff && b1Amount > 0.01 && <Arrow3D dir={eff} length={0.8} color="#c4b5fd" radius={0.018} head={0.1} dashed />}
        {showEff && eff && b1Amount > 0.01 && labels && <Tag position={[eff[0] * 0.95, eff[1] * 0.95, eff[2] * 0.95]} color="#ddd6fe">B_eff</Tag>}
        {trail && trail.length > 1 && <Line points={trail} color="#fbbf24" lineWidth={2} opacity={0.85} transparent />}
        {tilt > 0.02 && <Line points={[[0, 0, 0], [m[0], m[1], 0]]} color="#f472b6" lineWidth={2.4} />}
        {tilt > 0.02 && <Line points={[[m[0], m[1], 0], [m[0], m[1], m[2]]]} color="#94a3b8" lineWidth={1} dashed dashSize={0.04} gapSize={0.04} />}
        <Arrow3D dir={dir} length={Math.max(0.02, mag)} color="#fcd34d" radius={0.035} head={0.17} headRadius={0.1} depthTest={false} />
        {labels && <Tag position={[m[0] * 1.12, m[1] * 1.12, m[2] * 1.12 + 0.12]} color="#fde68a">M</Tag>}
      </group>
      <OrbitControls makeDefault enablePan={false} minDistance={2.6} maxDistance={9} />
    </>
  );
}
