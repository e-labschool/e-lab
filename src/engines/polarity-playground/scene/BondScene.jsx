import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Arrow, Atom, Cloud, Label, Stick, atomColor } from "./parts.jsx";
import { useSimClock } from "./Stage.jsx";
import { buildRegions, bondingLens, displayBondLength, electronMarkers, nucleusRadius, regionRadius, PAULING } from "../../shared-3d/electronCloud/index.js";

// Inside a Covalent Bond: the same pair in three views.
//   bond      two atoms, the bond and two conceptual electron markers wandering inside the shared bonding region
//   cloud     the simplified electron-density model: two translucent atomic regions overlapping (Venn style), redistributed for a polar bond
//   polarity  atoms + faint cloud + delta labels + the chemistry dipole arrow (crossed tail on delta+, head towards delta-)
export function orderPair(a, b) { return PAULING[a] <= PAULING[b] ? [a, b] : [b, a]; } // less electronegative on the left
export const VIEW_OPACITY = { bond: 0.2, cloud: 0.62, polarity: 0.3 };

export function PairGroup({ a, b, progress, view, clockRef, offset = 0, scale = 1, tagPrefix = "", showPair = false }) {
  const [L, R] = orderPair(a, b); const d = displayBondLength(L, R);
  const cloud = useRef(null); const m1 = useRef(null); const m2 = useRef(null); const arrow = useRef(null);
  const mark = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff4fd8", depthTest: false, transparent: true }), []);
  useEffect(() => () => mark.dispose(), [mark]);
  const atoms = useMemo(() => [{ el: L, p: [-d / 2, 0, 0] }, { el: R, p: [d / 2, 0, 0] }], [L, R, d]);
  const rMax = Math.max(regionRadius(L), regionRadius(R)); const equal = Math.abs(PAULING[L] - PAULING[R]) < 0.005;
  useFrame(() => {
    const spec = buildRegions({ atoms, bonds: [[0, 1]] }, { progress }); cloud.current?.update(spec);
    const lens = bondingLens(spec, 0, 1); const mk = electronMarkers(clockRef.current.t, lens, Math.min(0.55, rMax * 0.25), 0.62);
    m1.current?.position.set(...mk[0]); m2.current?.position.set(...mk[1]);
    if (m1.current) m1.current.parent.visible = view !== "cloud" || showPair;
    const A = arrow.current; if (A) { A.setVisible(view === "polarity" && !equal && progress > 0.85); if (A.group.visible) A.set([-d / 2, -(rMax + 0.7), 0.3], [d / 2, -(rMax + 0.7), 0.3], 1.3); }
  });
  const nuc = (el) => nucleusRadius(el) * (view === "cloud" ? 1.0 : 1.5);
  const showTags = (view === "polarity" || view === "cloud") && !equal && progress > 0.85;
  return (
    <group position={[offset, 0, 0]} scale={scale} name={`pair-${tagPrefix}${a}${b}`}>
      <Cloud ref={cloud} opacity={VIEW_OPACITY[view]} />
      <Atom color={atomColor(L)} radius={nuc(L)} position={atoms[0].p} name={`atom-${L}`} />
      <Atom color={atomColor(R)} radius={nuc(R)} position={atoms[1].p} name={`atom-${R}`} />
      {view !== "cloud" && <Stick a={atoms[0].p} b={atoms[1].p} radius={0.07} color="#c3cbe0" />}
      <group><mesh ref={m1} material={mark} renderOrder={9}><sphereGeometry args={[0.15, 18, 14]} /></mesh><mesh ref={m2} material={mark} renderOrder={9}><sphereGeometry args={[0.15, 18, 14]} /></mesh></group>
      <Label position={[-d / 2, 0, nuc(L) + 0.1]} className="pp-tag--sym pp-tag--dark">{L}</Label>
      <Label position={[d / 2, 0, nuc(R) + 0.1]} className="pp-tag--sym pp-tag--dark">{R}</Label>
      {showTags && <Label position={[-d / 2, rMax * 0.78, 0.5]} className="pp-tag--plus"><span data-testid={`${tagPrefix}delta-plus`}>δ+</span></Label>}
      {showTags && <Label position={[d / 2, rMax * 0.78, 0.5]} className="pp-tag--minus"><span data-testid={`${tagPrefix}delta-minus`}>δ−</span></Label>}
      {view === "cloud" && showPair && <Label position={[-0.3, -0.95, 0.5]} className="pp-tag--note"><span data-testid={`${tagPrefix}pair-label`}>shared pair (a simplification)</span></Label>}
      <Arrow ref={arrow} color="#f5a300" radius={0.07} headRadius={0.2} crossHalf={0.22} />
    </group>
  );
}

export default function BondScene({ pair, view, progress, reduced, compare, showPair = false }) {
  const clock = useSimClock(reduced);
  const showCompare = compare && !(pair.a === "H" && pair.b === "H");
  return (
    <group>
      {showCompare ? (<>
        <PairGroup a="H" b="H" progress={1} view={view} clockRef={clock} offset={-5.2} scale={0.8} tagPrefix="cmp-" showPair={showPair} />
        <PairGroup a={pair.a} b={pair.b} progress={progress} view={view} clockRef={clock} offset={3.6} scale={0.8} showPair={showPair} />
      </>) : <PairGroup a={pair.a} b={pair.b} progress={progress} view={view} clockRef={clock} offset={0} scale={1} showPair={showPair} />}
    </group>
  );
}
