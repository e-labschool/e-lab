import { useCallback } from "react";
import { cameraKeyAction, KEY_HELP } from "./stageKeys.js";
import { Box, RefreshCw } from "lucide-react";
import "./shared3d.css";

/** onKeyDown handler for a 3D stage: arrows orbit, +/- zoom, 0 reset.  `camRef` is filled by <CameraKeyApi/>; `onReset` re-fits the view. */
export function useStageKeys(camRef, onReset, extra) {
  return useCallback((e) => {
    if (extra?.(e)) return;
    const a = cameraKeyAction(e); if (!a) return;
    e.preventDefault(); e.stopPropagation();
    if (a.type === "orbit") camRef.current?.orbit(a.az, a.pol);
    else if (a.type === "zoom") camRef.current?.zoom(a.factor);
    else if (onReset) onReset(); else camRef.current?.reset?.();
  }, [camRef, onReset, extra]);
}

/** Visible-on-focus keyboard instructions for a stage (also referenced by aria-describedby). */
export function StageKeyHint({ id }) {
  return <p id={id} className="s3d-keyhint" data-testid="stage-keyhint">{KEY_HELP}</p>;
}

/** Overlay shown while the GPU context is lost (it is restored automatically; the canvas is then remounted). */
export function ContextLostNotice() {
  return (
    <div className="s3d-lost" role="status" data-testid="webgl-context-lost">
      <RefreshCw size={20} aria-hidden="true" /><p><b>The 3D view paused.</b></p><p>The graphics driver reset the 3D context. It will come back on its own; nothing you built is lost.</p>
    </div>
  );
}

/** Clear message for engines whose 3D stage needs WebGL; `children` may add a 2D alternative. */
export function NoWebGLNotice({ children, title = "3D view unavailable on this device." }) {
  return (
    <div className="s3d-nogl" data-testid="webgl-fallback" role="status"><Box size={22} aria-hidden="true" /><p><b>{title}</b></p>{children}</div>
  );
}
