import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Atom, Cloud, Label, Stick } from "./parts.jsx";
import { useSimClock } from "./Stage.jsx";
import { visualPolarity } from "../../shared-3d/electronCloud/index.js";
import { approach } from "../model/tug.js";

// Electron Tug-of-War: two characterised atoms pull a rope; the translucent shared cloud between them redistributes towards the
// stronger puller and the two electrons (a simplified, conceptual marker pair) stay inside it. The rope marker shows who is winning.
export const CHARACTER = { H: "#5aa0ff", C: "#6b7280", N: "#5a6cf0", O: "#ef5b5b", F: "#52c86a", Cl: "#3fbf6a", S: "#f2c94c", Br: "#c0714f", I: "#9a62d6", P: "#f08a24", Na: "#ab5cf2", Mg: "#5fbf6e", Li: "#d28cff", A: "#5aa0ff", B: "#b07bff" };
const AX = 4.0;

// ---- ONE glowing density cloud between the two atoms (an egg-shaped blob that stretches and thickens towards the stronger puller) ----------
// s in -1..1: negative = towards A (left), positive = towards B (right). s = 0 is a symmetric ellipsoid. The cloud never leaves the bond region:
// no electron is transferred to either atom (an unequal share, not a full transfer).
const BLOB_AX = 2.0; const BLOB_AY = 1.05;
function blobRadius(dx, dyz2, s) { const ax = BLOB_AX + 0.62 * s * dx; const ay = BLOB_AY * (1 + 0.42 * s * dx); return 1 / Math.sqrt((dx / ax) ** 2 + dyz2 / (ay * ay)); }
export function fillBlob(cloud, s) {
  const m = cloud.meshes[0] ?? cloud._make(); m.visible = true; const D = cloud.ico.dirs; const n = cloud.ico.count; const pos = m.geometry.attributes.position.array; const dens = m.geometry.attributes.aDens.array; const x0 = 0.4 * s;
  for (let v = 0; v < n; v += 1) {
    const dx = D[3 * v]; const dy = D[3 * v + 1]; const dz = D[3 * v + 2]; const r = blobRadius(dx, dy * dy + dz * dz, s);
    pos[3 * v] = x0 + dx * r; pos[3 * v + 1] = dy * r; pos[3 * v + 2] = dz * r; dens[v] = Math.max(0.5, 1.15 + 0.95 * s * (dx * r) / BLOB_AX);
  }
  m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.aDens.needsUpdate = true; m.geometry.computeVertexNormals();
}
/** Where the two (conceptual) electron markers are: well apart, inside the cloud, biased towards the stronger atom; never on an atom. */
export function tugMarkers(t, s) {
  const cx = 0.4 * s + 0.55 * s; const w = (a, b) => Math.sin(a * t + b);
  return [[cx - 0.5 + 0.12 * w(1.7, 0), 0.2 + 0.1 * w(2.3, 1), 0.15], [cx + 0.5 + 0.12 * w(1.3, 2), -0.2 + 0.1 * w(2.9, 0), -0.15]];
}

// ---- the twisted rope: two strands wound round each other; slack when the pull is even, taut and tightly twisted when one side pulls harder ------
const ROPE_L = 2.15;
function ropeCurves(tension) {
  const sag = 0.42 * (1 - tension); const turns = 9 + 7 * tension; const r = 0.085; const N = 90;
  const make = (ph) => new THREE.CatmullRomCurve3(Array.from({ length: N + 1 }, (_, i) => { const u = i / N; const x = -ROPE_L + 2 * ROPE_L * u; const a = turns * Math.PI * 2 * u + ph; return new THREE.Vector3(x, -0.28 - sag * (1 - (x / ROPE_L) ** 2) + r * Math.sin(a), 1.02 + r * Math.cos(a)); }));
  return [make(0), make(Math.PI)];
}
function Rope({ tension }) {
  const q = Math.round(tension * 24) / 24;
  const geos = useMemo(() => ropeCurves(q).map((c) => new THREE.TubeGeometry(c, 150, 0.085, 8, false)), [q]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (<group name="tug-rope">{geos.map((g, i) => (<mesh key={i} geometry={g}><meshStandardMaterial color={i ? "#b9783f" : "#e3b872"} roughness={0.75} metalness={0} /></mesh>))}</group>);
}


function Face({ mood }) { // mood: "win" | "lose" | "even"
  const brow = mood === "lose" ? 0.42 : mood === "win" ? -0.12 : 0.05;
  return (
    <group position={[0, 0.25, 1.02]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.38, 0, 0]}>
          <mesh><sphereGeometry args={[0.22, 20, 16]} /><meshStandardMaterial color="#fff" roughness={0.3} /></mesh>
          <mesh position={[0, 0, 0.16]}><sphereGeometry args={[0.11, 16, 12]} /><meshStandardMaterial color="#17223b" roughness={0.2} /></mesh>
          <mesh position={[0, 0.3, 0.06]} rotation={[0, 0, s * brow]}><boxGeometry args={[0.4, 0.07, 0.07]} /><meshStandardMaterial color="#17223b" /></mesh>
        </group>
      ))}
      <mesh position={[0, mood === "lose" ? -0.5 : -0.62, 0.08]} rotation={[0, 0, mood === "lose" ? 0 : Math.PI]}><torusGeometry args={[0.24, 0.05, 8, 20, Math.PI]} /><meshStandardMaterial color="#17223b" /></mesh>
    </group>
  );
}

function Character({ side, color, mood, lean, label }) {
  const x = side * AX; const dir = -side; // dir = towards the rope
  return (
    <group position={[x, 0.2, 0]} rotation={[0, 0, -dir * lean]}>
      <Atom color={color} radius={1.25} name={`tug-atom-${side < 0 ? "A" : "B"}`}><Face mood={mood} /></Atom>
      <Stick a={[dir * 0.95, -0.05, 0.85]} b={[dir * 1.4, -0.62, 1.0]} radius={0.24} color={color} />
      <Stick a={[dir * 1.4, -0.62, 1.0]} b={[dir * 1.8, -0.48, 1.02]} radius={0.22} color={color} />
      {[[0.95, -0.05, 0.85, 0.27], [1.4, -0.62, 1.0, 0.26]].map(([x, y, z, r], i) => (<mesh key={i} position={[dir * x, y, z]}><sphereGeometry args={[r, 24, 18]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>))}
      <mesh position={[dir * 1.9, -0.48, 1.04]}><sphereGeometry args={[0.38, 28, 20]} /><meshStandardMaterial color="#fff" roughness={0.45} /></mesh>
      <Label position={[0, -0.55, 1.18]} className="pp-tag--sym">{label}</Label>
    </group>
  );
}

export default function TugScene({ enA, enB, labelA, labelB, colorA, colorB, reveal, showValues, state, reduced }) {
  // `state` ref: filled every frame with what the DOM needs (tests / fallback); `reveal` 0..1 is the animated target
  const clock = useSimClock(reduced);
  const cloud = useRef(null); const e1 = useRef(null); const e2 = useRef(null); const knot = useRef(null); const grp = useRef(null);
  const cur = useRef({ a: enA, b: enB, rev: reduced ? reveal : 0, lean: 0 });
  const mark = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff4fd8", depthTest: false, transparent: true }), []);
  const halo = useRef(null); const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8ff7e8", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }), []);
  useEffect(() => () => haloMat.dispose(), [haloMat]);
  useEffect(() => () => mark.dispose(), [mark]);
  const dENt = enB - enA; const tension = reveal > 0.5 ? Math.min(1, Math.abs(dENt) / 1.4) : 0.15; const tensionQ = Math.round(tension * 24) / 24;
  useFrame(() => {
    const c = cur.current; const dt = clock.current.dt || 0.016;
    c.a = approach(c.a, enA, dt, { reduced }); c.b = approach(c.b, enB, dt, { reduced }); c.rev = approach(c.rev, reveal, dt, { rate: 1.6, reduced });
    const dd = c.b - c.a; const sgn = dd >= 0 ? 1 : -1; const sh = sgn * visualPolarity(Math.abs(dd)) * c.rev; // -1..1, towards the stronger atom
    if (cloud.current) { const key = Math.round(sh * 400); if (cur.current.key !== key) { cur.current.key = key; fillBlob(cloud.current, sh); if (halo.current && halo.current.geometry !== cloud.current.meshes[0].geometry) halo.current.geometry = cloud.current.meshes[0].geometry; } }
    const m = tugMarkers(clock.current.t, sh); e1.current?.position.set(...m[0]); e2.current?.position.set(...m[1]);
    const lensShift = 0.3 * sh * 2; if (knot.current) { const kx = sh * 1.5; knot.current.position.x = kx; knot.current.position.y = -0.28 - 0.42 * (1 - tensionQ) * (1 - (kx / ROPE_L) ** 2); }
    if (cur.current.tension !== undefined) { /* rope tension is derived below from the target, not per frame */ }
    const dEN = c.b - c.a; const tgt = Math.max(-1, Math.min(1, dEN / 1.6)) * c.rev; c.lean = c.lean + (tgt - c.lean) * 0.2;
    if (grp.current) grp.current.rotation.z = 0;
    if (state) state.current = { lensShift, rev: c.rev, a: c.a, b: c.b, sh };
  });
  const dEN = enB - enA; const eq = Math.abs(dEN) < 0.005; const moodA = eq || reveal < 0.5 ? "even" : dEN < 0 ? "win" : "lose"; const moodB = eq || reveal < 0.5 ? "even" : dEN > 0 ? "win" : "lose";
  const leanA = reveal > 0.5 ? Math.max(-0.35, Math.min(0.35, -dEN * 0.16)) : 0; // the stronger puller leans back more
  const { plus, minus } = { plus: eq ? null : dEN > 0 ? "A" : "B", minus: eq ? null : dEN > 0 ? "B" : "A" };
  const show = reveal > 0.9 && !eq;
  return (
    <group ref={grp}>
      <mesh position={[0, -1.7, 0]}><cylinderGeometry args={[5.9, 6.2, 0.28, 64]} /><meshStandardMaterial color="#c9c0ff" roughness={0.55} /></mesh>
      <Character side={-1} color={colorA} mood={moodA} lean={leanA} label={labelA} />
      <Character side={1} color={colorB} mood={moodB} lean={-leanA} label={labelB} />
      <Rope tension={tension} />
      <mesh ref={knot} position={[0, -0.28, 1.2]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.2, 0.2, 0.34, 24]} /><meshStandardMaterial color="#ef4444" roughness={0.4} /></mesh>
      <group position={[0, -0.28, 0]}>
        <Cloud ref={cloud} opacity={0.6} />
        <mesh ref={halo} material={haloMat} scale={1.14} renderOrder={3} frustumCulled={false} />
        <mesh ref={e1} material={mark} renderOrder={9}><sphereGeometry args={[0.24, 24, 18]} /></mesh>
        <mesh ref={e2} material={mark} renderOrder={9}><sphereGeometry args={[0.24, 24, 18]} /></mesh>
      </group>
      <Label position={[-AX, 2.2, 0.5]} className="pp-tag--bubble pp-tag--bubbleA"><span data-testid="en-bubble-a">{showValues ? `EN = ${enA.toFixed(2)}` : "EN = ?"}</span></Label>
      <Label position={[AX, 2.2, 0.5]} className="pp-tag--bubble pp-tag--bubbleB"><span data-testid="en-bubble-b">{showValues ? `EN = ${enB.toFixed(2)}` : "EN = ?"}</span></Label>
      {show && <Label position={[-AX + 1.2, 1.5, 1]} className={plus === "A" ? "pp-tag--plus" : "pp-tag--minus"}><span data-testid="tug-delta-a">δ{plus === "A" ? "+" : "−"}</span></Label>}
      {show && <Label position={[AX - 1.2, 1.5, 1]} className={plus === "B" ? "pp-tag--plus" : "pp-tag--minus"}><span data-testid="tug-delta-b">δ{plus === "B" ? "+" : "−"}</span></Label>}
      {reveal > 0.9 && eq && <Label position={[0, 1.9, 1]} className="pp-tag--note"><span data-testid="tug-equal-note">Equal sharing: no δ+ or δ−</span></Label>}
    </group>
  );
}
