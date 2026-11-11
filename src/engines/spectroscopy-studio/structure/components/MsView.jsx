import { useState } from "react";
import { Plus } from "lucide-react";
import MsSpectrum from "../../ms/components/MsSpectrum.jsx";
import { useSize } from "../../components/useSize.js";
import ZoomBar from "./ZoomBar.jsx";
import Prompts from "./Prompts.jsx";
import useInvestigation from "./useInvestigation.js";
import { isZoomed, panRange, zoomRange } from "./zoom.js";

const MIN_SPAN = 12;
const relText = (r) => (r >= 10 ? String(Math.round(r)) : r.toFixed(1));

/** Stage 2: the mass spectrum of the unknown. Peaks are NOT labelled with ions; the molecular-ion and base-peak markers are optional. */
export default function MsView() {
  const { store, compound, level, work } = useInvestigation();
  const ms = compound.ms;
  const limits = [0, Math.ceil((ms.mMz + 8) / 10) * 10];
  const [range, setRange] = useState(limits);
  const [sel, setSel] = useState(null); const [hover, setHover] = useState(null); const [checked, setChecked] = useState(false);
  const [ref, size] = useSize();
  const markers = work.ms.markers ?? level.markersDefault;
  const zoomed = isZoomed(range, limits);
  const shown = ms.peaks.filter((p) => p.mz >= range[0] - 0.5 && p.mz <= range[1] + 0.5).map((p) => ({ mz: p.mz, rel: p.rel, role: p.role }));
  const anchor = sel ?? undefined;
  const info = ms.byMz[hover ?? sel];
  const mNum = Number(work.ms.mEst);
  return (
    <div className="st-view" data-testid="ms-view">
      <div className="st-plotcol">
        <div ref={ref} className="st-plot" data-testid="ms-plot" onPointerOver={(e) => { const g = e.target.closest?.("[data-mz]"); setHover(g ? Number(g.dataset.mz) : null); }} onPointerLeave={() => setHover(null)}>
          {(
            <MsSpectrum
              width={size.width || 520} height={size.height || 300} peaks={shown} xRange={range} colorBy={markers ? "role" : "plain"} labels="mz" marks={markers} mMz={ms.mMz} baseMz={ms.baseMz}
              selected={sel} onSelect={setSel} testId="ms-spectrum" ariaLabel="Mass spectrum of the unknown: relative abundance in percent against m/z"
            />
          )}
        </div>
        <ZoomBar
          label="Mass spectrum controls" zoomed={zoomed} canIn={range[1] - range[0] > MIN_SPAN + 0.01} canOut={zoomed}
          onIn={() => setRange(zoomRange(range, 0.5, anchor, limits, MIN_SPAN))} onOut={() => setRange(zoomRange(range, 2, anchor, limits, MIN_SPAN))}
          onReset={() => setRange(limits)} onPan={(f) => setRange(panRange(range, f, limits, MIN_SPAN))}
          extra={<button type="button" className="sim-btn st-tbtn" aria-pressed={markers} onClick={() => store.setMarkers(!markers)} data-testid="toggle-markers" title="Colour the molecular ion and mark it and the base peak"><span>{markers ? "Hide" : "Show"} M⁺• and base-peak markers</span></button>}
        />
      </div>
      <aside className="st-panel" aria-label="Mass spectrum evidence" data-testid="ms-panel">
        <p className="ss-kicker">Mass spectrum (electron ionisation)</p>
        <p className="st-tag" data-testid="sim-note">Simulated, representative spectrum. Not a measured spectrum.</p>
        <div className="st-inspect" role="status" aria-live="polite" data-testid="peak-inspector">
          {info ? (
            <>
              <b>m/z {info.mz}</b>
              <span>relative abundance {relText(info.rel)} %{info.mz === ms.baseMz && markers ? " (base peak)" : ""}</span>
              <button type="button" className="sim-btn st-tbtn" onClick={() => store.appendNotebook("mass", `m/z ${info.mz} (${relText(info.rel)} %): `)} data-testid="add-peak-note"><Plus size={14} aria-hidden="true" /> <span>Add to notebook</span></button>
            </>
          ) : <span className="st-muted">Hover over or click a peak to read its m/z and relative abundance.</span>}
        </div>
        <label className="st-field">
          <span className="st-fieldlabel">My estimate of the molecular mass, M</span>
          <span className="st-inline">
            <input type="text" inputMode="numeric" className="st-cell st-cell--short" value={work.ms.mEst} onChange={(e) => { store.setMEst(e.target.value); setChecked(false); }} placeholder="e.g. 46" data-testid="m-estimate" autoComplete="off" />
            {level.guided && <button type="button" className="sim-btn st-tbtn" onClick={() => setChecked(true)} disabled={!work.ms.mEst} data-testid="check-estimate">Check</button>}
          </span>
        </label>
        {level.guided && checked && work.ms.mEst && (
          <p className={`st-note ${mNum === ms.mMz ? "is-ok" : "is-no"}`} role="status" data-testid="estimate-feedback">
            {mNum === ms.mMz ? "That matches the molecular-ion peak." : "That is not the molecular-ion peak. Look for the peak at the highest m/z, ignoring the tiny peak one unit above it."}
          </p>
        )}
        <Prompts tech="ms" store={store} work={work} open={level.guided} />
        <p className="st-muted st-small">Record your possible fragments in the Evidence Notebook: for each, write the m/z and the ion or neutral piece you think it is.</p>
      </aside>
    </div>
  );
}
