import * as THREE from "three";

// Distribution patterns are the whole point here — NOT states of matter,
// so this is deliberately a separate scene from ParticleBox3D. Each
// mixture type gets a scientifically distinct arrangement:
// - dissolved: solute particles spread evenly throughout (homogeneous)
// - settled: solid particles clustered near the bottom (heterogeneous,
//   capable of settling)
// - layered: two immiscible liquids occupying separate vertical bands
//   (heterogeneous, visibly separate phases)
const SOLVENT_COLOR = "#8FB4E8";
const SOLUTE_COLOR = "#6C86EE";
const SAND_COLOR = "#C9A876";
const OIL_COLOR = "#E2872F";

function seededGrid(count, spreadX, spreadZ, yFn, seedOffset = 0) {
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    // Deterministic (not Math.random) pseudo-scatter — keeps the scene
    // identical across re-renders instead of reshuffling every mount.
    const a = Math.sin((i + seedOffset) * 12.9898) * 43758.5453;
    const b = Math.sin((i + seedOffset) * 78.233) * 12543.548;
    const rx = (a - Math.floor(a) - 0.5) * spreadX;
    const rz = (b - Math.floor(b) - 0.5) * spreadZ;
    positions.push([rx, yFn(i, count), rz]);
  }
  return positions;
}

const MIXTURES = {
  "salt-water": {
    solventCount: 40,
    solute: { count: 14, color: SOLUTE_COLOR, positions: (n) => seededGrid(n, 1.3, 1.3, () => (Math.sin(1) - 0.5) * 1.3, 5) },
  },
  "sand-water": {
    solventCount: 40,
    solute: { count: 12, color: SAND_COLOR, positions: (n) => seededGrid(n, 1.2, 1.2, () => -0.55, 9) }, // settled at the bottom
  },
  "oil-water": {
    solventCount: 24,
    solute: { count: 20, color: OIL_COLOR, positions: (n) => seededGrid(n, 1.3, 1.3, () => 0.55, 13) }, // layered on top
    solventYOffset: -0.3,
  },
};

export default function MixtureBeakerScene3D({ mixture = "salt-water" }) {
  const config = MIXTURES[mixture];
  const solventPositions = seededGrid(config.solventCount, 1.4, 1.4, (i, n) => {
    const base = -0.7 + (i / n) * 1.4;
    return base * 0.6 + (config.solventYOffset ?? 0);
  }, 1);
  const solutePositions = config.solute.positions(config.solute.count);

  return (
    <group>
      {/* Beaker walls */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[1, 1, 1.7, 32, 1, true]} />
        <meshStandardMaterial color="#8A909C" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments position={[0, -0.05, 0]}>
        <edgesGeometry args={[new THREE.CylinderGeometry(1, 1, 1.7, 24)]} />
        <lineBasicMaterial color="#8A909C" transparent opacity={0.4} />
      </lineSegments>

      {solventPositions.map((p, i) => (
        <mesh key={`solvent-${i}`} position={p}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color={SOLVENT_COLOR} transparent opacity={0.85} />
        </mesh>
      ))}
      {solutePositions.map((p, i) => (
        <mesh key={`solute-${i}`} position={p}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={config.solute.color} />
        </mesh>
      ))}
    </group>
  );
}
