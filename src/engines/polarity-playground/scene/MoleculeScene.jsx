import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Arrow, Atom, ChargeTag, Label, Stick, atomColor } from "./parts.jsx";
import { useSimClock } from "./Stage.jsx";
import { vectorFrame, originOf } from "../model/vectorAddition.js";
import { elementStyle } from "../../shared-3d/elementStyle.js";
import { sub, unit, mul, add } from "../../shared-3d/electronCloud/vec3.js";
import * as THREE from "three";

const BALL = 1.6;
const ballRadius = (el) => elementStyle(el).r * BALL;
function bondSticks(mol) {
  const out = [];
  for (const [i, j, order] of mol.bonds) {
    const pa = mol.atoms[i].p; const pb = mol.atoms[j].p; const u = unit(sub(pb, pa)); const ref = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const perp = unit([u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]]);
    const offs = order === 3 ? [-1, 0, 1] : order === 2 ? [-0.5, 0.5] : [0];
    for (const o of offs) out.push({ a: add(pa, mul(perp, o * 0.2)), b: add(pb, mul(perp, o * 0.2)), r: order === 1 ? 0.1 : 0.07, key: `${i}-${j}-${o}` });
  }
  return out;
}

export default function MoleculeScene({ mol, mode, anim, reduced, done }) {
  // anim: ref { u (0..1 progress of the vector-addition animation) } driven by the DOM clock
  const clock = useSimClock(reduced);
  const arrows = useRef([]); const res = useRef(null);
  const sticks = useMemo(() => bondSticks(mol), [mol]);
  const lpMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9b8ff", transparent: true, opacity: 0.4, roughness: 0.5, depthWrite: false }), []);
  useEffect(() => () => lpMat.dispose(), [lpMat]);
  const frameRef = useRef(null);
  useFrame(() => {
    const f = vectorFrame(mol, anim.current.u, mode); frameRef.current = f;
    mol.dipoles.forEach((d, k) => {
      const A = arrows.current[k]; if (!A) return; const fr = f.arrows[k]; A.setVisible(!!fr); if (fr) { A.set(fr.from, fr.to, 1); A.setOpacity(Math.max(0.2, fr.opacity)); }
    });
    const R = res.current; if (R) { R.setVisible(!!f.resultant); if (f.resultant) { R.set(f.resultant.from, f.resultant.to, 1.5); R.setOpacity(1); } }
    anim.current.frame = f; void clock;
  });
  const dipolesOn = mode !== "model";
  const org = originOf(mol); const net = mol.net;
  return (
    <group position={[0, mode === "overall" ? 0.55 : 0, 0]}>
      {mol.atoms.map((a, i) => <Atom key={i} color={atomColor(a.el)} radius={ballRadius(a.el)} position={a.p} name={`atom-${a.el}-${i}`} />)}
      {sticks.map((s) => <Stick key={s.key} a={s.a} b={s.b} radius={s.r} />)}
      {(mode === "model") && mol.lonePairs.map((lp, k) => (<mesh key={k} material={lpMat} position={add(mol.atoms[lp.atom].p, mul(lp.dir, 0.75))} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...lp.dir))} scale={[0.34, 0.6, 0.34]}><sphereGeometry args={[1, 20, 16]} /></mesh>))}
      {mol.atoms.map((a, i) => dipolesOn && mol.signs[i] !== 0 ? <ChargeTag key={`c${i}`} sign={mol.signs[i]} name={`${a.el}${i}`} position={add(a.p, mul(unit(a.p[0] || a.p[1] || a.p[2] ? a.p : [0, 1, 0]), ballRadius(a.el) + 0.55))} /> : null)}
      {mol.dipoles.map((d, k) => <Arrow key={k} ref={(r) => { arrows.current[k] = r; }} color="#f5a300" radius={0.085} headRadius={0.25} crossHalf={0.24} />)}
      <Arrow ref={res} color="#d6247a" radius={0.09} headRadius={0.24} crossHalf={0.24} />
      {mode === "model" && mol.angles[0] && mol.atoms.length === 3 && <Label position={[0, Math.min(...mol.atoms.map((a) => a.p[1])) - 0.85, 0.3]} className="pp-tag--angle"><span data-testid="angle-label">{mol.angles[0].deg.toFixed(1).replace(/\.0$/, "")}°</span></Label>}
      {mode === "overall" && done && net.polar && <Label position={[org[0], org[1] - 0.6, 0.5]} className="pp-tag--net"><span data-testid="net-label">Net dipole moment, μ ≠ 0</span></Label>}
    </group>
  );
}
