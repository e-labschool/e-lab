import { useMsShallow } from "../state/MsContext.jsx";
import { AnalyserChips } from "./Stage4Separate.jsx";
import PathwayDetail from "../components/PathwayDetail.jsx";
import { buildExperiment, detectionPlan, moleculesWithIon, COUNT_NOTE, SWEEPS, PULSES } from "../model/experiment.js";
import { tofTime } from "../model/analyser.js";
import { SPECTRA_NOTE } from "../data/spectra.js";
import { SECTOR } from "../physics/sector.js";

export function Strip() {
  const { analyser } = useMsShallow((s) => ({ analyser: s.analyser }));
  return (
    <div className="ss-controlrow" data-testid="stage5-strip">
      <span className="ss-stripnote">Analyser</span>
      <AnalyserChips testId="analyser5" />
      <span className="ss-stripnote">{analyser === "sector" ? `The magnet scans ${SWEEPS} times; the bars add up.` : `${PULSES} pulses of ions; the bars add up.`} Click a peak.</span>
    </div>
  );
}
export function Panel() {
  const { molId, seed, n, analyser, V, selPeak } = useMsShallow((s) => ({ molId: s.molId, seed: s.seed, n: s.n, analyser: s.analyser, V: s.V, selPeak: s.selPeak }));
  const exp = buildExperiment({ molId, seed, n }); const plan = detectionPlan(exp, analyser, V);
  const pk = selPeak !== null ? exp.spec.byMz[selPeak] : null; const ion = pk ? exp.cat[pk.mz] : null;
  const missing = plan.det.filter((d) => !d.ok);
  const parents = pk ? moleculesWithIon(exp, pk.mz) : [];
  const role = !pk ? null : pk.role === "M" ? "molecular-ion peak (M⁺•)" : pk.derived ? "isotope peak (M+1)" : "fragment-ion peak";
  return (
    <>
      {analyser === "sector" ? (
        <p data-testid="s5-sector">The magnetic field is <b>scanned</b>: B (here, with V fixed) is swept so that one m/z after another is focused on the detector slit, {plan.sweeps} times. At any instant only <b>one</b> m/z reaches the detector, so the spectrum is a <b>record built up over time</b>, not a snapshot of every ion arriving at once. Each peak grows when the sweep passes its m/z.</p>
      ) : (
        <p data-testid="s5-tof">A <b>pulse</b> of ions is released and the detector records the <b>arrival time</b> of each. Times are converted to m/z with t = L√((m/z)/(2eV)). {plan.pulses} pulses are added together here; lighter ions arrive first.</p>
      )}
      {missing.length > 0 && <p className="ss-warn" data-testid="range-warning">At V = {V} V this magnet (B up to {SECTOR.B_MAX} T) cannot focus m/z {missing.map((d) => d.mz).join(", ")}: those ions are not detected. Lower V in stage 4 to bring them into range.</p>}
      <dl className="ms-terms" data-testid="terms">
        <div><dt>Molecular-ion peak</dt><dd>the intact ion M⁺• at m/z {exp.spec.mMz}; not necessarily the tallest.</dd></div>
        <div><dt>Base peak</dt><dd>the tallest peak, m/z {exp.spec.baseMz}, set to 100 %.</dd></div>
        <div><dt>Fragment-ion peaks</dt><dd>charged pieces; neutral pieces never appear.</dd></div>
        <div><dt>Isotope peak</dt><dd>M+1: molecules with one ¹³C (or ²H), one unit above M.</dd></div>
      </dl>
      <div className="ms-peakinfo" data-testid="peak-info" aria-live="polite">
        {pk ? (
          <>
            <p><b>m/z {pk.mz}</b> · {ion.label} · relative intensity {pk.rel.toFixed(pk.rel < 10 ? 1 : 0)} % · <i>{role}</i>{pk.mz === exp.spec.baseMz ? " · base peak (100 %)" : ""}</p>
            <p data-testid="info-origin">{pk.origin}</p>
            <p className="ss-note" data-testid="info-population">{parents.length ? `In the animated sample ${parents.length} of ${exp.n} molecule${parents.length === 1 ? "" : "s"} (${parents.map((i) => exp.molecules[i].label).join(", ")}) ended as this ion.` : "None of the few animated molecules happened to end as this ion, but a large real sample always includes some."}</p>
          </>
        ) : <p className="ss-note">Click a peak in the spectrum to see its m/z, relative intensity, plausible ion formulas and the pathway that makes it.</p>}
      </div>
      {pk && <PathwayDetail exp={exp} mz={pk.mz} title={`Peak at m/z ${pk.mz}`} compact />}
      {analyser === "tof" && (
        <table className="ms-table" data-testid="tof-times"><thead><tr><th scope="col">m/z</th><th scope="col">Flight time (L = 1 m, V = {V} V)</th></tr></thead>
          <tbody>{plan.ok.slice().sort((p, q) => p.mz - q.mz).map((d) => <tr key={d.mz}><td>{d.mz}</td><td>{(tofTime(d.mz, V) * 1e6).toFixed(2)} µs</td></tr>)}</tbody></table>
      )}
      <p className="ss-note" data-testid="s5-note">{COUNT_NOTE} {SPECTRA_NOTE}</p>
    </>
  );
}
export const TEACHER = (
  <>
    <p><b>From a population to a peak.</b> Each bar is the count of ions with that m/z. Many ions of the same m/z, even from different parent molecules, are added in the same bin. The tallest bar is set to 100 %; the other bars are expressed as a percentage of it (relative intensity). The molecular ion need not be the tallest peak: the base peak is whichever ion is formed most easily.</p>
    <p><b>Scanning.</b> A scanning magnetic-sector instrument changes B (or V) steadily, so m/z values reach the single detector one after another. Its spectrum is plotted against the field setting, calibrated to m/z. A TOF instrument does the opposite: it measures a whole spectrum from each pulse, from the arrival times.</p>
    <p><b>Isotope peaks.</b> The M+1 peak is computed from the natural abundance of ¹³C and ²H in the formula; its size is a rough count of carbon atoms (about 1.1 % of M for each carbon).</p>
  </>
);
