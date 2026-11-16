import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { orbitPosition } from "./stageKeys.js";

/** Render inside a <Canvas> that has <OrbitControls makeDefault>: fills `apiRef.current = { orbit(az, pol), zoom(factor) }`
 *  so the stage's DOM key handler (see StageShell) can drive the SAME camera as the mouse.  Works for demand and always frame loops. */
export default function CameraKeyApi({ apiRef }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    const home = { pos: [camera.position.x, camera.position.y, camera.position.z], target: controls?.target ? [controls.target.x, controls.target.y, controls.target.z] : [0, 0, 0] };
    apiRef.current = {
      reset() { camera.position.set(home.pos[0], home.pos[1], home.pos[2]); controls?.target?.set?.(home.target[0], home.target[1], home.target[2]); camera.lookAt(home.target[0], home.target[1], home.target[2]); controls?.update?.(); invalidate(); },
      orbit(az, pol) {
        const t = controls?.target ? [controls.target.x, controls.target.y, controls.target.z] : [0, 0, 0];
        const p = orbitPosition([camera.position.x, camera.position.y, camera.position.z], t, az, pol);
        camera.position.set(p[0], p[1], p[2]); camera.lookAt(t[0], t[1], t[2]); controls?.update?.(); invalidate();
      },
      zoom(f) {
        const t = controls?.target ?? { x: 0, y: 0, z: 0 };
        const dx = camera.position.x - t.x, dy = camera.position.y - t.y, dz = camera.position.z - t.z; const d = Math.hypot(dx, dy, dz) || 1;
        const nd = Math.min(controls?.maxDistance ?? 1e9, Math.max(controls?.minDistance ?? 0.5, d * f)); const k = nd / d;
        camera.position.set(t.x + dx * k, t.y + dy * k, t.z + dz * k); controls?.update?.(); invalidate();
      },
      distance() { return camera.position.length(); },
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, controls, invalidate]);
  return null;
}
