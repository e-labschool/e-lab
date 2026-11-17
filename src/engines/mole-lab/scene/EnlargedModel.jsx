import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { particleModel, atomColour, atomTextColour } from "../engine/particles.js";
import { getSubstance } from "../engine/substances.js";
import { rockSaltFragment, bccFragment, hcpFragment, angleAt } from "../engine/geometry.js";

const SPHERE = new THREE.SphereGeometry(1, 28, 20); const CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
const UP = new THREE.Vector3(0, 1, 0);

function Atom({ el, p, r, charge, label, dark }) {
  return (
    <group position={p}>
      <mesh geometry={SPHERE} scale={r}><meshPhysicalMaterial color={atomColour(el)} roughness={0.25} clearcoat={0.7} clearcoatRoughness={0.15} metalness={el === "Fe" || el === "Mg" || el === "Na" ? 0.2 : 0} envMapIntensity={1} /></mesh>
      {label && <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}><span className="ml-atom-tag" style={{ color: atomTextColour(el), background: atomColour(el) + "dd" }} data-dark={dark ? "1" : "0"}>{label}{charge ? <sup>{charge > 0 ? (charge === 1 ? "+" : `${charge}+`) : (charge === -1 ? "−" : `${-charge}−`)}</sup> : null}</span></Html>}
    </group>
  );
}
function Bond({ a, b, order }) {
  const { pos, quat, len } = useMemo(() => { const A = new THREE.Vector3(...a); const B = new THREE.Vector3(...b); const d = B.clone().sub(A); const len = d.length(); return { pos: A.clone().add(B).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), len }; }, [a, b]);
  const perp = useMemo(() => new THREE.Vector3().crossVectors(new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), new THREE.Vector3(0.3, 0.8, 0.5)).normalize(), [a, b]);
  const offs = order === 1 ? [0] : order === 2 ? [-0.5, 0.5] : [-1, 0, 1];
  return <>{offs.map((o) => <mesh key={o} geometry={CYL} position={pos.clone().addScaledVector(perp, o * 0.13)} quaternion={quat} scale={[order > 1 ? 0.055 : 0.08, len, order > 1 ? 0.055 : 0.08]}><meshStandardMaterial color="#b7bfd0" roughness={0.4} /></mesh>)}</>;
}

/** Big ball-and-stick (or lattice fragment) of ONE representative entity, with element labels.  `scale` sets the on-screen size. */
export default function EnlargedModel({ substanceId, speciesIndex = 0, position, scale = 0.95, reduced, dark }) {
  const s = getSubstance(substanceId); const model = useMemo(() => particleModel(substanceId), [substanceId]);
  const group = useRef();
  useFrame((_, dt) => { if (group.current && !reduced) group.current.rotation.y += dt * 0.35; });
  useEffect(() => { if (group.current) group.current.rotation.y = reduced ? 0.35 : group.current.rotation.y; }, [reduced]);
  let body;
  if (model.mode === "molecular") {
    const ent = model.entities[0]; const g = s.geometry;
    const P = ent.atoms.map((a) => [a.x, a.y, a.z]);
    body = <>
      {ent.bonds.map((b, i) => <Bond key={i} a={P[b.a]} b={P[b.b]} order={b.order} />)}
      {ent.atoms.map((a, i) => <Atom key={i} el={a.el} p={P[i]} r={Math.max(0.18, a.r * 0.9)} label={a.el} dark={dark} />)}
      {g.atoms.length === 3 && g.atoms[0] && g.angleDeg ? <Html position={[0, -0.05, 0.35]} center style={{ pointerEvents: "none" }}><span className="ml-angle-tag">{Math.round(angleAt(g.atoms, 1, 0, 2) * 10) / 10}°</span></Html> : null}
    </>;
  } else {
    const frag = s.lattice?.type === "bcc" ? bccFragment(1) : s.lattice?.type === "hcp" ? hcpFragment(3, 2, 2) : rockSaltFragment(3, 3, 3);
    const c = frag.reduce((a, p) => [a[0] + p.x / frag.length, a[1] + p.y / frag.length, a[2] + p.z / frag.length], [0, 0, 0]); const k = 0.62; // lattice units -> scene units
    const ions = model.entities;
    body = <>{frag.map((p, i) => { const e = ions[Math.min(p.species, ions.length - 1)]; const r = model.mode === "ionic" ? e.atoms[0].r * 0.5 * 0.9 : 0.36; const pos = [(p.x - c[0]) * k, (p.y - c[1]) * k, (p.z - c[2]) * k];
      return e.atoms.length === 1 ? <Atom key={i} el={e.atoms[0].el} p={pos} r={r} /> : <group key={i} position={pos}>{e.atoms.map((a, j) => <Atom key={j} el={a.el} p={[a.x * 0.2, a.y * 0.2, a.z * 0.2]} r={Math.max(0.1, a.r * 0.2)} />)}</group>; })}</>;
  }
  return <group position={position} scale={scale}><group ref={group} rotation={[0.18, 0.5, 0]}>{body}</group></group>;
}
