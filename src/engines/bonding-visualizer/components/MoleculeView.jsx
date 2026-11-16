import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import CameraKeyApi from "../../shared-3d/CameraKeyApi.jsx";
import { useStageGuard } from "../../shared-3d/useStageGuard.js";
import { ContextLostNotice, StageKeyHint, useStageKeys } from "../../shared-3d/StageShell.jsx";
import { Html, OrbitControls } from "@react-three/drei";
import { bondOffsets, moleculeStructure } from "../scene/moleculeStructure.js";
import { atomPartials, bondTable, netDipole, polarityStatement } from "../model/polarity.js";
import { dativeBonds } from "../model/covalent.js";

// Final sphere-and-bond picture of a bonded molecule: rotatable 3D (react-three-fiber) with a flat SVG fallback when WebGL
// is unavailable. Atoms are labelled with their symbol; bond order is drawn as 1, 2 or 3 parallel bonds.
const FOV = 38;
const BOND_COLOR = "#7d8aa8";
const BOND_R = 0.075;
const DIR = new THREE.Vector3(0.62, 0.42, 1).normalize();

const unit = (a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const l = Math.hypot(...d); return { d: d.map((c) => c / l), len: l }; };

/** All cylinders of the structure: { mid:[x,y,z], quat:[x,y,z,w], len, key }. */
function bondMeshes(st, dativeKeys) {
  const up = new THREE.Vector3(0, 1, 0);
  const out = [];
  st.bonds.forEach((b, bi) => {
    const A = st.atoms[b.i].pos; const B = st.atoms[b.j].pos;
    const { d, len } = unit(A, B);
    const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(...d));
    const sep = b.order === 1 ? 0 : b.order === 2 ? 0.13 : 0.2;
    bondOffsets(d, b.order).forEach((o, k) => {
      out.push({ key: `${bi}-${k}`, mid: [0, 1, 2].map((a) => (A[a] + B[a]) / 2 + o[a] * sep), quat: [q.x, q.y, q.z, q.w], len, dative: dativeKeys?.has(`${Math.min(b.i, b.j)}-${Math.max(b.i, b.j)}`) && k === 0 });
    });
  });
  return out;
}

/** Net dipole arrow (IB convention: from the delta+ end towards the delta- end). */
function DipoleArrow({ v, len }) {
  const dir = new THREE.Vector3(...v).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return (
    <group quaternion={q} position={dir.clone().multiplyScalar(-len / 2)} data-testid="dipole-arrow">
      <mesh position={[0, len / 2 - 0.1, 0]}><cylinderGeometry args={[0.05, 0.05, len - 0.2, 12]} /><meshBasicMaterial color="#d6336c" depthTest={false} transparent opacity={0.9} /></mesh>
      <mesh position={[0, len - 0.1, 0]}><coneGeometry args={[0.14, 0.26, 14]} /><meshBasicMaterial color="#d6336c" depthTest={false} transparent opacity={0.95} /></mesh>
    </group>
  );
}

function Fit({ radius }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls);
  useEffect(() => {
    const vHalf = (FOV * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / Math.max(1, size.height)));
    const dist = (radius * 1.35) / Math.sin(Math.min(vHalf, hHalf));
    camera.position.copy(DIR).multiplyScalar(dist);
    camera.near = 0.1; camera.far = dist * 6; camera.updateProjectionMatrix(); camera.lookAt(0, 0, 0);
    if (controls) { controls.minDistance = dist * 0.45; controls.maxDistance = dist * 2.5; controls.update(); }
  }, [camera, size.width, size.height, radius, controls]);
  return null;
}

function Structure3D({ st, playing, reduced, molecule, polarity }) {
  const dativeKeys = useMemo(() => new Set(dativeBonds(molecule).map((d) => `${Math.min(d.i, d.j)}-${Math.max(d.i, d.j)}`)), [molecule]);
  const bonds = useMemo(() => bondMeshes(st, dativeKeys), [st, dativeKeys]);
  const partials = useMemo(() => atomPartials(molecule), [molecule]);
  const dip = useMemo(() => netDipole(molecule, st), [molecule, st]);
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 7, 6]} intensity={1.1} />
      <directionalLight position={[-6, -3, -4]} intensity={0.35} />
      {bonds.map((b) => (
        <mesh key={b.key} position={b.mid} quaternion={b.quat}>
          <cylinderGeometry args={[BOND_R, BOND_R, b.len, 14]} />
          <meshStandardMaterial color={b.dative ? "#d97706" : BOND_COLOR} roughness={0.45} metalness={0.1} />
        </mesh>
      ))}
      {st.atoms.map((a) => (
        <group key={a.index} position={a.pos}>
          <mesh>
            <sphereGeometry args={[a.radius, 36, 24]} />
            <meshStandardMaterial color={a.color} roughness={0.35} metalness={0.05} />
          </mesh>
          <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}><span className="bv-html-label" style={{ fontSize: 16 }} data-testid="struct-label">{a.symbol}</span></Html>
          {polarity && partials[a.index]?.sign !== 0 && <Html position={[0, a.radius + 0.28, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}><span className="bv-delta" data-sign={partials[a.index].sign} data-testid="delta-label">{partials[a.index].sign < 0 ? "δ−" : "δ+"}</span></Html>}
        </group>
      ))}
      {polarity && dip.polar && <DipoleArrow v={dip.vector} len={Math.min(1.6, 0.5 + dip.magnitude * 0.45)} />}
      <Fit radius={st.radius} />
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.1} autoRotate={playing && !reduced} autoRotateSpeed={1.1} />
    </>
  );
}

/** Flat orthographic fallback of the same structure (fixed oblique view, painter's algorithm). */
function StructureSvg({ st, molecule, polarity }) {
  const partials = atomPartials(molecule); const dip = netDipole(molecule, st);
  const yaw = -0.55; const pitch = 0.42;
  const proj = (p) => {
    const x1 = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
    const z1 = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
    const y2 = p[1] * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = p[1] * Math.sin(pitch) + z1 * Math.cos(pitch);
    return { x: x1, y: -y2, z: z2 };
  };
  const R = st.radius * 1.15;
  const atoms = st.atoms.map((a) => ({ ...a, p: proj(a.pos) }));
  const items = [
    ...st.bonds.map((b, i) => ({ kind: "bond", b, i, z: (atoms[b.i].p.z + atoms[b.j].p.z) / 2 - 0.0001 })),
    ...atoms.map((a) => ({ kind: "atom", a, z: a.p.z })),
  ].sort((p, q) => p.z - q.z);
  return (
    <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%" data-testid="structure-svg" role="img" aria-label="Molecule drawn as spheres and bonds">
      {items.map((it) => {
        if (it.kind === "bond") {
          const A = atoms[it.b.i].p; const B = atoms[it.b.j].p;
          const dx = B.x - A.x; const dy = B.y - A.y; const l = Math.hypot(dx, dy) || 1;
          const nx = -dy / l; const ny = dx / l; const sep = 0.15;
          return Array.from({ length: it.b.order }, (_, k) => {
            const off = (k - (it.b.order - 1) / 2) * sep;
            return <line key={`b${it.i}-${k}`} data-testid="struct-bond" data-order={it.b.order} x1={A.x + nx * off} y1={A.y + ny * off} x2={B.x + nx * off} y2={B.y + ny * off} stroke={BOND_COLOR} strokeWidth="0.15" strokeLinecap="round" />;
          });
        }
        const { a } = it;
        return (
          <g key={`a${a.index}`} data-testid="struct-atom" data-symbol={a.symbol}>
            <circle cx={a.p.x} cy={a.p.y} r={a.radius} fill={a.color} stroke={a.edge} strokeWidth="0.04" />
            <text x={a.p.x} y={a.p.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(0.3, a.radius * 1.15)} fontWeight="800" fill={a.text}>{a.symbol}</text>
            {polarity && partials[a.index]?.sign !== 0 && <text x={a.p.x} y={a.p.y - a.radius - 0.12} textAnchor="middle" fontSize="0.3" fontWeight="800" fill="#b3261e" data-testid="delta-label">{partials[a.index].sign < 0 ? "δ−" : "δ+"}</text>}
          </g>
        );
      })}
      {polarity && dip.polar && (() => {
        const p = proj(dip.vector.map((c) => c)); const l = Math.hypot(p.x, p.y) || 1; const len = Math.min(R * 0.7, 0.6 + dip.magnitude * 0.4); const x2 = (p.x / l) * len / 2; const y2 = (p.y / l) * len / 2;
        return <g data-testid="dipole-arrow"><line x1={-x2} y1={-y2 + R * 0.78} x2={x2} y2={y2 + R * 0.78} stroke="#d6336c" strokeWidth="0.1" strokeLinecap="round" /><circle cx={x2} cy={y2 + R * 0.78} r="0.15" fill="#d6336c" /></g>;
      })()}
    </svg>
  );
}

export default function MoleculeView({ molecule, playing, reduced }) {
  const st = useMemo(() => moleculeStructure(molecule), [molecule]);
  const [polarity, setPolarity] = useState(true);
  const table = useMemo(() => bondTable(molecule).filter((b, i, a) => a.findIndex((x) => `${x.a}${x.b}${x.delta}` === `${b.a}${b.b}${b.delta}`) === i), [molecule]);
  const statement = useMemo(() => polarityStatement(molecule, st), [molecule, st]);
  const boxRef = useRef(null); const camRef = useRef(null);
  const { webgl: gl, aa, lost, canvasKey } = useStageGuard(boxRef);
  const onKeyDown = useStageKeys(camRef, undefined);
  return (
    <div ref={boxRef} className="bv-structure-fill" data-s3d-stage={gl ? "" : undefined} tabIndex={gl ? 0 : undefined} role={gl ? "application" : undefined} aria-label={gl ? "3D molecule. Arrow keys rotate, plus and minus zoom." : undefined} aria-describedby={gl ? "bv-molkeys" : undefined} onKeyDown={gl ? onKeyDown : undefined} data-testid="structure" data-formula={molecule.id} data-atoms={st.atoms.length} data-bonds={st.bonds.length} data-renderer={gl ? "webgl" : "svg"} style={{ position: "absolute", inset: "34px 0 88px 0" }}>
      {gl ? (
        <Canvas key={canvasKey} camera={{ fov: FOV, position: [0, 0, 8] }} dpr={[1, 1.75]} gl={{ antialias: aa, powerPreference: "low-power" }}>
          <CameraKeyApi apiRef={camRef} />
          <Structure3D st={st} playing={playing} reduced={reduced} molecule={molecule} polarity={polarity} />
        </Canvas>
      ) : <StructureSvg st={st} molecule={molecule} polarity={polarity} />}
      <div className="bv-polarity" data-testid="polarity-panel" data-on={polarity ? "1" : "0"}>
        <button type="button" className="bv-pol-toggle" aria-pressed={polarity} onClick={() => setPolarity((v) => !v)} data-testid="polarity-toggle">Polarity {polarity ? "on" : "off"}</button>
        {polarity && (
          <div className="bv-pol-body">
            <ul data-testid="bond-table">{table.map((b) => <li key={`${b.a}${b.b}${b.delta}`}><b>{b.a}–{b.b}</b> ΔEN {b.delta.toFixed(1)}: {b.kind}{b.negative ? ` (δ− on ${b.negative})` : ""}</li>)}</ul>
            <p data-testid="polarity-statement">{statement}</p>
          </div>
        )}
      </div>
      {gl && <StageKeyHint id="bv-molkeys" />}
      {lost && <ContextLostNotice />}
      <span className="bv-tag3d" data-testid="structure-tag">{gl ? "3D · drag to rotate" : "Structure"}</span>
    </div>
  );
}
