import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import GuardedFrame from "../../shared-3d/GuardedFrame.jsx";
import CameraKeyApi from "../../shared-3d/CameraKeyApi.jsx";
import StudioLighting from "../../shared-3d/StudioLighting.jsx";

// ONE 3D stage for the three 3D tabs. Transparent canvas (the bright gradient is CSS), studio light, a camera that always fits the
// requested world box, optional orbit controls with the shared keyboard alternative (arrows rotate, +/- zoom, 0 resets).
/** Test / verification hooks: globalThis.__PP_DT_MAX caps the per-frame step (software GL runs ~1 fps, so a test raises it);
 *  globalThis.__PP_SEEK = seconds jumps every running animation clock once. */
export const maxDt = () => globalThis.__PP_DT_MAX ?? 0.05;
export function useSimClock(reduced) {
  const clock = useRef({ t: 0, dt: 0 });
  useFrame((_, delta) => {
    const c = clock.current; const seek = globalThis.__PP_SEEK;
    if (typeof seek === "number") { c.t = seek; globalThis.__PP_SEEK = undefined; c.dt = 0; return; }
    c.dt = Math.min(delta, maxDt()); c.t += reduced ? 0 : c.dt;
  }, -1);
  return clock;
}

function FitCamera({ width, height, tilt, orbit, home, center }) {
  const cx = center?.[0] ?? 0; const cy = center?.[1] ?? 0;
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const t = Math.tan((camera.fov * Math.PI) / 360); const asp = size.width / Math.max(1, size.height);
    const d = Math.max(height / 2 / t, width / 2 / (t * asp)) * 1.04;
    const y = Math.sin(tilt) * d; const z = Math.cos(tilt) * d;
    camera.position.set(cx, cy + y, z); camera.lookAt(cx, cy, 0); camera.near = 0.1; camera.far = d * 6; camera.updateProjectionMatrix();
    if (orbit?.current) { orbit.current.target.set(cx, cy, 0); orbit.current.minDistance = d * 0.45; orbit.current.maxDistance = d * 2.2; orbit.current.update(); }
    home.current = [cx, cy + y, z]; invalidate();
  }, [camera, size.width, size.height, width, height, tilt, orbit, home, invalidate, cx, cy]);
  return null;
}

export default function Stage({ testId, ariaLabel, width = 12, height = 6, tilt = 0.06, orbit = false, center, reduced = false, fallback, children, onReset, resetKey = 0, className = "pp-stage" }) {
  const controls = useRef(null); const home = useRef([0, 0, 10]);
  return (
    <GuardedFrame className={className} testId={testId} ariaLabel={ariaLabel} fallback={fallback} onReset={onReset}
      render={({ canvasKey, aa, camRef }) => (
        <Canvas key={`${canvasKey}-${resetKey}`} frameloop={reduced ? "demand" : "always"} dpr={[1, 2]} gl={{ antialias: aa, alpha: true, powerPreference: "default" }} camera={{ fov: 30, position: [0, 0, 12] }} style={{ position: "absolute", inset: 0 }}>
          <StudioLighting />
          <FitCamera width={width} height={height} tilt={tilt} orbit={controls} home={home} center={center} />
          {orbit && <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.12} rotateSpeed={0.8} />}
          <CameraKeyApi apiRef={camRef} />
          {children}
        </Canvas>
      )}
    />
  );
}
