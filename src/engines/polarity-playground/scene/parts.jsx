import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { ChemDipoleArrow, ElectronCloud } from "../../shared-3d/electronCloud/index.js";
import { elementStyle } from "../../shared-3d/elementStyle.js";

const Y = new THREE.Vector3(0, 1, 0);

/** Smooth, glossy atom (physical material lit by the studio environment). */
export function Atom({ color, radius = 0.5, position = [0, 0, 0], opacity = 1, children, name }) {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.9 }), [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => { mat.transparent = opacity < 1; mat.opacity = opacity; mat.needsUpdate = true; }, [mat, opacity]);
  return (
    <mesh position={position} scale={radius} material={mat} name={name}>
      <sphereGeometry args={[1, 48, 32]} />{children}
    </mesh>
  );
}
export const atomColor = (el) => (el === "H" ? "#f4f6fb" : elementStyle(el).color);

/** A stick between two points (smooth cylinder). */
export function Stick({ a, b, radius = 0.09, color = "#cfd6e6", opacity = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const m = ref.current; if (!m) return; const A = new THREE.Vector3(...a); const B = new THREE.Vector3(...b); const d = B.clone().sub(A); const l = d.length() || 1e-6;
    m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y, d.multiplyScalar(1 / l)); m.scale.set(radius, l, radius);
  }, [a, b, radius]);
  return (<mesh ref={ref}><cylinderGeometry args={[1, 1, 1, 20, 1]} /><meshStandardMaterial color={color} roughness={0.4} metalness={0.05} transparent={opacity < 1} opacity={opacity} /></mesh>);
}

/** r3f wrapper of the shared chemistry dipole arrow. Imperative: arrowRef.current.set(plusPos, minusPos, thickness). */
export const Arrow = forwardRef(function Arrow({ color = "#f5a300", radius = 0.065, headRadius = 0.17, crossHalf = 0.17, visible = false, onTop = true }, ref) {
  const { camera } = useThree();
  const arrow = useMemo(() => new ChemDipoleArrow({ color, radius, headRadius, crossHalf, onTop }), [color, radius, headRadius, crossHalf, onTop]);
  useEffect(() => { arrow.setVisible(visible); return () => arrow.dispose(); }, [arrow, visible]);
  useImperativeHandle(ref, () => arrow, [arrow]);
  useFrame(() => { if (arrow.group.visible) { arrow.group.updateMatrixWorld(true); arrow.orientCross(camera); } });
  return <primitive object={arrow.group} />;
});

/** The shared electron cloud as a scene object; `cloudRef.current.update(spec)` each frame. */
export const Cloud = forwardRef(function Cloud({ opacity = 0.55, subdiv = 3 }, ref) {
  const cloud = useMemo(() => new ElectronCloud({ opacity, subdiv }), [subdiv]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cloud.setOpacity(opacity); }, [cloud, opacity]);
  useEffect(() => () => cloud.dispose(), [cloud]);
  useImperativeHandle(ref, () => cloud, [cloud]);
  return <primitive object={cloud.group} />;
});

/** DOM label anchored to a 3D point (crisp text, real DOM so it can be read by assistive tech). */
export function Label({ position, children, className = "", style }) {
  return (<Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none", ...style }}><div className={`pp-tag ${className}`}>{children}</div></Html>);
}
export const ChargeTag = ({ position, sign, name }) => (
  <Label position={position} className={sign > 0 ? "pp-tag--plus" : "pp-tag--minus"}><span data-testid={`charge-${name}`} aria-label={sign > 0 ? `${name} is partially positive` : `${name} is partially negative`}>δ{sign > 0 ? "+" : "−"}</span></Label>
);
