import { useMemo } from "react";
import * as THREE from "three";

const Y = new THREE.Vector3(0, 1, 0);
/** An arrow (cylinder shaft + cone head) from `from` along unit direction `dir` with the given length. Used for B0, B1, M, mu ... */
export default function Arrow3D({ from = [0, 0, 0], dir = [0, 0, 1], length = 1, color = "#ffffff", radius = 0.025, head = 0.16, headRadius, opacity = 1, dashed = false, depthTest = true }) {
  const q = useMemo(() => {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]); if (d.lengthSq() < 1e-12) return new THREE.Quaternion();
    return new THREE.Quaternion().setFromUnitVectors(Y, d.normalize());
  }, [dir[0], dir[1], dir[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const L = Math.max(0.0001, length); const h = Math.min(head, L * 0.6); const shaft = Math.max(0.0001, L - h);
  const transparent = opacity < 1;
  return (
    <group position={from} quaternion={q}>
      {dashed ? (
        Array.from({ length: Math.max(1, Math.floor(shaft / 0.1)) }, (_, i) => (
          <mesh key={i} position={[0, 0.05 + i * 0.1, 0]}><cylinderGeometry args={[radius, radius, 0.05, 8]} /><meshBasicMaterial color={color} transparent={transparent} opacity={opacity} depthTest={depthTest} /></mesh>
        ))
      ) : (
        <mesh position={[0, shaft / 2, 0]}><cylinderGeometry args={[radius, radius, shaft, 10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent={transparent} opacity={opacity} depthTest={depthTest} /></mesh>
      )}
      <mesh position={[0, shaft + h / 2, 0]}><coneGeometry args={[headRadius ?? radius * 3.2, h, 14]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent={transparent} opacity={opacity} depthTest={depthTest} /></mesh>
    </group>
  );
}
