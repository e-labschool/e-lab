import { useMs, useMsActions, useMsShallow } from "../state/MsContext.jsx";
import { ChipGroup } from "../components/ui.jsx";
import { BigSlider } from "../../components/ui.jsx";
import { buildExperiment } from "../model/experiment.js";
import { sectorPath, sectorWhere, sectorFocusMz, tofTime, sectorMzRange } from "../model/analyser.js";
import { radiusFromMz, speedFromMz, kineticEnergyJ } from "../physics/kinematics.js";
import { E_CHARGE } from "../physics/constants.js";
import { SECTOR } from "../physics/sector.js";

export const ANALYSER_OPTIONS = [{ id: "sector", label: "Magnetic sector", sub: "default" }, { id: "tof", label: "Time of flight", sub: "alternative" }];
export function AnalyserChips({ testId = "analyser" }) {
  const a = useMsActions(); const analyser = useMs((s) => s.analyser);
  return <ChipGroup label="Mass analyser" options={ANALYSER_OPTIONS} value={analyser} onChange={a.setAnalyser} testId={testId} small />;
}
export function Strip() {
  const a = useMsActions(); const { molId, seed, n, analyser, V, B, cmp } = useMsShallow((s) => ({ molId: s.molId, seed: s.seed, n: s.n, analyser: s.analyser, V: s.V, B: s.B, cmp: s.cmp }));
  const exp = buildExperiment({ molId, seed, n }); const mzs = [...new Set(exp.detector.filter((d) => !exp.cat[d.mz].dashed).map((d) => d.mz))];
  const f = sectorFocusMz(B, V); const range = sectorMzRange(V);
  return (
    <div className="ss-controlrow ms-s4strip" data-testid="stage4-strip">
      <AnalyserChips />
      <BigSlider id="ms-v" label="Accelerating voltage" symbol="V" value={V} min={SECTOR.V_MIN} max={SECTOR.V_MAX} step={50} onChange={a.setV} badge={`${V} V`} color="#fbbf24" testId="v-slider" />
      {analyser === "sector" && (
        <>
          <BigSlider id="ms-b" label="Magnetic field" symbol="B" value={B} min={SECTOR.B_MIN} max={SECTOR.B_MAX} step={0.005} onChange={a.setB} badge={`${B.toFixed(3)} T`} color="#38bdf8" testId="b-slider" hint={`Transmits m/z ${f.toFixed(1)} at this V and B (this magnet can focus m/z ${range.lo.toFixed(0)} to ${range.hi.toFixed(0)} at ${V} V).`} describedBy="ms-b-hint" />
          <div className="ms-tunechips" role="group" aria-label="Tune the field to an ion"><span className="ss-stripnote">Tune B to</span>
            {mzs.map((mz) => <button key={mz} type="button" className="sim-btn ss-chipbtn ms-chip--sm" onClick={() => a.tuneTo(mz)} data-testid={`tune-${mz}`} title={`Set B so that m/z ${mz} reaches the detector`}>m/z {mz}</button>)}
          </div>
        </>
      )}
      <div className="ms-cmpbox">
        <button type="button" className="sim-btn ss-chipbtn" aria-pressed={cmp.on} onClick={() => a.setCmp({ on: !cmp.on, mz: cmp.mz ?? exp.spec.baseMz })} data-testid="cmp-toggle">{cmp.on ? "Hide" : "Compare"} 1+ and 2+</button>
        {cmp.on && <ChipGroup label="Ion to compare" options={mzs.map((mz) => ({ id: String(mz), label: `${exp.cat[mz].label} ${mz}` }))} value={String(cmp.mz)} onChange={(id) => a.setCmp({ mz: Number(id) })} testId="cmp-ion" small />}
      </div>
    </div>
  );
}
const fmtR = (r) => `${(r * 100).toFixed(1)} cm`;
export function Panel() {
  const { molId, seed, n, analyser, V, B, cmp } = useMsShallow((s) => ({ molId: s.molId, seed: s.seed, n: s.n, analyser: s.analyser, V: s.V, B: s.B, cmp: s.cmp }));
  const exp = buildExperiment({ molId, seed, n }); const mzs = [...new Set(exp.detector.map((d) => d.mz))];
  const f = sectorFocusMz(B, V);
  const cmpMz = cmp.mz; const mass = cmpMz ?? 0;
  const row = (z) => {
    const mz = mass / z; const ek = kineticEnergyJ(z, V) / E_CHARGE;
    return { z, mz, ek, v: speedFromMz(mz, V), r: analyser === "sector" ? radiusFromMz(mz, V, B) : null, t: analyser === "tof" ? tofTime(mz, V) : null, out: analyser === "sector" ? sectorPath(mz, V, B) : null };
  };
  return (
    <>
      <p data-testid="s4-text">Only <b>positive ions</b> are pushed by the electric field. They gain kinetic energy <b>E<sub>k</sub> = zeV</b>, so the speed is v = √(2zeV/m): lighter ions (smaller m/z) move faster. <b>Neutral</b> molecules and fragments feel no force: they have already been pumped away and are never in this beam.</p>
      <p data-testid="s4-mz"><b>m/z = ion mass ÷ charge number.</b> A 1+ ion of mass {mass || exp.spec.baseMz} has m/z {mass || exp.spec.baseMz}; the same ion carrying 2+ has m/z {(mass || exp.spec.baseMz) / 2}. The analyser separates ions by m/z, not by mass alone.</p>
      {analyser === "sector" ? (
        <p data-testid="s4-sector">In the magnetic field each ion moves on a circle of radius <b>r = (1/B)√(2mV/(ze))</b>, which depends on <b>m/z</b>, on V and on B. For a fixed V and B only ions with one m/z (here <b>{f.toFixed(1)}</b>) follow the circle that ends on the detector slit; ions with a smaller m/z curve more tightly and land too early, those with a larger m/z land too late or hit the wall.</p>
      ) : (
        <p data-testid="s4-tof">In the flight tube all ions have the <b>same kinetic energy zeV</b> (equal-kinetic-energy assumption) but different speeds, so the time of flight is <b>t = L√(m/(2zeV))</b> = L√((m/z)/(2eV)): the lowest m/z arrives first. A pulse of ions is released together.</p>
      )}
      <table className="ms-table" data-testid="ion-table" aria-label="What each ion type does at the present setting">
        <thead><tr><th scope="col">Ion</th><th scope="col">m/z</th><th scope="col">{analyser === "sector" ? "Radius r" : "Flight time t"}</th><th scope="col">{analyser === "sector" ? "At this B" : "Order"}</th></tr></thead>
        <tbody>
          {mzs.map((mz, i) => {
            const t = analyser === "sector" ? sectorPath(mz, V, B) : null; const tt = tofTime(mz, V); const order = [...mzs].sort((p, q) => p - q).indexOf(mz) + 1;
            return <tr key={mz} data-mz={mz} className={t?.outcome === "detector" ? "is-sel" : ""}><th scope="row"><span className="ms-dotshape" style={{ "--c": exp.cat[mz].color }} data-shape={exp.cat[mz].shape} aria-hidden="true" /> {exp.cat[mz].label}</th><td>{mz}</td><td>{analyser === "sector" ? fmtR(t.r) : `${(tt * 1e6).toFixed(2)} µs`}</td><td>{analyser === "sector" ? sectorWhere(t) : `arrives ${order}${order === 1 ? "st" : order === 2 ? "nd" : order === 3 ? "rd" : "th"}`}</td></tr>;
          })}
        </tbody>
      </table>
      {cmp.on && cmpMz && (
        <div className="ms-cmp" data-testid="cmp-panel">
          <p><b>1+ versus 2+ for the same species (mass {mass}).</b></p>
          <table className="ms-table"><thead><tr><th scope="col">Charge</th><th scope="col">m/z</th><th scope="col">E<sub>k</sub> = zeV</th><th scope="col">{analyser === "sector" ? "Radius r" : "Flight time"}</th></tr></thead>
            <tbody>{[1, 2].map((z) => { const r = row(z); return <tr key={z} data-z={z}><th scope="row">{z}+</th><td data-testid={`cmp-mz-${z}`}>{r.mz}</td><td>{r.ek.toLocaleString("en-US")} eV</td><td>{analyser === "sector" ? fmtR(r.r) : `${(r.t * 1e6).toFixed(2)} µs`}</td></tr>; })}</tbody></table>
          <p className="ss-note">The 2+ ion gains twice the energy, but it also has twice the charge, so its path is that of an ion with half the mass. An ion of mass {mass / 2} carrying 1+ would have the same m/z, the same path and the same flight time as this 2+ ion: the instrument cannot tell them apart. Doubly charged ions are usually much less abundant than singly charged ones in EI; this is shown for comparison only.</p>
        </div>
      )}
    </>
  );
}
export const TEACHER = (
  <>
    <p><b>Do not say “lighter ions always bend more”.</b> r = (1/B)√(2(m/z)V/e): at fixed V and B the radius depends on m/z only, so a heavy ion with 2+ can bend like a light ion with 1+. Raising V makes every ion stiffer to bend (larger r); raising B makes every ion bend more (smaller r). Try the sliders: the m/z that reaches the detector changes as m/z ∝ B²/V.</p>
    <p><b>Resolution.</b> The detector slit is narrow enough to pass one nominal m/z (±0.5) at a time. Real magnets are scanned, and the spectrum is the record of the detector signal as B (or V) changes (stage 5). The slit of the earlier single-setting model (±1.2 % in radius) would also let m/z 57 and 59 through when tuned to 58; this experiment applies the unit-resolution rule instead.</p>
    <p><b>Time of flight.</b> The drawing shortens the 1 m tube; the times in the table use L = 1 m. t ∝ √(m/z) assumes every ion starts with the same kinetic energy zeV, which real TOF instruments only approximate (reflectron, delayed extraction).</p>
  </>
);
