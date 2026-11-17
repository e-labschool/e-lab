import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Box } from "lucide-react";
import CubeScene from "./CubeScene.jsx";
import FlatCube from "./FlatCube.jsx";
import { useStageGuard } from "../../shared-3d/useStageGuard.js";
import CameraKeyApi from "../../shared-3d/CameraKeyApi.jsx";
import { ContextLostNotice, StageKeyHint, useStageKeys } from "../../shared-3d/StageShell.jsx";

/** Container + canvas for the transparent heating cube (a separate canvas from the two-molecule workspace). */
export default function CubeStage({ simRef, revision, compare, ariaLabel, children, onApi }) {
  const apiRef = useRef(null); const boxRef = useRef(null); const camRef = useRef(null);
  const { webgl, aa, lost, canvasKey } = useStageGuard(boxRef);
  const onKeyDown = useStageKeys(camRef, undefined);
  const setEl = (el) => { boxRef.current = el; if (el) { el.__imfCube = { api: () => apiRef.current, sim: () => simRef.current }; onApi?.(apiRef); } };
  return (
    <div ref={setEl} className="imf-stage imf-stage--cube" role="application" aria-label={ariaLabel} aria-describedby={webgl ? "imf-cube-keys" : undefined} data-s3d-stage data-testid="imf-cube-stage" tabIndex={0} onKeyDown={onKeyDown}>
      {webgl ? (
        <Canvas key={canvasKey} flat dpr={[1, 1.75]} frameloop="always" camera={{ fov: 36, near: 0.5, far: 160, position: [0, 2.6, 10] }} gl={{ antialias: aa, alpha: true, powerPreference: "low-power" }} style={{ touchAction: "none" }} resize={{ scroll: false }}>
          <CameraKeyApi apiRef={camRef} />
          <CubeScene simRef={simRef} apiRef={apiRef} revision={revision} compare={compare} />
        </Canvas>
      ) : (
        <div className="imf-nogl imf-nogl--with-view" data-testid="webgl-fallback" role="status"><FlatCube simRef={simRef} compare={compare} ariaLabel={ariaLabel} /><p><Box size={16} aria-hidden="true" /> <b>3D view unavailable on this device.</b> This flat side view shows the particles heating and cooling; the temperature, phase readout and heating curve update as well.</p></div>
      )}
      {webgl && <StageKeyHint id="imf-cube-keys" />}
      {lost && <ContextLostNotice />}
      {children}
    </div>
  );
}
