import { useId, useRef } from "react";
import { useStageGuard } from "./useStageGuard.js";
import { ContextLostNotice, NoWebGLNotice, StageKeyHint, useStageKeys } from "./StageShell.jsx";

/**
 * The accessible frame every simple 3D stage shares: context-loss guard, keyboard orbit/zoom (arrows, +/-, 0), visible
 * focus ring and key hint, and the no-WebGL notice.  `render` is a function receiving
 *   { canvasKey, aa, camRef, webgl }   -> put `key={canvasKey}` on <Canvas> and <CameraKeyApi apiRef={camRef}/> inside it.
 * `noGL` is the content shown when WebGL is unavailable (default: the notice with `fallback` text).
 */
export default function GuardedFrame({ className = "", testId, ariaLabel, fallback, noGL, onReset, render, children, ...rest }) {
  const ref = useRef(null); const camRef = useRef(null); const hintId = useId();
  const { webgl, aa, lost, canvasKey } = useStageGuard(ref);
  const onKeyDown = useStageKeys(camRef, onReset);
  return (
    <div ref={ref} className={className} data-testid={testId} data-s3d-stage data-webgl={webgl ? "1" : "0"} tabIndex={webgl ? 0 : -1}
      role="application" aria-label={ariaLabel} aria-describedby={webgl ? hintId : undefined} onKeyDown={onKeyDown} {...rest}>
      {webgl ? render({ canvasKey, aa, camRef, webgl }) : (noGL ?? <NoWebGLNotice>{fallback && <p>{fallback}</p>}</NoWebGLNotice>)}
      {children}
      {webgl && <StageKeyHint id={hintId} />}
      {lost && <ContextLostNotice />}
    </div>
  );
}
