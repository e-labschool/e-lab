import { useMemo, useState } from "react";
import { Maximize2, Plus } from "lucide-react";
import NmrPlot from "./NmrPlot.jsx";
import ZoomBar from "./ZoomBar.jsx";
import Prompts from "./Prompts.jsx";
import RowsTable from "./RowsTable.jsx";
import useInvestigation from "./useInvestigation.js";
import { buildSignals, defaultView, integrationValues, regionsOf } from "../model/nmrSignals.js";
import { clampView, panView, viewForPpmRange, zoomView } from "../../nmr/molecular/model/spectrum.js";
import { fmtPpm } from "../model/evaluate.js";

const COLUMNS = [
  { field: "shift", label: "Chemical shift", width: 1 }, { field: "integ", label: "Integration", width: 1 },
  { field: "split", label: "Splitting", width: 1.05 }, { field: "assign", label: "Possible assignment", width: 1.7 },
];
const MIN_SPAN = 0.06;

/** Stage 4: the ¹H NMR spectrum. Click a signal to inspect it; expand multiplets; integration curves on request; the interpretation table is the student's. */
export default function NmrView() {
  const { store, compound, level, work } = useInvestigation();
  const d2o = work.nmr.d2o; const freq = compound.nmr.freqMHz;
  const signals = useMemo(() => buildSignals(compound, { d2o }), [compound, d2o]);
  const regions = useMemo(() => regionsOf(signals), [signals]);
  const integText = useMemo(() => integrationValues(regions, level.integration), [regions, level.integration]);
  const full = useMemo(() => defaultView(buildSignals(compound)), [compound]);
  const [view, setView] = useState(full); const [selId, setSelId] = useState(null); const [cursor, setCursor] = useState(null); const [expanded, setExpanded] = useState(false);
  const showInteg = work.nmr.integ ?? (level.id === "foundation");
  const region = regions.find((r) => r.id === selId) ?? null;
  const inRegion = region ? signals.filter((s) => region.ids.includes(s.id)) : [];
  const zoomed = view.left - view.right < full.left - full.right - 1e-9;
  const anchor = region ? region.centre : undefined;
  const expand = () => { if (!region) return; setView(viewForPpmRange(region.lo, region.hi, 0.35)); setExpanded(true); };
  const resetView = () => { setView(full); setExpanded(false); };
  const pick = (id) => setSelId(id === selId ? null : id);
  let inspector = null;
  if (region) {
    const one = inRegion[0]; const val = integText[region.id];
    inspector = region.overlapped ? (
      <>
        <b data-testid="nmr-insp-shift">δ {fmtPpm(region.lo)}–{fmtPpm(region.hi)} ppm (overlapping signals)</b>
        <span data-testid="nmr-insp-integ">Integration of the whole region: {val.text}{level.integration === "relative" ? " (relative)" : ""}</span>
        <span data-testid="nmr-insp-split">Splitting: overlapping, not simple to read. Zoom in and look at the line spacing; a D₂O shake may help.</span>
      </>
    ) : (
      <>
        <b data-testid="nmr-insp-shift">δ {fmtPpm(one.shift)} ppm</b>
        <span data-testid="nmr-insp-integ">Integration: {val.text}{level.integration === "relative" ? " (relative; the smallest signal is 1.00)" : ""}</span>
        <span data-testid="nmr-insp-split">Splitting: {one.sig.exchangeable ? "broad singlet" : one.sig.multiplicity}{one.nLines > 1 ? ` (${one.nLines} lines, spacing J ≈ ${[...new Set(one.sig.couplings.map((c) => c.J))].join(" and ")} Hz)` : ""}</span>
        {one.exchangeable && <span className="st-muted st-small">Broad signal. Its position, width and integral can depend on the sample (concentration, solvent, water).</span>}
      </>
    );
  }
  return (
    <div className="st-view" data-testid="nmr-view">
      <div className="st-plotcol">
        <div className="st-plot" data-testid="nmr-plot">
          <NmrPlot signals={signals} regions={regions} view={view} freqMHz={freq} showIntegral={showInteg} integText={integText} selectedId={region?.id ?? null} onSelect={pick} cursor={cursor} onCursor={setCursor} expanded={expanded && zoomed} />
        </div>
        <ZoomBar
          label="¹H NMR spectrum controls" zoomed={zoomed} canIn={view.left - view.right > MIN_SPAN + 1e-6} canOut={zoomed}
          onIn={() => setView(zoomView(view, 0.5, anchor))} onOut={() => setView(zoomView(view, 2, anchor))}
          onReset={resetView} onPan={(f) => setView(clampView(panView(view, -f * (view.left - view.right))))}
          extra={(
            <div className="st-btnrow">
              <button type="button" className="sim-btn st-tbtn" onClick={expand} disabled={!region} data-testid="expand-multiplet" title="Zoom to the selected signal to see its lines"><Maximize2 size={14} aria-hidden="true" /> <span>Expand multiplet</span></button>
              <button type="button" className="sim-btn st-tbtn" aria-pressed={showInteg} onClick={() => store.setIntegration(!showInteg)} data-testid="toggle-integration"><span>Integration curves</span></button>
              <button type="button" className="sim-btn st-tbtn" aria-pressed={d2o} onClick={() => store.setD2O(!d2o)} data-testid="toggle-d2o" title="A D₂O shake exchanges O–H hydrogens for deuterium, which ¹H NMR does not detect"><span>Add D₂O</span></button>
            </div>
          )}
        />
      </div>
      <aside className="st-panel" aria-label="Proton NMR evidence" data-testid="nmr-panel">
        <p className="ss-kicker">¹H NMR spectrum ({freq} MHz, {compound.nmr.solvent})</p>
        <p className="st-tag" data-testid="sim-note">Simulated, representative spectrum. First-order splitting. Not a measured spectrum.</p>
        <div className="st-inspect" role="status" aria-live="polite" data-testid="nmr-inspector">
          {region ? (
            <>
              {inspector}
              <button type="button" className="sim-btn st-tbtn" data-testid="add-nmr-row" onClick={() => store.fillRow("nmr", region.overlapped
                ? { shift: `${fmtPpm(region.lo)}–${fmtPpm(region.hi)}`, integ: integText[region.id].text, split: "overlapping" }
                : { shift: fmtPpm(inRegion[0].shift), integ: integText[region.id].text, split: inRegion[0].exchangeable ? "broad singlet" : inRegion[0].sig.multiplicity })}><Plus size={14} aria-hidden="true" /> <span>Add to my table</span></button>
            </>
          ) : <span className="st-muted">Click a signal to inspect its shift, integration and splitting. TMS (0 ppm) is the reference.</span>}
        </div>
        <RowsTable table="nmr" testId="nmr-table" caption="My ¹H NMR interpretation" numbered columns={COLUMNS} rows={work.nmr.rows} onCell={(i, f, v) => store.setCell("nmr", i, f, v)} onAdd={() => store.addRow("nmr")} onRemove={(i) => store.removeRow("nmr", i)} />
        <Prompts tech="nmr" store={store} work={work} open={level.guided} />
      </aside>
    </div>
  );
}
