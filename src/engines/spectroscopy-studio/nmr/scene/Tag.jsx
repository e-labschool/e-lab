import { Html } from "@react-three/drei";

/** A DOM label anchored in 3D space (crisp text, theme colours). */
export default function Tag({ position, children, color, className = "" }) {
  return (
    <Html position={position} center zIndexRange={[4, 0]} className={`ss-tag ${className}`} style={{ pointerEvents: "none", color }}>
      <span>{children}</span>
    </Html>
  );
}
