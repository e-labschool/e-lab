import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import ThreeCanvas from "./ThreeCanvas.jsx";
import { buildDomains } from "../../lib/vsepr-3d-geometries.js";

const BOND_LENGTH = 1.8;
const ATOM_COLOR = "#6C86EE"; // matches --color-indigo family, mode-independent inside the canvas
const CENTRAL_COLOR = "#EDEEF0";
const LONE_PAIR_COLOR = "#E2872F";

function Atom({ position, color, label, radius = 0.32 }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
      </mesh>
      {label && (
        <Text position={[0, 0, radius + 0.01]} fontSize={0.22} color="#12161C" anchorX="center" anchorY="middle">
          {label}
        </Text>
      )}
    </group>
  );
}

function Bond({ from, to }) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const dir = end.clone().sub(start);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: mid, quaternion: quat, length: len };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[0.06, 0.06, length, 12]} />
      <meshStandardMaterial color="#8A909C" roughness={0.5} />
    </mesh>
  );
}

function LonePairDots({ position }) {
  const dir = new THREE.Vector3(...position).normalize();
  const base = dir.clone().multiplyScalar(BOND_LENGTH * 0.55);
  // Two small dots offset perpendicular to the domain direction, a
  // conventional lone-pair marker rather than a full bonded atom sphere.
  const perp = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  if (perp.lengthSq() < 0.01) perp.set(1, 0, 0);
  const d1 = base.clone().add(perp.clone().multiplyScalar(0.12));
  const d2 = base.clone().add(perp.clone().multiplyScalar(-0.12));
  return (
    <group>
      <mesh position={d1}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color={LONE_PAIR_COLOR} /></mesh>
      <mesh position={d2}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color={LONE_PAIR_COLOR} /></mesh>
    </group>
  );
}

function Scene({ geometry, centralLabel, bondLabels }) {
  const { positions, kinds } = buildDomains(geometry);
  return (
    <>
      <Atom position={[0, 0, 0]} color={CENTRAL_COLOR} label={centralLabel} radius={0.34} />
      {positions.map((dir, i) => {
        const end = dir.map((c) => c * BOND_LENGTH);
        if (kinds[i] === "lonePair") {
          return <LonePairDots key={i} position={end} />;
        }
        return (
          <group key={i}>
            <Bond from={[0, 0, 0]} to={end} />
            <Atom position={end} color={ATOM_COLOR} label={bondLabels?.[i] ?? "X"} />
          </group>
        );
      })}
    </>
  );
}

// A genuine, rotatable 3D molecular-geometry model — real bond angles (see
// vsepr-3d-geometries.js, independently verified), not a stylized
// approximation. `geometry` is any key from GEOMETRY_LIBRARY.
export default function MoleculeViewer3D({ geometry, centralLabel = "A", bondLabels, height = 360 }) {
  return (
    <ThreeCanvas
      height={height}
      cameraDistance={5.5}
      fallbackLabel="3D molecular geometry"
      fallbackDescription={`This device can't render interactive 3D. See the 2D VSEPR diagram in the question/explanation above for the ${geometry} geometry instead.`}
    >
      <Scene geometry={geometry} centralLabel={centralLabel} bondLabels={bondLabels} />
    </ThreeCanvas>
  );
}
