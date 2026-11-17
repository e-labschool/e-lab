import { useRef, useState } from "react";
import { AlertTriangle, Check, Lock, Maximize2, Minimize2, Beaker } from "lucide-react";
import IonPane from "../../scene/IonViewer.jsx";
import { useElementSize } from "../hooks.js";
import { getSolute, fmtMl, WINDOW_NM } from "../../engine/concLab.js";
import { fmtSig } from "../../engine/numeric.js";

/** One step of the procedure: finished (a one-line tick), current (its controls), upcoming (greyed in guided mode, usable in free mode). */
export function Step({ n, title, status, summary, children, guided, testId }) {
  const locked = guided && status === "todo"; const showBody = status === "current" || (!guided && status !== "done") || false;
  return (
    <li className={`ml3-step is-${status}${locked ? " is-locked" : ""}`} data-status={status} data-testid={testId} aria-current={status === "current" ? "step" : undefined}>
      <div className="ml3-step-head">
        <span className="ml3-step-n" aria-hidden="true">{status === "done" ? <Check size={12} /> : locked ? <Lock size={11} /> : n}</span>
        <span className="ml3-step-title">{title}</span>
        {status === "done" && summary && <span className="ml3-step-sum">{summary}</span>}
        {locked && <span className="ml3-step-sum">comes later</span>}
      </div>
      {showBody && <div className="ml3-step-body">{children}</div>}
      {!showBody && status === "done" && !guided && <div className="ml3-step-body ml3-step-body--again">{children}</div>}
    </li>
  );
}

/** The microscopic particle viewer card: every pane is drawn at the SAME scale (a 2 nm cube), only the ion density differs. */
export function ScopeCard({ view, dark, reduced, big, onBig, reveal, size = null, compact = false }) {
  const ref = useRef(null); const sz = useElementSize(ref); const n = Math.max(1, view.panes.length);
  const avail = size ?? Math.max(90, sz.width - 16 - (n - 1) * 8); const each = Math.max(96, Math.min(big ? 360 : 190, Math.floor(avail / n)));
  const sol = view.solute;
  return (
    <section className={"ml-card ml3-scope" + (big ? " is-big" : "") + (compact ? " is-compact" : "")} aria-label="Microscopic particle viewer" data-testid="ml3-scope" ref={ref}>
      <header className="ml-card-head"><h3><Beaker size={14} aria-hidden="true" /> Microscopic view</h3>
        <button type="button" className="ml-icon-btn" onClick={onBig} aria-pressed={big} aria-label={big ? "Make the microscopic view smaller" : "Enlarge the microscopic view"} title={big ? "Back to the bench" : "Enlarge"} data-testid="ml3-scope-big">{big ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
      </header>
      <div className="ml3-panes" data-testid="ml3-panes">
        {view.panes.map((p) => (
          <figure key={p.key} className="ml3-pane" data-testid={`ml3-pane-${p.key}`} data-state={p.state} data-pairs={p.drawn}>
            <IonPane pane={p} size={each} dark={dark} reduced={reduced} testId={`ml3-canvas-${p.key}`} />
            <figcaption>
              <b>{p.label}</b>
              <span data-testid={`ml3-pane-c-${p.key}`}>{p.c == null ? "no solution yet" : (p.approx ? "≈ " : "") + (reveal ? p.cText : "concentration hidden until you predict")}</span>
              {p.c != null && <span data-testid={`ml3-pane-n-${p.key}`}>≈ {p.unitsText} {sol.formula} units in the window</span>}
              {p.note && <span className="ml-muted">{p.note}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="ml-hint" data-testid="ml3-scale">Same scale in every view: a {WINDOW_NM} nm × {WINDOW_NM} nm × {WINDOW_NM} nm window of the solution. More ions in the window means a higher concentration. Each ion is drawn with its shell of water molecules (hydrated {sol.ions.map((i) => i.label).join(" and ")}); there are no intact {sol.formula} molecules. Ion sizes are enlarged and the water is schematic.</p>
    </section>
  );
}

/** Virtual-lab safety and the exothermic note (always visible, short) plus the detail behind it. */
export function NotesCard({ solute }) {
  const corrosive = solute.hazard === "corrosive";
  return (
    <section className={"ml-card ml3-notes" + (corrosive ? " is-hazard" : "")} aria-label="Safety and notes" data-testid="ml3-notes">
      <p className="ml3-safety" data-testid="ml3-safety"><AlertTriangle size={14} aria-hidden="true" /> <span><b>Virtual lab.</b> {corrosive ? "Concentrated sodium hydroxide is corrosive: in a real laboratory you wear goggles and gloves, never touch the solid, and add it to water slowly while stirring." : "Sodium chloride is low-hazard, but a real laboratory still means goggles and clean glassware."}</span></p>
      <p className="ml3-thermal" data-testid="ml3-thermal">{solute.note}</p>
      <details className="ml3-details"><summary>Why a volumetric flask?</summary>
        <p>Concentration is moles per dm³ of <b>solution</b>, not of water. Dissolving a solid changes the volume in a way that depends on the solute, so 100 mL of water plus solute is <u>not</u> exactly 100 mL of solution. A volumetric flask holds exactly its marked volume when filled to the calibration mark: dissolve the solid in less water, transfer everything, then add water until the bottom of the meniscus touches the mark.</p>
        <p>In solution the solid is gone: <b>{solute.equation}</b>. The ions are hydrated (surrounded by water molecules) and no {solute.formula} molecules exist.</p>
      </details>
    </section>
  );
}

/** What the student sees when WebGL is unavailable: the same apparatus as accessible tiles with level bars and exact numbers. */
export function Stage3Fallback({ view, scene }) {
  const d = scene.data; const A = d.stations.A; const tiles = [];
  const level = (ml, cap) => Math.min(1, Math.max(0, ml / cap));
  if (view.kind === "single") {
    tiles.push({ key: "cyl", name: "Measuring cylinder", ml: A.cylMl, cap: 100 }, { key: "bk", name: "Beaker", ml: A.waterMl, cap: 250, extra: view.stations[0].exact.solidQ > 0 ? `${fmtSig(view.stations[0].exact.solidQ / 1e9, 3)} mol solid` : null }, { key: "fl", name: `Volumetric flask ${fmtMl(A.flaskMl)} mL`, ml: A.liquidMl, cap: A.flaskMl, mark: true });
  } else if (view.kind === "dilution") {
    tiles.push({ key: "st", name: "Stock", ml: view.dil.exact.stockVolMl, cap: 250 }, { key: "cyl", name: "Measuring cylinder (aliquot)", ml: view.dil.exact.cylMl, cap: 100 }, { key: "fl", name: `Volumetric flask ${fmtMl(A.flaskMl)} mL`, ml: A.liquidMl, cap: A.flaskMl, mark: true });
  } else for (const st of view.stations) tiles.push({ key: st.id, name: `Solution ${st.id}: flask ${fmtMl(st.exact.flaskMl)} mL`, ml: st.exact.liquidMl, cap: st.exact.flaskMl, mark: true });
  return (
    <div className="ml-fallback" data-testid="ml-fallback" role="group" aria-label="Apparatus (2D view)">
      <p className="ml-fallback-note" role="status"><b>3D view unavailable on this device.</b> The apparatus is shown in 2D; every control and calculation still works.</p>
      <div className="ml-fallback-row">
        {view.stations.map((st) => <div key={st.id} className="ml3-fb-tile" data-testid={`ml3-fb-packet-${st.id}`}><b>Packet {view.stations.length > 1 ? st.id : ""}</b><span>{st.text.packetAmount} {view.solute.formula}</span><span>{st.packet?.open ? "open" : "closed"} · balance {st.text.balance}</span></div>)}
        {tiles.map((t) => (
          <div key={t.key} className="ml3-fb-tile" data-testid={`ml3-fb-${t.key}`}>
            <div className="ml3-fb-glass" aria-hidden="true"><div className="ml3-fb-liquid" style={{ height: `${level(t.ml, t.cap) * 100}%` }} />{t.mark && <div className="ml3-fb-mark" />}</div>
            <b>{t.name}</b><span>{fmtMl(t.ml)} mL{t.extra ? ` · ${t.extra}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function useScopeBig() { const [big, setBig] = useState(false); return [big, setBig]; }
export { getSolute };
