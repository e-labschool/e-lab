import { useMemo } from "react";
import * as THREE from "three";

export const BOX_SIZE = 3.2;
export const HALF = BOX_SIZE / 2;

const EDGE_RADIUS = 0.008; // thin elegant frame, not a thick wireframe cube

// The 12 edges of a BOX_SIZE cube, as [start, end] corner pairs.
function buildEdgeSegments() {
  const h = HALF;
  const corners = [
    [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
    [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],
  ];
  const pairs = [
    [0, 1], [1, 2], [2, 3], [3, 0], // back face
    [4, 5], [5, 6], [6, 7], [7, 4], // front face
    [0, 4], [1, 5], [2, 6], [3, 7], // connecting edges
  ];
  return pairs.map(([a, b]) => [new THREE.Vector3(...corners[a]), new THREE.Vector3(...corners[b])]);
}

function EdgeBar({ start, end }) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: mid, quaternion: quat, length: len };
  }, [start, end]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[EDGE_RADIUS, EDGE_RADIUS, length, 8]} />
      <meshStandardMaterial color="#AEC0E8" emissive="#3A4A78" emissiveIntensity={0.35} roughness={0.3} metalness={0.4} />
    </mesh>
  );
}

/**
 * A real transparent glass observation chamber rather than a wireframe
 * cube: a thin cylindrical edge frame (not flat 1px lines, so it actually
 * catches light), glass side/front walls with transmission + clearcoat for
 * subtle refraction and reflections, and a slightly more frosted base
 * panel so the chamber reads as a physical instrument with a floor —
 * visible front, side and base surfaces through the perspective.
 */
export default function ChamberWalls() {
  const edges = useMemo(() => buildEdgeSegments(), []);

  return (
    <group>
      {edges.map(([a, b], i) => (
        <EdgeBar key={i} start={a} end={b} />
      ))}

      {/* glass walls (sides + front + back) */}
      <mesh>
        <boxGeometry args={[BOX_SIZE, BOX_SIZE, BOX_SIZE]} />
        <meshPhysicalMaterial
          color="#1E2740"
          transparent
          opacity={0.05}
          roughness={0.045}
          transmission={0.94}
          thickness={0.45}
          ior={1.45}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
          depthWrite={false}
        />
      </mesh>

      {/* base panel — subtly frosted so the chamber reads as an instrument
          with a physical floor, distinct from the clear glass walls */}
      <mesh position={[0, -HALF + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOX_SIZE, BOX_SIZE]} />
        <meshPhysicalMaterial
          color="#141A2A"
          transparent
          opacity={0.4}
          roughness={0.55}
          transmission={0.35}
          clearcoat={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
