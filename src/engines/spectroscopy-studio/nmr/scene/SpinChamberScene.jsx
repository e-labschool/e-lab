import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Arrow3D from "../../components/Arrow3D.jsx";
import Tag from "./Tag.jsx";
import { arrowDirection, assignStates, makeEnsemble } from "../physics/spinEnsemble.js";

const Y = new THREE.Vector3(0, 1, 0);
const COLORS = { alpha: new THREE.Color("#2dd4bf"), beta: new THREE.Color("#a78bfa"), free: new THREE.Color("#c7d2ea"), sel: new THREE.Color("#ffffff") };
export const ENSEMBLE = makeEnsemble(160);
const LEN = 0.42;

/**
 * The chamber of nuclei. All animation runs inside the frame loop on refs (no React render per frame):
 *   apply (0..1, field switched on), phase source (precession, display clock), view, shown polarisation, M0 arrow length.
 * `live` is a mutable object { apply, phase, view, polarization, spin } updated by the parent every tick; `selected` is the inspected nucleus.
 */
export default function SpinChamberScene({ live, selected, onSelect, showArrows = true, labels = true }) {
  const shaft = useRef(); const head = useRef();
  const ens = ENSEMBLE;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const [fieldOpacity, setFieldOpacity] = useState(0);
  const [m0Len, setM0Len] = useState(0);
  const lastKey = useRef("");

  useLayoutEffect(() => {
    for (let i = 0; i < ens.n; i += 1) { shaft.current?.setColorAt(i, COLORS.free); head.current?.setColorAt(i, COLORS.free); }
    if (shaft.current?.instanceColor) shaft.current.instanceColor.needsUpdate = true;
    if (head.current?.instanceColor) head.current.instanceColor.needsUpdate = true;
  }, [ens]);

  useFrame(() => {
    const s = shaft.current; const h = head.current; if (!s || !h) return;
    const { apply, phase, view, polarization } = live.current;
    const st = assignStates(ens, polarization);
    const key = `${apply > 0.02}|${view}|${polarization}|${selected}|${st.nAlpha}`;
    for (let i = 0; i < ens.n; i += 1) {
      const d = arrowDirection(ens, i, st.alpha[i], { apply, phase, view });
      q.setFromUnitVectors(Y, dummy.position.set(d[0], d[1], d[2]));
      const p = ens.pos[i]; const isSel = i === selected; const sc = isSel ? 1.5 : 1;
      // shaft: from the arrow tail, 0.7 of the length;  head: the last 0.3
      dummy.quaternion.copy(q); dummy.scale.set(sc, sc, sc);
      dummy.position.set(p[0] + d[0] * LEN * 0.35, p[1] + d[1] * LEN * 0.35, p[2] + d[2] * LEN * 0.35); dummy.updateMatrix(); s.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p[0] + d[0] * LEN * 0.85, p[1] + d[1] * LEN * 0.85, p[2] + d[2] * LEN * 0.85); dummy.updateMatrix(); h.setMatrixAt(i, dummy.matrix);
    }
    s.instanceMatrix.needsUpdate = true; h.instanceMatrix.needsUpdate = true;
    if (key !== lastKey.current) { // recolour only when the assignment changes
      lastKey.current = key;
      for (let i = 0; i < ens.n; i += 1) {
        const c = i === selected ? COLORS.sel : apply > 0.02 ? (st.alpha[i] ? COLORS.alpha : COLORS.beta) : COLORS.free;
        s.setColorAt(i, c); h.setColorAt(i, c);
      }
      if (s.instanceColor) s.instanceColor.needsUpdate = true; if (h.instanceColor) h.instanceColor.needsUpdate = true;
    }
    const fo = Math.min(1, apply * 1.4); if (Math.abs(fo - fieldOpacity) > 0.02) setFieldOpacity(fo);
    const len = live.current.m0Length * Math.min(1, Math.max(0, (apply - 0.5) * 2));
    if (Math.abs(len - m0Len) > 0.01) setM0Len(len < 0.012 ? 0 : len);
  });

  const z = [0, 0, 1];
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, -4, 5]} intensity={1.1} />
      <mesh>
        <sphereGeometry args={[1.62, 40, 28]} />
        <meshStandardMaterial color="#60a5fa" transparent opacity={0.06} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.62, 24, 16]} />
        <meshBasicMaterial color="#7aa2f7" wireframe transparent opacity={0.1} />
      </mesh>
      {showArrows && (
        <>
          <instancedMesh ref={shaft} args={[undefined, undefined, ens.n]} frustumCulled={false} onClick={(e) => { e.stopPropagation(); onSelect?.(e.instanceId); }}>
            <cylinderGeometry args={[0.018, 0.018, LEN * 0.7, 6]} /><meshStandardMaterial roughness={0.5} emissiveIntensity={0.3} />
          </instancedMesh>
          <instancedMesh ref={head} args={[undefined, undefined, ens.n]} frustumCulled={false} onClick={(e) => { e.stopPropagation(); onSelect?.(e.instanceId); }}>
            <coneGeometry args={[0.055, LEN * 0.3, 10]} /><meshStandardMaterial roughness={0.5} emissiveIntensity={0.3} />
          </instancedMesh>
        </>
      )}
      <group visible={fieldOpacity > 0.02}>
        {[[-2.4, 0.9], [2.4, 0.9], [0, 2.7], [-1.7, 2.2], [1.7, 2.2], [-2.5, -0.7], [2.5, -0.7]].map(([x, y], i) => (
          <Arrow3D key={i} from={[x, y, -1.7]} dir={z} length={3.4} color="#38bdf8" radius={0.012} head={0.2} headRadius={0.05} opacity={0.38 * fieldOpacity} depthTest={false} />
        ))}
        {labels && <Tag position={[2.5, -0.7, 1.95]} color="#7dd3fc">B₀ (static field)</Tag>}
      </group>
      {m0Len > 0 && <Arrow3D from={[0, 0, -m0Len / 2]} dir={z} length={m0Len} color="#fcd34d" radius={0.06} head={0.28} headRadius={0.16} depthTest={false} />}
      {m0Len > 0 && labels && <Tag position={[0.35, 0, m0Len / 2 + 0.3]} color="#fde68a">M₀ (net)</Tag>}
      <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={10} />
    </>
  );
}
