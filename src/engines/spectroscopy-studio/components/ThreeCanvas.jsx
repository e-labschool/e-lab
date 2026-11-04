import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Box } from "lucide-react";
import { detectWebGL, isSoftwareGL } from "./webgl.js";

/** r3f canvas with a graceful fallback when WebGL is missing (jsdom, locked-down browsers): the controls, readouts and 2D views still work.
 * z is "up" in every scene of this lab (B0 along +z), so the camera up vector is set here. */
export default function ThreeCanvas({ children, position = [3.2, -3.6, 2.2], fov = 38, frameloop = "always", fallback, testId = "three-canvas", label }) {
  const webgl = useMemo(() => detectWebGL(), []);
  const aa = useMemo(() => !isSoftwareGL(), []);
  const camera = useMemo(() => ({ position, up: [0, 0, 1], fov, near: 0.1, far: 100 }), [position, fov]);
  const gl = useMemo(() => ({ antialias: aa, alpha: true, powerPreference: "low-power" }), [aa]);
  if (!webgl) {
    return (
      <div className="ss-nogl" data-testid="webgl-fallback" role="status">
        <Box size={24} aria-hidden="true" />
        <p><b>3D view unavailable on this device.</b></p>
        <p>{fallback ?? "WebGL is not available, so the 3D picture cannot be drawn. The controls, numbers, graphs and explanations still work."}</p>
      </div>
    );
  }
  return (
    <div className="ss-three" data-testid={testId} role="img" aria-label={label}>
      <Canvas flat dpr={[1, 1.75]} camera={camera} frameloop={frameloop} gl={gl} style={{ touchAction: "none" }} resize={{ scroll: false }}>
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}
