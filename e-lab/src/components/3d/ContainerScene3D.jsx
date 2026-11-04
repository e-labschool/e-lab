import * as THREE from "three";

const COLOR_A = "#6C86EE"; // Particle A
const COLOR_B = "#E2872F"; // Particle B

function Bond({ from, to }) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const dir = end.clone().sub(start);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.035, 0.035, dir.length(), 8]} />
      <meshStandardMaterial color="#8A909C" />
    </mesh>
  );
}

/**
 * particles: [{ type: "A"|"B", position: [x,y,z] }]
 * bonds: [{ from: [x,y,z], to: [x,y,z] }] — pairs that are chemically
 * bonded (drawn as a connecting rod); unbonded particles in the same
 * scene are simply near each other (a mixture), never connected.
 */
export default function ContainerScene3D({ particles, bonds = [] }) {
  return (
    <group>
      {bonds.map((b, i) => <Bond key={i} from={b.from} to={b.to} />)}
      {particles.map((p, i) => (
        <mesh key={i} position={p.position}>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial color={p.type === "A" ? COLOR_A : COLOR_B} roughness={0.35} />
        </mesh>
      ))}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.6, 1.6, 1.6)]} />
        <lineBasicMaterial color="#8A909C" />
      </lineSegments>
    </group>
  );
}
