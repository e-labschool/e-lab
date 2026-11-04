import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import WebGLGate from "./WebGLGate.jsx";
import CellGrid from "./CellGrid.jsx";
import { STRUCTURES, computeCoordination, displayRadii, generateIonicBlock, ionColors } from "../model/lattice.js";
import { IONIC_COUNT_NOTE } from "./latticeNotes.js";

const STEP = 0.075; // seconds between ions
const GROW = 0.55;
const easeOutBack = (t) => { const c1 = 1.5; const c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function Ions({ ions, radii, colors, playing, runKey, step, onProgress }) {
  const refs = useRef([]);
  const t = useRef(0);
  const playRef = useRef(playing);
  const lastReport = useRef(-1);
  const report = useRef(onProgress);
  useEffect(() => { playRef.current = playing; report.current = onProgress; });
  useEffect(() => {
    t.current = 0; lastReport.current = -1;
    refs.current.forEach((g) => { if (g) g.visible = false; });
    report.current(0, ions.length);
  }, [runKey, ions]);
  useFrame((_, dt) => {
    if (playRef.current) t.current += Math.min(dt, 0.05);
    let placed = 0;
    ions.forEach((ion, i) => {
      const g = refs.current[i];
      if (!g) return;
      const u = clamp01((t.current - i * step) / GROW);
      g.visible = u > 0;
      if (u >= 1) placed += 1;
      const e = easeOutBack(u);
      // each ion slides in along the axis the structure is currently growing in: x (first row), y (plane), z (block)
      const off = ion.iy === ions[0].iy && ion.iz === ions[0].iz ? [-1.6, 0, 0] : ion.iz === ions[0].iz ? [0, -1.6, 0] : [0, 0, -1.6];
      g.position.set(ion.x + off[0] * (1 - u), ion.y + off[1] * (1 - u), ion.z + off[2] * (1 - u));
      g.scale.setScalar(Math.max(0.0001, e));
    });
    if (placed !== lastReport.current) { lastReport.current = placed; report.current(placed, ions.length); }
  });
  return (
    <group>
      {ions.map((ion, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
          <mesh>
            <sphereGeometry args={[ion.species === "cation" ? radii.cation : radii.anion, 28, 20]} />
            <meshStandardMaterial color={ion.species === "cation" ? colors.cation : colors.anion} roughness={0.38} metalness={0.05} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Axes({ size }) {
  const o = -size - 0.4;
  const axes = [
    { to: [size * 2 + 1.2, 0, 0], color: "#e0524d", label: "x" },
    { to: [0, size * 2 + 1.2, 0], color: "#2f9e6b", label: "y" },
    { to: [0, 0, size * 2 + 1.2], color: "#2f6fe0", label: "z" },
  ];
  return (
    <group position={[o, o, o]}>
      {axes.map((a) => (
        <group key={a.label}>
          <Line points={[[0, 0, 0], a.to]} color={a.color} lineWidth={2} />
          <Html position={a.to} center style={{ pointerEvents: "none" }}><span className="bv-axis" style={{ color: a.color }}>{a.label}</span></Html>
        </group>
      ))}
    </group>
  );
}

function ControlsWithReset({ resetKey, autoRotate }) {
  const controls = useThree((s) => s.controls);
  const first = useRef(true);
  useEffect(() => { controls?.saveState?.(); }, [controls]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    controls?.reset?.();
  }, [resetKey, controls]);
  return <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.1} minDistance={4} maxDistance={22} autoRotate={autoRotate} autoRotateSpeed={0.9} />;
}

/**
 * Real 3D ionic lattice (react-three-fiber). Positions come from model/lattice.js, which GENERATES the structure
 * from crystallographic bases; the coordination shown is COMPUTED from those coordinates.
 */
export default function LatticeStage({ structureId, cat, an, playing, runKey, resetKey, reduced, onProgress }) {
  const ions = useMemo(() => generateIonicBlock(structureId, 2), [structureId]);
  const radii = useMemo(() => displayRadii(cat, an), [cat, an]);
  const colors = useMemo(() => ionColors(cat, an), [cat, an]);
  const coord = useMemo(() => computeCoordination(structureId, 2), [structureId]);
  const size = Math.max(...ions.map((i) => Math.abs(i.x)));
  const s = STRUCTURES[structureId];
  return (
    <div className="bv-3d" data-testid="lattice-stage" data-structure={structureId} data-ions={ions.length}>
      <WebGLGate fallback={`${s.label}: each interior cation has ${coord.cation} nearest anions and each interior anion has ${coord.anion} nearest cations.`}>
        <Canvas camera={{ position: [size * 3.3, size * 2.3, size * 4.1], fov: 40 }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: "low-power" }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[6, 8, 5]} intensity={1.15} />
          <directionalLight position={[-6, -3, -4]} intensity={0.35} />
          <Axes size={size} />
          <CellGrid edge={size} />
          <Ions ions={ions} radii={radii} colors={colors} playing={playing} runKey={runKey} step={reduced ? 0.004 : STEP} onProgress={onProgress} />
          <ControlsWithReset resetKey={resetKey} autoRotate={playing} />
        </Canvas>
      </WebGLGate>
      <div className="bv-legend" data-testid="lattice-legend">
        <span><i style={{ background: colors.cation }} />{cat} cation</span>
        <span><i style={{ background: colors.anion }} />{an} anion</span>
      </div>
      <p className="bv-3d-note" data-testid="lattice-note">
        {s.label}. Interior ions: each {cat} has {coord.cation} nearest {an}; each {an} has {coord.anion} nearest {cat} ({coord.cation}:{coord.anion}). {IONIC_COUNT_NOTE}
      </p>
    </div>
  );
}
