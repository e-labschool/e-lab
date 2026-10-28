import { useMemo } from "react";
import * as THREE from "three";

/** Faint unit-cell outlines (cubic structures) so the regular arrangement of the cores is easy to see. */
export default function CellGrid({ edge }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(edge, edge, edge)), [edge]);
  const offs = [-0.5, 0.5];
  return (
    <group>
      {offs.flatMap((x) => offs.flatMap((y) => offs.map((z) => (
        <lineSegments key={`${x}${y}${z}`} geometry={geo} position={[x * edge, y * edge, z * edge]}>
          <lineBasicMaterial color="#7f95c0" transparent opacity={0.55} />
        </lineSegments>
      ))))}
    </group>
  );
}
