import { useRef } from "react";
import { useElementSize } from "./hooks.js";

/** Layout of one stage: 3D workspace (dominant), compact contextual controls, expandable calculations, persistent reference.
 *  `workspace` is a function of the viewport's aspect ratio (measured here) so the camera can frame the bench. */
export default function StageFrame({ layout, workspace, controls, calc, reference, status, statusTone = "info", stageTitle, stageBlurb }) {
  const vref = useRef(null); const sz = useElementSize(vref);
  const aspect = Math.max(0.4, sz.width / Math.max(120, sz.height));
  return (
    <div className="ml-body" data-layout={layout} data-testid="ml-body">
      <div className="ml-work" data-testid="ml-work">
        <div className="ml-work-head"><div><h3 className="ml-stage-title">{stageTitle}</h3>{stageBlurb && <p className="ml-stage-blurb">{stageBlurb}</p>}</div></div>
        <div className="ml-viewport" ref={vref} data-testid="ml-viewport">{typeof workspace === "function" ? workspace(aspect) : workspace}</div>
        <p className={`ml-status ml-status--${statusTone}`} role="status" aria-live="polite" data-testid="ml-status">{status}</p>
        <div className="ml-calcwrap">{calc}</div>
      </div>
      <aside className="ml-side" aria-label="Controls">{controls}{reference}</aside>
    </div>
  );
}
