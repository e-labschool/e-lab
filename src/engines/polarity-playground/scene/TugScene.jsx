import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Atom, Cloud, Label, Stick } from "./parts.jsx";
import { useSimClock } from "./Stage.jsx";
import { buildRegions, bondingLens, electronMarkers } from "../../shared-3d/electronCloud/index.js";
import { approach } from "../model/tug.js";

// Electron Tug-of-War: two characterised atoms pull a rope; the translucent shared cloud between them redistributes towards the
// stronger puller and the two electrons (a simplified, conceptual marker pair) stay inside it. The rope marker shows who is winning.
export const CHARACTER = { H: "#5aa0ff", C: "#6b7280", N: "#5a6cf0", O: "#ef5b5b", F: "#52c86a", Cl: "#3fbf6a", S: "#f2c94c", Br: "#c0714f", A: "#5aa0ff", B: "#b07bff" };
const AX = 4.0;

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
      <Stick a={[dir * 0.9, -0.2, 0.8]} b={[dir * 1.75, -0.45, 1.0]} radius={0.17} color={color} />
      <mesh position={[dir * 1.85, -0.48, 1.02]}><sphereGeometry args={[0.28, 20, 16]} /><meshStandardMaterial color="#fff" roughness={0.5} /></mesh>
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
  useEffect(() => () => mark.dispose(), [mark]);
  useFrame(() => {
    const c = cur.current; const dt = clock.current.dt || 0.016;
    c.a = approach(c.a, enA, dt, { reduced }); c.b = approach(c.b, enB, dt, { reduced }); c.rev = approach(c.rev, reveal, dt, { rate: 1.6, reduced });
    const spec = buildRegions({ atoms: [{ el: "X", p: [-0.85, 0, 0], en: c.a, R: 1.25 }, { el: "X", p: [0.85, 0, 0], en: c.b, R: 1.25 }], bonds: [[0, 1]] }, { progress: c.rev });
    cloud.current?.update(spec);
    const lens = bondingLens(spec, 0, 1); const m = electronMarkers(clock.current.t, lens, 0.6, 0.6);
    e1.current?.position.set(...m[0]); e2.current?.position.set(...m[1]);
    const lensShift = lens.centre[0]; if (knot.current) knot.current.position.x = lensShift * 1.4;
    const dEN = c.b - c.a; const tgt = Math.max(-1, Math.min(1, dEN / 1.6)) * c.rev; c.lean = c.lean + (tgt - c.lean) * 0.2;
    if (grp.current) grp.current.rotation.z = 0;
    if (state) state.current = { lensShift, rev: c.rev, a: c.a, b: c.b };
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
      <Stick a={[-AX + 1.85, -0.28, 1.02]} b={[AX - 1.85, -0.28, 1.02]} radius={0.09} color="#f0b24a" />
      <mesh ref={knot} position={[0, -0.28, 1.1]}><sphereGeometry args={[0.2, 20, 16]} /><meshStandardMaterial color="#ef4444" roughness={0.4} /></mesh>
      <group position={[0, -0.28, 0]}>
        <Cloud ref={cloud} opacity={0.62} />
        <mesh ref={e1} material={mark} renderOrder={9}><sphereGeometry args={[0.2, 20, 16]} /></mesh>
        <mesh ref={e2} material={mark} renderOrder={9}><sphereGeometry args={[0.2, 20, 16]} /></mesh>
      </group>
      <Label position={[-AX, 2.2, 0.5]} className="pp-tag--bubble pp-tag--bubbleA"><span data-testid="en-bubble-a">{showValues ? `EN = ${enA.toFixed(2)}` : "EN = ?"}</span></Label>
      <Label position={[AX, 2.2, 0.5]} className="pp-tag--bubble pp-tag--bubbleB"><span data-testid="en-bubble-b">{showValues ? `EN = ${enB.toFixed(2)}` : "EN = ?"}</span></Label>
      {show && <Label position={[-AX + 1.2, 1.5, 1]} className={plus === "A" ? "pp-tag--plus" : "pp-tag--minus"}><span data-testid="tug-delta-a">δ{plus === "A" ? "+" : "−"}</span></Label>}
      {show && <Label position={[AX - 1.2, 1.5, 1]} className={plus === "B" ? "pp-tag--plus" : "pp-tag--minus"}><span data-testid="tug-delta-b">δ{plus === "B" ? "+" : "−"}</span></Label>}
      {reveal > 0.9 && eq && <Label position={[0, 1.9, 1]} className="pp-tag--note"><span data-testid="tug-equal-note">Equal sharing: no δ+ or δ−</span></Label>}
    </group>
  );
}
