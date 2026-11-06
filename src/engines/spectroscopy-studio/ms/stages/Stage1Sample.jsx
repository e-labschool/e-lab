import { useMemo } from "react";
import { Play, Check, Shuffle, Minus, Plus } from "lucide-react";
import { useMs, useMsActions, useMsShallow } from "../state/MsContext.jsx";
import { ChipGroup } from "../components/ui.jsx";
import MolGlyph, { GlyphGradients } from "../components/MolGlyph.jsx";
import { SIM_IDS, SIM_MOLECULES, MOLECULE_GEOMETRY_NOTE } from "../data/molecules.js";
import { buildExperiment, POP_MAX, POP_MIN, POPULATION_NOTE } from "../model/experiment.js";
import { relativeMolecularMass } from "../model/ions.js";
import { usePhase } from "../../components/useAnim.js";
import { INSTRUMENT_NOTES } from "../data/instrument.js";
import { SPECTRA_NOTE } from "../data/spectra.js";

export function Strip() {
  const a = useMsActions(); const { molId, n, started } = useMsShallow((s) => ({ molId: s.molId, n: s.n, started: s.started }));
  return (
    <div className="ss-controlrow" data-testid="stage1-strip">
      <span className="ss-stripnote">Sample</span>
      <ChipGroup label="Sample molecule" options={SIM_IDS.map((id) => ({ id, label: SIM_MOLECULES[id].name, sub: SIM_MOLECULES[id].formula }))} value={molId} onChange={a.setMolecule} testId="molecule" small />
      <span className="ms-stepper" role="group" aria-label="Number of molecules shown">
        <button type="button" className="sim-btn ss-chipbtn ms-chip--sm" onClick={() => a.setN(n - 1)} disabled={n <= POP_MIN} aria-label="Fewer molecules" data-testid="n-minus"><Minus size={15} aria-hidden="true" /></button>
        <output data-testid="n-value" aria-live="polite">{n} molecules</output>
        <button type="button" className="sim-btn ss-chipbtn ms-chip--sm" onClick={() => a.setN(n + 1)} disabled={n >= POP_MAX} aria-label="More molecules" data-testid="n-plus"><Plus size={15} aria-hidden="true" /></button>
      </span>
      <button type="button" className="sim-btn ss-chipbtn" onClick={a.newSample} data-testid="new-sample" title="A different random arrangement and a different mix of outcomes (same molecule)"><Shuffle size={15} aria-hidden="true" /> New arrangement</button>
      <button type="button" className="sim-btn sim-btn--primary ss-cta" onClick={a.startSample} disabled={started} data-testid="start-sample">{started ? <><Check size={16} aria-hidden="true" /> Sample introduced</> : <><Play size={16} aria-hidden="true" /> Start sample introduction</>}</button>
    </div>
  );
}

/** Inspector: the structure of the (identical) molecules, formula and mass. */
function Inspector({ exp }) {
  const phase = usePhase({ scale: 0.7 }); const sim = exp.sim;
  const frame = useMemo(() => ({ i: 0, x: 0, y: 0, spin: phase, tilt: 0.35, opacity: 1, flash: 0, parts: [{ role: "main", ids: null, kind: "neutral", ionKey: null, dx: 0, dy: 0, opacity: 1 }], bondFx: [] }), [phase]);
  const mr = relativeMolecularMass(sim.spec.comp);
  return (
    <figure className="ms-inspect" data-testid="inspector">
      <svg viewBox="-70 -52 140 104" className="ms-inspect-svg" role="img" aria-label={`Ball-and-stick model of ${sim.name}, slowly turning`}><GlyphGradients id="insp" /><MolGlyph gid="insp" geo={sim.geo} frame={frame} cat={exp.cat} scale={1.55} k={1.4} showCharges={false} showLabels={false} testId="inspector-mol" /></svg>
      <figcaption>
        <b data-testid="insp-name">{sim.name}</b>{sim.alt ? ` (${sim.alt})` : ""}
        <dl className="ms-inspect-dl">
          <div><dt>Structure</dt><dd data-testid="insp-structure">{sim.condensed}</dd></div>
          <div><dt>Molecular formula</dt><dd data-testid="insp-formula">{sim.formula}</dd></div>
          <div><dt>Molecular mass</dt><dd data-testid="insp-mass">Mᵣ = {mr.toFixed(2)} (nominal mass {sim.M})</dd></div>
        </dl>
      </figcaption>
    </figure>
  );
}

export function Panel() {
  const { molId, seed, n, track } = useMsShallow((s) => ({ molId: s.molId, seed: s.seed, n: s.n, track: s.track }));
  const exp = buildExperiment({ molId, seed, n });
  return (
    <>
      <p data-testid="s1-text">A mass spectrometer measures the <b>mass-to-charge ratio (m/z)</b> of ions. This sample is {exp.n} identical <b>{exp.sim.name}</b> molecules, all with formula {exp.sim.formula}. They enter through the <b>sample inlet</b>, are ionized, fragment, are accelerated, separated by m/z and counted by the detector. All of it happens in a high vacuum.</p>
      <p className="ss-prompt" data-testid="s1-prompt">{track.id === null ? "Click a molecule in the picture to select and track it." : `Tracking molecule ${exp.molecules[track.id].label}. The next stages follow it through the instrument.`}</p>
      <Inspector exp={exp} />
      <p className="ss-note" data-testid="population-note">{POPULATION_NOTE}</p>
      <details className="ms-more"><summary>About this instrument model</summary>
        <p>{INSTRUMENT_NOTES.ei}</p><p>{INSTRUMENT_NOTES.sample}</p><p>{INSTRUMENT_NOTES.vacuum}</p><p>{MOLECULE_GEOMETRY_NOTE}</p>
        <p>Data: {SPECTRA_NOTE}</p>
      </details>
    </>
  );
}
export const TEACHER = (
  <>
    <p>The animated molecules are a <b>teaching representation</b>. Each molecule is drawn at about 10⁹ times its real size relative to the instrument, and a real spectrum is built from an enormous number of molecules and ions. The same molecule and the same arrangement number always replay the same experiment, so a class can watch it twice.</p>
    <p>Ask: “If all the molecules are identical, will they all behave identically after ionization?” The next stages show that they do not.</p>
  </>
);
