import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Box } from "lucide-react";
import CubeScene from "./CubeScene.jsx";
import { detectWebGL, isSoftwareGL } from "./webgl.js";

/** Container + canvas for the transparent heating cube (a separate canvas from the two-molecule workspace). */
export default function CubeStage({ simRef, revision, compare, ariaLabel, children, onApi }) {
  const apiRef = useRef(null); const webgl = useMemo(() => detectWebGL(), []); const aa = useMemo(() => !isSoftwareGL(), []);
  const setEl = (el) => { if (el) { el.__imfCube = { api: () => apiRef.current, sim: () => simRef.current }; onApi?.(apiRef); } };
  return (
    <div ref={setEl} className="imf-stage imf-stage--cube" role="img" aria-label={ariaLabel} data-testid="imf-cube-stage" tabIndex={0}>
      {webgl ? (
        <Canvas flat dpr={[1, 1.75]} frameloop="always" camera={{ fov: 36, near: 0.5, far: 160, position: [0, 3.2, 12.5] }} gl={{ antialias: aa, alpha: true, powerPreference: "low-power" }} style={{ touchAction: "none" }} resize={{ scroll: false }}>
          <CubeScene simRef={simRef} apiRef={apiRef} revision={revision} compare={compare} />
        </Canvas>
      ) : (
        <div className="imf-nogl" data-testid="webgl-fallback" role="status"><Box size={22} aria-hidden="true" /><p><b>3D view unavailable on this device.</b></p><p>The temperature, phase readout and heating curve still update as you heat and cool.</p></div>
      )}
      {children}
    </div>
  );
}
