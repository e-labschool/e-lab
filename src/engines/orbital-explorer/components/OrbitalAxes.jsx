import { useMemo } from "react";
import * as THREE from "three";

// Permanent x/y/z coordinate axes through the nucleus (always at the
// origin, matching every orbital/boundary in this scene). Built from
// plain meshes (cylinder shaft + cone arrowhead) -- ordinary scene
// objects, so the shafts/arrowheads rotate together with the rest of
// the scene exactly because OrbitControls orbits the CAMERA, not the
// scene: nothing here needs its own rotation logic.
//
// Labels are hand-drawn onto a small canvas texture and shown as a
// THREE.Sprite (always faces the camera, by definition of a sprite) --
// deliberately NOT drei's <Text>, which loads its glyph font from a
// remote CDN: a label this small and permanent shouldn't depend on a
// network fetch succeeding, and a sprite text renders instantly using
// whatever font the browser already has. Needed so students can read
// p_x/p_y/p_z and d-orbital orientation correctly from any angle.
const SHAFTS = [
  { axis: "x", color: "#FF5252", rotation: [0, 0, -Math.PI / 2] },
  { axis: "y", color: "#4CD164", rotation: [0, 0, 0] },
  { axis: "z", color: "#4FC3F7", rotation: [Math.PI / 2, 0, 0] },
];

const LABEL_POS = {
  x: (d) => [d, 0, 0],
  y: (d) => [0, d, 0],
  z: (d) => [0, 0, d],
};

function makeLabelTexture(text, color) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.font = "bold 84px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#0A0E1A";
  ctx.strokeText(text, size / 2, size / 2 + 6);
  ctx.fillStyle = color;
  ctx.fillText(text, size / 2, size / 2 + 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function AxisLabel({ axis, color, distance }) {
  const texture = useMemo(() => makeLabelTexture(axis, color), [axis, color]);
  const pos = LABEL_POS[axis](distance);
  const spriteScale = distance * 0.13;
  return (
    <sprite position={pos} scale={[spriteScale, spriteScale, spriteScale]} renderOrder={11}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

export default function OrbitalAxes({ length = 6 }) {
  const shaftLen = length * 0.92;
  const headLen = length * 0.08;
  const shaftRadius = length * 0.006;
  const headRadius = length * 0.022;

  return (
    <group renderOrder={10}>
      {SHAFTS.map(({ axis, color, rotation }) => (
        <group key={axis} rotation={rotation}>
          {/* shaft, centered along local +Y from the origin */}
          <mesh position={[0, shaftLen / 2, 0]}>
            <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLen, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.55} depthTest={false} />
          </mesh>
          {/* arrowhead */}
          <mesh position={[0, shaftLen + headLen / 2, 0]}>
            <coneGeometry args={[headRadius, headLen, 12]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} depthTest={false} />
          </mesh>
        </group>
      ))}

      {SHAFTS.map(({ axis, color }) => (
        <AxisLabel key={`label-${axis}`} axis={axis} color={color} distance={length * 0.98} />
      ))}
    </group>
  );
}
