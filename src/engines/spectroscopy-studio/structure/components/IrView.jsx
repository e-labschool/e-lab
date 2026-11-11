import { useMemo, useState } from "react";
import { BookMarked, Plus } from "lucide-react";
import IrPlot from "./IrPlot.jsx";
import ZoomBar from "./ZoomBar.jsx";
import Prompts from "./Prompts.jsx";
import RowsTable from "./RowsTable.jsx";
import useInvestigation from "./useInvestigation.js";
import { analyseSpectrum, buildSpectrum, transmittanceAt } from "../../ir/physics/spectrum.js";
import { EXTRA_GROUPS, SPEC_GROUPS } from "../../ir/physics/functionalGroups.js";
import { isZoomed, panRange, zoomRange } from "./zoom.js";

const LIMITS = [400, 4000]; const MIN_SPAN = 250;
const strength = (A) => (A >= 0.7 ? "strong" : A >= 0.3 ? "medium" : "weak");
const width = (f) => (f >= 400 ? "very broad" : f >= 150 ? "broad" : f >= 60 ? "medium width" : "sharp");
const round5 = (nu) => Math.round(nu / 5) * 5;
const COLUMNS = [{ field: "nu", label: "Band (cm⁻¹)", placeholder: "≈ 1700", width: 1.1 }, { field: "group", label: "Bond or group (my idea)", width: 1.3 }, { field: "evidence", label: "Evidence for / against", width: 1.8 }];
const REF_ROWS = [...SPEC_GROUPS, ...EXTRA_GROUPS.filter((g) => g.id === "aldch" || g.id === "co")].sort((a, b) => b.range[1] - a.range[1]);

/** Stage 3: the infrared spectrum. No group labels on the spectrum; the Reference Table is opened on request. */
export default function IrView() {
  const { store, compound, level, work } = useInvestigation();
  const bands = compound.ir.bands;
  const peaks = useMemo(() => analyseSpectrum(buildSpectrum(bands), { minA: 0.08, minProminence: 0.03 }), [bands]);
  const [range, setRange] = useState(LIMITS); const [cursor, setCursor] = useState(null); const [sel, setSel] = useState(null);
  const zoomed = isZoomed(range, LIMITS);
  const ref = work.ir.refOpen;
  return (
    <div className="st-view" data-testid="ir-view">
      <div className="st-plotcol">
        <div className="st-plot" data-testid="ir-plot">
          <IrPlot bands={bands} peaks={peaks} range={range} cursor={cursor} onCursor={setCursor} selected={sel} onSelect={setSel} />
        </div>
        <ZoomBar
          label="Infrared spectrum controls" zoomed={zoomed} canIn={range[1] - range[0] > MIN_SPAN + 1} canOut={zoomed}
          onIn={() => setRange(zoomRange(range, 0.5, sel?.nu, LIMITS, MIN_SPAN))} onOut={() => setRange(zoomRange(range, 2, sel?.nu, LIMITS, MIN_SPAN))}
          onReset={() => setRange(LIMITS)} onPan={(f) => setRange(panRange(range, -f, LIMITS, MIN_SPAN))}
          extra={<button type="button" className="sim-btn st-tbtn" aria-pressed={ref} onClick={() => store.setRefOpen(!ref)} data-testid="reference-toggle"><BookMarked size={15} aria-hidden="true" /> <span>Reference Table</span></button>}
        />
      </div>
      <aside className="st-panel" aria-label="Infrared evidence" data-testid="ir-panel">
        <p className="ss-kicker">Infrared spectrum</p>
        <p className="st-tag" data-testid="sim-note">Simulated, representative spectrum. Not a measured spectrum.</p>
        {ref && (
          <div className="st-reference" data-testid="reference-table">
            <table className="st-reftable">
              <caption>Characteristic IR absorption ranges</caption>
              <thead><tr><th>Bond / group</th><th>Wavenumber (cm⁻¹)</th><th>Appearance</th></tr></thead>
              <tbody>{REF_ROWS.map((g) => <tr key={g.id}><td>{g.label}</td><td>{g.range[0]}–{g.range[1]}</td><td>{g.note}</td></tr>)}</tbody>
            </table>
            <p className="st-muted st-small">Representative ranges (the IB Data Booklet gives close but not identical limits). Exact positions shift with hydrogen bonding and the molecule's structure. Below about 1500 cm⁻¹ (the fingerprint region) bands overlap and are hard to assign one by one.</p>
          </div>
        )}
        <div className="st-inspect" role="status" aria-live="polite" data-testid="ir-inspector">
          {sel ? (
            <>
              <b>Absorption near {round5(sel.nu)} cm⁻¹</b>
              <span>{strength(sel.A)}, {width(sel.fwhm)} (width at half height about {Math.round(sel.fwhm / 5) * 5} cm⁻¹), transmittance {Math.round(transmittanceAt(bands, sel.nu))} %</span>
              <button type="button" className="sim-btn st-tbtn" data-testid="add-ir-row" onClick={() => store.fillRow("ir", { nu: `≈ ${round5(sel.nu)} (${strength(sel.A)}, ${width(sel.fwhm)})` })}><Plus size={14} aria-hidden="true" /> <span>Add to my table</span></button>
            </>
          ) : cursor != null ? <span data-testid="ir-cursor-readout">{cursor} cm⁻¹, transmittance {Math.round(transmittanceAt(bands, cursor))} %. Click an absorption to inspect it.</span>
            : <span className="st-muted">Move over the spectrum to read the wavenumber; click an absorption to inspect it.</span>}
        </div>
        <RowsTable table="ir" testId="ir-table" caption="My IR observations" columns={COLUMNS} rows={work.ir.rows} onCell={(i, f, v) => store.setCell("ir", i, f, v)} onAdd={() => store.addRow("ir")} onRemove={(i) => store.removeRow("ir", i)} />
        <Prompts tech="ir" store={store} work={work} open={level.guided} />
      </aside>
    </div>
  );
}
