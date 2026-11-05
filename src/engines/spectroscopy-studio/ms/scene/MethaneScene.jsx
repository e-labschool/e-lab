import { useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { GEOMETRIES, ATOM_STYLE } from "./glyphs.js";
import { useFitZoom } from "../../nmr/scene/useFitZoom.js";

const Y = new THREE.Vector3(0, 1, 0);
const SCALE = 1.35; // angstrom -> scene units
const BOND_R = 0.075;

/** Rotating ball-and-stick methane (spheres + bonds). Atom colours match the SVG glyphs: carbon grey-blue, hydrogen white. */
export default function MethaneScene({ rotate = true, speed = 1 }) {
  useFitZoom(1.1);
  const g = GEOMETRIES.ch4;
  const pos = useMemo(() => g.atoms.map((a) => new THREE.Vector3(...a.p).multiplyScalar(SCALE)), [g]);
  const bonds = useMemo(() => g.bonds.map(([i, j]) => {
    const a = pos[i]; const b = pos[j]; const d = b.clone().sub(a); const len = d.length();
    return { mid: a.clone().add(b).multiplyScalar(0.5).toArray(), quat: new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), len };
  }), [g, pos]);
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, -4, 5]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.45} />
      <group>
        {bonds.map((b, i) => (
          <mesh key={`b${i}`} position={b.mid} quaternion={b.quat} scale={[BOND_R, b.len, BOND_R]}><cylinderGeometry args={[1, 1, 1, 14]} /><meshStandardMaterial color="#aab6d6" roughness={0.5} metalness={0.05} /></mesh>
        ))}
        {g.atoms.map((a, i) => (
          <mesh key={`a${i}`} position={pos[i].toArray()} scale={ATOM_STYLE[a.el].r * SCALE * 1.15}>
            <sphereGeometry args={[1, 36, 24]} /><meshStandardMaterial color={a.el === "C" ? "#9aa8cc" : "#f4f7ff"} roughness={0.35} metalness={0.05} emissive={a.el === "C" ? "#33405f" : "#7d8bb0"} emissiveIntensity={0.18} />
          </mesh>
        ))}
      </group>
      <OrbitControls makeDefault enablePan={false} autoRotate={rotate} autoRotateSpeed={2.4 * speed} enableDamping dampingFactor={0.12} minDistance={3.4} maxDistance={10} />
    </>
  );
}
