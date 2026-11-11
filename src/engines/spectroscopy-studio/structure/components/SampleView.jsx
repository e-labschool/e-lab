import { ChevronLeft, ChevronRight, FlaskConical, Play } from "lucide-react";
import useInvestigation from "./useInvestigation.js";
import { LEVELS, compoundsOfLevel } from "../model/levels.js";
import { useStructure } from "../state/StructureContext.jsx";
import { NMR_FREQ_MHZ, NMR_SOLVENT, SIMULATED_NOTE } from "../data/compounds.js";

const EVIDENCE = [["Mass spectrum", "electron ionisation"], ["Infrared spectrum", "4000 to 400 cm⁻¹"], ["¹H NMR spectrum", `${NMR_FREQ_MHZ} MHz, ${NMR_SOLVENT}`]];

/** Stage 1: the sample card. */
export default function SampleView() {
  const { store, compound, level, work, sampleId, index } = useInvestigation();
  const n = compoundsOfLevel(level.id).length; const seen = ["ms", "ir", "nmr"].filter((t) => work.visited[t]).length;
  const levelId = useStructure((s) => s.level);
  return (
    <div className="st-sample" data-testid="sample-view">
      <section className="st-card" aria-label="Unknown sample" data-testid="sample-card">
        <header className="st-cardhead">
          <FlaskConical size={22} aria-hidden="true" />
          <div>
            <p className="ss-kicker">Unknown sample</p>
            <h3 className="st-sampleid" data-testid="sample-id">{sampleId}</h3>
          </div>
          <span className="st-level" data-testid="level-badge">{level.label}</span>
        </header>
        <p className="st-question" data-testid="sample-question">Can you identify the unknown molecule using spectroscopic evidence?</p>
        <dl className="st-facts">
          <div><dt>Molecular formula</dt><dd data-testid="sample-formula">{level.formulaGiven ? <b>{compound.formulaPretty}</b> : <span className="st-muted">Not given at this level: work it out from the evidence.</span>}</dd></div>
          <div><dt>Available evidence</dt><dd><ul className="st-chips" data-testid="sample-evidence">{EVIDENCE.map(([a, b]) => <li key={a}><b>{a}</b> <span>{b}</span></li>)}</ul></dd></div>
          <div><dt>Objective</dt><dd>Combine the three spectra to decide which of four possible structures the unknown is, and justify your choice.</dd></div>
        </dl>
        <p className="st-tag">{SIMULATED_NOTE}</p>
        <div className="st-btnrow">
          <button type="button" className="sim-btn sim-btn--primary st-tbtn st-tbtn--big" onClick={store.start} data-testid="start-investigation"><Play size={15} aria-hidden="true" /> <span>{work.started ? "Continue investigation" : "Start Investigation"}</span></button>
          <span className="st-muted st-small" data-testid="sample-progress">{seen} of 3 spectra viewed{work.id.solved ? " · solved" : work.id.shown ? " · solution shown" : work.id.attempts ? ` · ${work.id.attempts} attempt${work.id.attempts > 1 ? "s" : ""}` : ""}</span>
        </div>
      </section>
      <section className="st-levels" aria-label="Difficulty level" data-testid="level-panel">
        <p className="ss-kicker">Difficulty</p>
        <div className="st-seg" role="radiogroup" aria-label="Difficulty level">
          {LEVELS.map((l) => <button key={l.id} type="button" role="radio" aria-checked={levelId === l.id} className="sim-btn st-segbtn" onClick={() => store.setLevel(l.id)} data-testid={`level-${l.id}`}>{l.label}</button>)}
        </div>
        <p className="st-levelnote" data-testid="level-summary">{level.summary}</p>
        <div className="st-btnrow">
          <button type="button" className="sim-btn st-tbtn" onClick={() => store.moveUnknown(-1)} disabled={n < 2} aria-label="Previous unknown" data-testid="prev-unknown"><ChevronLeft size={15} aria-hidden="true" /> <span>Previous unknown</span></button>
          <span className="st-muted" data-testid="unknown-position">Unknown {index + 1} of {n}</span>
          <button type="button" className="sim-btn st-tbtn" onClick={() => store.moveUnknown(1)} disabled={n < 2} aria-label="Next unknown" data-testid="next-unknown-sample"><span>Next unknown</span> <ChevronRight size={15} aria-hidden="true" /></button>
        </div>
        <p className="st-muted st-small">Each unknown keeps its own notebook, tables and answers. You can move between the five stages at any time without losing them.</p>
      </section>
    </div>
  );
}
