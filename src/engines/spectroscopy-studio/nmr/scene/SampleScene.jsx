import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Arrow3D from "../../components/Arrow3D.jsx";
import Tag from "./Tag.jsx";
import { makeEnsemble } from "../physics/spinEnsemble.js";

const Y = new THREE.Vector3(0, 1, 0);
const N = 110;
const ENS = makeEnsemble(N, 77);
const ease = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

/**
 * Step 1. ONE large hydrogen nucleus with its magnetic-moment arrow, which morphs into a CONCEPTUAL ensemble of many nuclei
 * (translucent spheres, each with a headless line for the direction of its own moment: no arrowheads, so it is not mistaken for B0 or M).
 * `live.current = { p, phase }`: p 0..1 morph progress, phase = ambient display seconds (slow tumbling of the lines). All motion is in the frame loop.
 * The sphere is a deliberately fuzzy "nucleus here" marker; the nucleus does not spin like a ball (the panel says so).
 */
export default function SampleScene({ live, labels = true, single = true }) {
  const spheres = useRef(); const lines = useRef(); const big = useRef(); const bigCore = useRef(); const arrow = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const w = useMemo(() => Array.from({ length: N }, (_, i) => ({ a: 0.35 + ((i * 37) % 11) * 0.05, b: 0.3 + ((i * 53) % 13) * 0.04, c: 0.4 + ((i * 29) % 7) * 0.06, p: i * 1.7 })), []);
  const mu0 = useMemo(() => new THREE.Vector3(0.42, 0.18, 0.89).normalize(), []);

  useFrame(() => {
    const { p, phase } = live.current; const e = ease(p);
    const s = spheres.current; const l = lines.current; if (!s || !l) return;
    for (let i = 0; i < N; i += 1) {
      const pos = ENS.pos[i]; const k = e;
      const sc = 0.02 + 0.1 * k;
      dummy.position.set(pos[0] * k * 1.25, pos[1] * k * 1.25, pos[2] * k * 1.25); dummy.quaternion.identity(); dummy.scale.set(sc, sc, sc); dummy.updateMatrix(); s.setMatrixAt(i, dummy.matrix);
      const d0 = ENS.dir0[i]; const ww = w[i];
      v.set(d0[0] + 0.5 * Math.sin(phase * ww.a + ww.p), d0[1] + 0.5 * Math.sin(phase * ww.b + ww.p * 1.3), d0[2] + 0.5 * Math.sin(phase * ww.c + ww.p * 0.7)).normalize();
      q.setFromUnitVectors(Y, v);
      const ls = k < 0.05 ? 0.0001 : 1;
      dummy.quaternion.copy(q); dummy.scale.set(ls, ls * (0.4 + 0.6 * k), ls); dummy.updateMatrix(); l.setMatrixAt(i, dummy.matrix);
    }
    s.instanceMatrix.needsUpdate = true; l.instanceMatrix.needsUpdate = true;
    if (big.current) { const f = 1 - ease(Math.min(1, p * 1.6)); big.current.scale.setScalar(Math.max(0.0001, f)); big.current.visible = f > 0.01; }
    if (bigCore.current) { const f = 1 - ease(Math.min(1, p * 1.6)); bigCore.current.scale.setScalar(Math.max(0.0001, f * (1 + 0.04 * Math.sin(phase * 2)))); bigCore.current.visible = f > 0.01; }
    if (arrow.current) { const f = 1 - ease(Math.min(1, p * 2.2)); arrow.current.visible = f > 0.02; arrow.current.scale.setScalar(Math.max(0.0001, f)); }
  });

  const dir = [mu0.x, mu0.y, mu0.z]; const len = 1.7;
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, -4, 5]} intensity={1.2} />
      <mesh ref={big}>
        <sphereGeometry args={[0.62, 40, 28]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.24} roughness={0.9} depthWrite={false} />
      </mesh>
      <mesh ref={bigCore}>
        <sphereGeometry args={[0.34, 32, 22]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.42} roughness={1} depthWrite={false} />
      </mesh>
      <group ref={arrow}>
        <Arrow3D dir={dir} length={len} color="#fcd34d" radius={0.045} head={0.3} headRadius={0.12} />
      </group>
      <instancedMesh ref={spheres} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#7dd3fc" transparent opacity={0.3} roughness={0.9} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={lines} args={[undefined, undefined, N]} frustumCulled={false}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 5]} /><meshBasicMaterial color="#fde68a" />
      </instancedMesh>
      {labels && single && <Tag position={[0.78, -0.1, -0.78]} color="#bae6fd">proton (¹H nucleus)</Tag>}
      {labels && single && <Tag position={[dir[0] * len * 1.1, dir[1] * len * 1.1, dir[2] * len * 1.1 + 0.15]} color="#fde68a">μ (magnetic moment)</Tag>}
      <OrbitControls makeDefault enablePan={false} minDistance={2.6} maxDistance={9} />
    </>
  );
}
