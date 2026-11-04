import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import ViewerStage from "./ViewerStage.jsx";
import LewisDiagram from "./LewisDiagram.jsx";
import { explainShape } from "../model/builder.js";
import { deriveLewis } from "../model/lewis.js";
import { formulaOf } from "./format.js";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The right-hand "Current structure" card: mini 3D model | Lewis structure, the facts, expandable "Why this shape?". Compact by design. */
export default function StructureCard({ model, cls, view, resetKey, compactRows = false, testId = "structure-card" }) {
  const [tab, setTab] = useState("model");
  const [why, setWhy] = useState(false);
  const lewis = useMemo(() => deriveLewis(model), [model]);
  const miniView = useMemo(() => ({ ...view, showAngles: false, showRepulsion: false }), [view]);
  const empty = !cls.hasCentral;
  const rows = [];
  if (!empty) {
    const molecule = cls.preset ? `${cls.preset.display} (${cls.preset.name.split(" (")[0].toLowerCase()})` : cls.n ? `Idealised VSEPR model · ${formulaOf(model)}` : formulaOf(model);
    rows.push(["Molecule", molecule, "row-molecule"]);
    rows.push(["AXE notation", cls.n ? cls.axe : "–", "row-axe"]);
    rows.push(["Total electron domains", cls.n ? `${cls.n} (${cls.b} bonding + ${plural(cls.l, "lone pair")})` : "0", "row-domains"]);
    rows.push(["Electron-domain geometry", cls.ed ?? "–", "row-ed"]);
    rows.push(["Molecular geometry", cls.mg ?? "–", "row-mg"]);
    const a = cls.angles;
    rows.push([cls.angles?.entries?.length > 1 ? "Bond angles" : "Bond angle", a?.entries?.length ? a.entries.map((e) => (e.kind === "approx" ? `${e.text} (approx.)` : e.kind === "lessthan" ? `${e.text}` : `${e.text}`)).join(" · ") : a?.summary ?? "–", "row-angle"]);
  }
  return (
    <section className="vx-card" aria-label="Current structure" data-testid={testId}>
      <h3 className="vx-h">Current structure</h3>
      <div className="vx-seg vx-seg--small" role="tablist" aria-label="Structure view">
        <button type="button" role="tab" aria-selected={tab === "model"} className="vx-seg-btn" onClick={() => setTab("model")} data-testid="card-tab-model">3D model</button>
        <button type="button" role="tab" aria-selected={tab === "lewis"} className="vx-seg-btn" onClick={() => setTab("lewis")} data-testid="card-tab-lewis">Lewis structure</button>
      </div>
      <div className="vx-mini" data-tab={tab}>
        {tab === "model" ? (
          empty ? <p className="vx-mini-empty">Nothing built yet</p>
            : <ViewerStage mini model={model} resetKey={resetKey} view={miniView} interactive={false} ariaLabel="Small preview of the current model" fallback="Preview unavailable without WebGL." />
        ) : (
          <div className="vx-lewis" data-status={lewis.status} data-testid="lewis-panel">
            <LewisDiagram model={model} lewis={lewis} />
            <ul className="vx-lewis-notes" aria-live="polite">
              {lewis.empty ? null : lewis.status === "ok" && <li className="is-ok">Octet complete: a valid Lewis structure for this atom set.</li>}
              {lewis.warnings?.map((w, i) => <li key={i} className={w.level === "warn" ? "is-warn" : "is-info"} data-testid={w.level === "warn" ? "lewis-warning" : "lewis-exception"}>{w.level === "warn" ? "Warning: " : "Exception: "}{w.text}</li>)}
              {!lewis.empty && lewis.status !== "empty" && <li className="is-muted">Lewis view of the arrangement you built: free builds are not always valid Lewis structures.</li>}
            </ul>
          </div>
        )}
      </div>
      {empty ? <p className="vx-empty-note" data-testid="info-empty">Drag an atom into the workspace to start. The information appears here.</p> : (
        <dl className={"vx-rows" + (compactRows ? " is-compact" : "")} data-testid="info-rows">
          {rows.map(([k, v, id]) => (<div key={id} className="vx-row" data-testid={id}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      )}
      {!empty && cls.idealisedModel && cls.n >= 2 && <p className="vx-badge" data-testid="idealised-badge" title="This arrangement does not match one of the validated molecules in the library">Idealised VSEPR model (not a validated molecule)</p>}
      {!empty && cls.angles?.entries?.length > 0 && <p className="vx-legend-line" data-testid="angle-legend">{cls.angles.source === "preset" ? "≈ = approximate experimental value; plain = idealised VSEPR angle." : "Idealised model angles. Lone pairs make real angles smaller than ideal."}</p>}
      {!empty && cls.warnings?.map((w, i) => <p key={i} className="vx-warn" role="status" data-testid="info-warning">{w}</p>)}
      {!empty && (
        <>
          <button type="button" className="vx-why-btn" aria-expanded={why} onClick={() => setWhy((v) => !v)} data-testid="why-toggle"><span>Why this shape?</span><ChevronDown size={14} aria-hidden="true" className={why ? "is-open" : ""} /></button>
          {why && <p className="vx-why" data-testid="why-text">{explainShape(cls)}</p>}
        </>
      )}
    </section>
  );
}
