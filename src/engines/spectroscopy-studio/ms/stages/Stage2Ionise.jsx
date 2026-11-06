import { Zap, Check } from "lucide-react";
import { useMs, useMsActions, useMsShallow } from "../state/MsContext.jsx";
import { Equation } from "../components/ui.jsx";
import Key from "../components/Key.jsx";
import { buildExperiment, ION_FRACTION } from "../model/experiment.js";
import { IONISATION } from "../data/fragmentation.js";
import { relativeMolecularMass } from "../model/ions.js";
import { M_ELECTRON_U } from "../physics/constants.js";

export function Strip() {
  const a = useMsActions(); const fired = useMs((s) => s.fired);
  return (
    <div className="ss-controlrow" data-testid="stage2-strip">
      <button type="button" className="sim-btn sim-btn--primary ss-cta" onClick={a.fire} disabled={fired} data-testid="ionize">{fired ? <><Check size={16} aria-hidden="true" /> Electron beam on</> : <><Zap size={16} aria-hidden="true" /> Ionize</>}</button>
      <span className="ss-stripnote">{fired ? "Watch the molecules cross the electron beam." : "Press Ionize to switch the electron beam on."}</span>
    </div>
  );
}
export function Panel() {
  const { molId, seed, n, fired } = useMsShallow((s) => ({ molId: s.molId, seed: s.seed, n: s.n, fired: s.fired }));
  const exp = buildExperiment({ molId, seed, n }); const M = exp.spec.mMz; const mr = relativeMolecularMass(exp.spec.comp);
  const mass2 = M - 2 * M_ELECTRON_U;
  return (
    <>
      <Equation testId="ionisation-equation" className="ms-eq--block" parts={[{ t: "M + e⁻ → M⁺• + 2e⁻", on: true }]} ariaLabel="M plus an electron gives the molecular ion plus two electrons" />
      <p data-testid="s2-text">In <b>electron ionization</b> a beam of fast electrons (about 70 eV) passes through the gas. When an electron passes close to a molecule it can <b>knock one electron out</b>: the molecule becomes a <b>positive molecular ion, M⁺•</b>, a <b>radical cation</b> (the dot is the unpaired electron). Two electrons leave: the ejected one and the slowed beam electron.</p>
      <p data-testid="s2-outcome">Most molecules are <b>not</b> ionized by a given pass. In this animation {exp.nIon} of {exp.n} are (about {Math.round(ION_FRACTION * 100)} %, chosen for clarity; in a real source only a tiny fraction of the molecules is ionized). The others stay <b>neutral</b>: they are not accelerated or deflected and are pumped away.{fired ? "" : " (Press Ionize.)"}</p>
      <Key />
      <details className="ms-more" data-testid="charge-advanced"><summary>Advanced: a +1 ion and a +2 ion</summary>
        <p>Removing a second electron makes a <b>doubly charged ion</b>, M²⁺ (M + e⁻ → M²⁺ + 3e⁻). Its mass is almost the same, but its m/z is <b>half</b>:</p>
        <table className="ms-table"><thead><tr><th scope="col">Ion</th><th scope="col">Mass (u)</th><th scope="col">Charge number z</th><th scope="col">m/z = mass / z</th></tr></thead>
          <tbody>
            <tr><th scope="row">M⁺•</th><td>{(M - M_ELECTRON_U).toFixed(3)}</td><td>1</td><td data-testid="mz-1plus">{M}</td></tr>
            <tr><th scope="row">M²⁺</th><td>{mass2.toFixed(3)}</td><td>2</td><td data-testid="mz-2plus">{(M / 2).toFixed(1)}</td></tr>
          </tbody></table>
        <p className="ss-note">Nominal masses are used (Mᵣ = {mr.toFixed(2)} for this compound; the electron mass, 0.0005 u, is negligible here). Doubly charged ions need more energy to form and are usually much less common in the EI spectra of small molecules; they are not part of the representative spectrum used here. A doubly charged ion of odd mass has a half-integer m/z.</p>
      </details>
    </>
  );
}
export const TEACHER = (
  <>
    <p>{IONISATION.note}</p>
    <p>The beam electrons are not captured. The ionization energy of the molecule (about 10 eV for most organic molecules) is far smaller than the 70 eV of the beam, which is why the molecular ion is often formed with a lot of extra (internal) energy. That excess energy is what makes it fragment (next stage).</p>
    <p>The ions are held in the source by small electric fields and leave through the slit only when the extraction field is applied (stage 4). The picture shows the beam and the ions separately for clarity.</p>
  </>
);
