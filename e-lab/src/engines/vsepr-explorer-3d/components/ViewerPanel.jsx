import { Atom, Share2 } from "lucide-react";
import ViewerStage from "./ViewerStage.jsx";

/** The big viewer plus the Electron-Domain / Molecular Geometry segmented control directly below it. */
export default function ViewerPanel({ stageRef, model, resetKey, view, setMode, angleEntries, interactive = true, selectedId, onSelect, onRemove, onDragActive, selectionBar, emptyHint, hint, liveHint = false, ariaLabel }) {
  const empty = !model.central;
  return (
    <div className="vx-viewer" data-testid="vsepr-viewer">
      <div className="vx-viewer-box">
        <ViewerStage
          ref={stageRef} model={model} resetKey={resetKey} view={view} angleEntries={angleEntries} interactive={interactive}
          selectedId={selectedId} onSelect={onSelect} onRemove={onRemove} onDragActive={onDragActive} ariaLabel={ariaLabel}
        >
          {empty && emptyHint && <p className="vx-empty" data-testid="empty-hint">{emptyHint}</p>}
          {selectionBar}
          {view.showRepulsion && !empty && model.domains.length >= 2 && (
            <ul className="vx-legend" aria-label="Repulsion arrows" data-testid="repulsion-legend">
              {model.domains.some((d) => d.kind === "lp") && model.domains.filter((d) => d.kind === "lp").length >= 2 && <li><i style={{ background: "#ff6f7d" }} />Lone pair–lone pair (strongest)</li>}
              {model.domains.some((d) => d.kind === "lp") && <li><i style={{ background: "#ffb347" }} />Lone pair–bond pair (stronger)</li>}
              <li><i style={{ background: "#ffe0a8" }} />Bond pair–bond pair (weaker)</li>
            </ul>
          )}
          {hint && <p className="vx-viewer-hint" data-testid="viewer-hint" data-live={liveHint ? "1" : undefined}>{hint}</p>}
        </ViewerStage>
      </div>
      <div className="vx-seg vx-seg--big" role="radiogroup" aria-label="Geometry view" data-testid="geometry-switch">
        <button type="button" role="radio" aria-checked={view.mode === "ed"} className="vx-seg-btn" onClick={() => setMode("ed")} title="Electron-domain geometry: every bonding and lone-pair domain" data-testid="mode-ed"><Share2 size={16} aria-hidden="true" /><span>Electron-domain geometry</span></button>
        <button type="button" role="radio" aria-checked={view.mode === "mg"} className="vx-seg-btn" onClick={() => setMode("mg")} title="Molecular geometry: the shape made by the atoms only (lone pairs are not atoms)" data-testid="mode-mg"><Atom size={16} aria-hidden="true" /><span>Molecular geometry</span></button>
      </div>
    </div>
  );
}
