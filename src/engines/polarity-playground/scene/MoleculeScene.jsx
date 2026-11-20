import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { Arrow, Atom, ChargeTag, Label, Stick, atomColor } from "./parts.jsx";
import { useSimClock } from "./Stage.jsx";
import { vectorFrame, layoutOf, chainArrows, labelPlan, resultantNudge, PHASES, ATOM_SCALE } from "../model/vectorAddition.js";
import { elementStyle } from "../../shared-3d/elementStyle.js";
import { sub, unit, mul, add } from "../../shared-3d/electronCloud/vec3.js";
import * as THREE from "three";

const ballRadius = (el) => elementStyle(el).r * ATOM_SCALE;
/** Outward direction for an atom's charge badge: away from the atoms it is bonded to (up for a symmetric centre). */
function outward(mol, i) {
  const nb = mol.bonds.filter((b) => b[0] === i || b[1] === i).map((b) => (b[0] === i ? b[1] : b[0])); if (!nb.length) return [0, 1, 0];
  const m = nb.reduce((acc, j) => add(acc, mol.atoms[j].p), [0, 0, 0]).map((x) => x / nb.length); const d = sub(mol.atoms[i].p, m);
  return Math.hypot(...d) < 0.2 ? unit([0, -0.7, 0.7]) : unit(d);
}
function bondSticks(mol) {
  const out = [];
  for (const [i, j, order] of mol.bonds) {
    const pa = mol.atoms[i].p; const pb = mol.atoms[j].p; const u = unit(sub(pb, pa)); const ref = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const perp = unit([u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]]);
    const offs = order === 3 ? [-1, 0, 1] : order >= 1.5 ? [-0.5, 0.5] : [0];
    for (const o of offs) out.push({ a: add(pa, mul(perp, o * 0.2)), b: add(pb, mul(perp, o * 0.2)), r: order === 1 ? 0.1 : 0.07, key: `${i}-${j}-${o}` });
  }
  return out;
}

/** A small colour-matched tag (d1, d2 ...) that follows a point in 3D; set() is called every frame. Used on a bond arrow and on its copy in the vector-sum picture. */
const TrackTag = forwardRef(function TrackTag({ text, color, title }, ref) {
  const g = useRef(null); const el = useRef(null);
  useImperativeHandle(ref, () => ({ set(pos, on) { if (g.current) g.current.position.set(pos[0], pos[1], pos[2]); if (el.current) el.current.style.display = on ? "" : "none"; } }), []);
  return (<group ref={g}><Html center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}><div ref={el} className="pp-tag pp-tag--dtag" style={{ "--tagc": color, display: "none" }} title={title} data-testid={`dtag-${text}`}><span>{text}</span></div></Html></group>);
});

export default function MoleculeScene({ mol, mode, anim, reduced, done, placement = "below", offset = [0, 0], tid = "" }) {
  // anim: ref { u (0..1 progress of the vector-addition animation) } driven by the DOM clock
  const clock = useSimClock(reduced);
  const arrows = useRef([]); const rests = useRef([]); const res = useRef(null); const mres = useRef(null);
  const sticks = useMemo(() => bondSticks(mol), [mol]);
  const lpMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9b8ff", transparent: true, opacity: 0.4, roughness: 0.5, depthWrite: false }), []);
  useEffect(() => () => lpMat.dispose(), [lpMat]);
  const frameRef = useRef(null);
  const plan = useMemo(() => labelPlan(mol, placement), [mol, placement]);
  const restTags = useRef([]); const copyTags = useRef([]);
  useFrame(() => {
    const f = vectorFrame(mol, anim.current.u, mode, placement); frameRef.current = f;
    mol.dipoles.forEach((d, k) => {
      const A = arrows.current[k]; if (A) { const fr = mode === "overall" ? f.arrows[k] : null; A.setVisible(!!fr); if (fr) { A.set(fr.from, fr.to, 1); A.setOpacity(Math.max(0.15, fr.opacity)); } }
      const B = rests.current[k]; if (B) { const fr = f.rest[k]; B.setVisible(!!fr); if (fr) { B.set(fr.from, fr.to, 1); B.setOpacity(Math.max(0.15, fr.opacity)); } }
    });
    const nudge = resultantNudge(mol); const nd = (p) => [p[0] + nudge[0], p[1] + nudge[1], p[2] + nudge[2]];
    const M = mres.current; if (M) { M.setVisible(!!f.molResultant); if (f.molResultant) { M.set(nd(f.molResultant.from), nd(f.molResultant.to), 1); M.setOpacity(1); } }
    const R = res.current; if (R) { R.setVisible(!!f.resultant); if (f.resultant) { R.set(nd(f.resultant.from), nd(f.resultant.to), 1); R.setOpacity(1); } }
    const at = (a, off, q) => [a.from[0] + (a.to[0] - a.from[0]) * q + off[0], a.from[1] + (a.to[1] - a.from[1]) * q + off[1], a.from[2] + (a.to[2] - a.from[2]) * q + off[2] + 0.25];
    plan.forEach((t, n) => { // d1, d2 ...: only in the Resultant Dipole mode, so each bond arrow can be matched with its copy
      const r = f.rest[t.k]; const c = f.arrows[t.k]; const on = mode === "overall";
      restTags.current[n]?.set(r ? at(r, t.restOffset, 0.66) : [0, 0, 0], on && !!r && r.opacity > 0.5); copyTags.current[n]?.set(c ? at(c, t.copyOffset, 0.5) : [0, 0, 0], on && !!c && c.t > 0.85); // a copy's tag appears once the copy has (nearly) arrived, so tags never pile up at the common origin
    });
    anim.current.frame = f; void clock;
  });
  const dipolesOn = mode !== "model";
  const lay = layoutOf(mol, placement); const org = lay.origin; const net = mol.net; const bx = (lay.box.minX + lay.box.maxX) / 2;
  const chainNow = chainArrows(mol, placement, lay.origin); const showPara = mode === "overall" && chainNow.kind === "para" && (done || (anim.current.u ?? 0) >= PHASES.complete[0]);
  const para = showPara ? chainNow.arrows.filter(Boolean).map((a) => ({ from: add(a.to, [0, 0, 0.1]), to: add(chainNow.end, [0, 0, 0.1]) })) : [];
  const showSum = mode === "overall" && lay.hasChain && (done || (anim.current.u ?? 0) >= PHASES.complete[0]); // the title appears once the copies have mostly arrived, so it never hides copies in flight
  return (
    <group position={[offset[0], offset[1], 0]}>
      {mol.atoms.map((a, i) => <Atom key={i} color={atomColor(a.el)} radius={ballRadius(a.el)} position={a.p} name={`atom-${a.el}-${i}`} />)}
      {sticks.map((s) => <Stick key={s.key} a={s.a} b={s.b} radius={s.r} />)}
      {(mode === "model") && mol.lonePairs.map((lp, k) => (<mesh key={k} material={lpMat} position={add(mol.atoms[lp.atom].p, mul(lp.dir, 0.75))} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...lp.dir))} scale={[0.34, 0.6, 0.34]}><sphereGeometry args={[1, 20, 16]} /></mesh>))}
      {mol.atoms.map((a, i) => dipolesOn && mol.signs[i] !== 0 ? <ChargeTag key={`c${i}`} sign={mol.signs[i]} name={`${tid}${a.el}${i}`} position={add(a.p, mul(outward(mol, i), ballRadius(a.el) + 0.85))} /> : null)}
      {mol.dipoles.map((d, k) => <Arrow key={`r${k}`} ref={(r) => { rests.current[k] = r; }} color={d.qualitativeOnly ? "#c58b00" : "#f5a300"} radius={0.06} headRadius={0.19} crossHalf={0.19} />)}
      <Arrow ref={mres} color="#d6247a" radius={0.06} headRadius={0.21} crossHalf={0.2} />
      {showPara && para.map((e, n) => <Line key={`pe${n}`} points={[e.from, e.to]} color="#9a7a1a" lineWidth={1.6} dashed dashSize={0.12} gapSize={0.09} depthTest={false} transparent opacity={0.9} renderOrder={19} />)}
      {mol.dipoles.map((d, k) => <Arrow key={k} ref={(r) => { arrows.current[k] = r; }} color={d.qualitativeOnly ? "#c58b00" : "#f5a300"} radius={0.06} headRadius={0.19} crossHalf={0.19} />)}
      <Arrow ref={res} color="#d6247a" radius={0.06} headRadius={0.21} crossHalf={0.2} />
      {mode === "model" && mol.angles[0] && mol.atoms.length === 3 && <Label position={[0, Math.min(...mol.atoms.map((a) => a.p[1])) - 0.85, 0.3]} className="pp-tag--angle"><span data-testid={`${tid}angle-label`}>{mol.angles[0].deg.toFixed(1).replace(/\.0$/, "")}°</span></Label>}
      {plan.map((t, n) => (<TrackTag key={`rt${t.k}`} ref={(r) => { restTags.current[n] = r; }} text={`d${t.n}`} color={t.color} title={t.name} />))}
      {plan.map((t, n) => (<TrackTag key={`ct${t.k}`} ref={(r) => { copyTags.current[n] = r; }} text={`d${t.n}`} color={t.color} title={`${t.name} (copy)`} />))}
      {showSum && <Label position={[bx, lay.titleY, 0.3]} className="pp-tag--sum"><span data-testid={`${tid}sum-title`}>Vector sum<small data-testid={`${tid}sum-caption`}>{chainNow.kind === "para" ? "copies moved to a common origin; directions unchanged" : "copies placed tip to tail; directions unchanged"}</small></span></Label>}
      {mode === "overall" && done && lay.hasChain && net.zero && <Label position={[bx, lay.labelY, 0.5]} className="pp-tag--zero"><span data-testid={`${tid}net-zero`}>Net dipole moment, μ = 0</span></Label>}
      {mode === "overall" && done && net.polar && <Label position={[bx, lay.labelY, 0.5]} className="pp-tag--net"><span data-testid={`${tid}net-label`}>Net dipole moment, μ ≠ 0</span></Label>}
    </group>
  );
}
