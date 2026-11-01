import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Layers } from "lucide-react";
import EnergyPanel from "./EnergyPanel.jsx";
import ViewerStage from "./ViewerStage.jsx";
import { Switch } from "./useOrbitalLab.jsx";
import { MOLECULES, MOLECULE_BY_ID } from "../model/moleculeData.js";
import { compileMolecule } from "../model/moleculeLayout.js";
import { stepView, energyAtom, ANIM_MS } from "../scene/stepView.js";
import { bondSummary } from "../model/overlap.js";

export const STEP_MS = 4200; // time one step is shown while playing
const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const formulaUnicode = (plain) => plain.replace(/\d/g, (d) => SUB[Number(d)]);

export default function useMoleculeExplorer({ active }) {
  const [molId, setMolId] = useState("C2H4");
  const [step, setStep] = useState(0); const [playing, setPlaying] = useState(true); const [showEnergy, setShowEnergy] = useState(false);
  const [clock, setClock] = useState({ start: 0, now: 0 });
  const compiled = useMemo(() => compileMolecule(molId), [molId]);
  const last = compiled.steps.length - 1; const spec = MOLECULE_BY_ID[molId];
  const startRef = useRef(0);

  // each step change restarts the animation clock (re-render each frame for ANIM_MS)
  useEffect(() => {
    if (!active) return undefined;
    const t0 = performance.now(); startRef.current = t0; setClock({ start: t0, now: t0 });
    let raf = 0; const tick = () => { const now = performance.now(); setClock({ start: t0, now }); if (now - t0 < ANIM_MS + 120) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [molId, step, active]);

  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  useEffect(() => {
    if (!active || !playing) return undefined;
    if (step >= last) { const t = setTimeout(() => setPlaying(false), STEP_MS * 0.6); return () => clearTimeout(t); }
    const t = setTimeout(() => setStep((s) => Math.min(last, s + 1)), STEP_MS);
    return () => clearTimeout(t);
  }, [active, playing, step, last, molId]);

  const select = (id) => { setMolId(id); setStep(0); setPlaying(true); };
  const next = () => { setPlaying(false); setStep((s) => Math.min(last, s + 1)); };
  const prev = () => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); };
  const reset = useCallback(() => { setPlaying(false); setStep(0); setClock((c) => ({ start: performance.now(), now: performance.now() })); }, []);
  const togglePlay = () => { if (playing) setPlaying(false); else { if (step >= last) setStep(0); setPlaying(true); } };

  const st = compiled.steps[Math.min(step, last)];
  const progress = clock.start ? Math.min(1, (clock.now - clock.start) / ANIM_MS) : 1;
  const view = useMemo(() => stepView(compiled, Math.min(step, last), progress, clock.start, clock.now), [compiled, step, last, progress, clock.start, clock.now]);
  const fit = useMemo(() => ({ key: `mol:${molId}`, center: compiled.center, radius: compiled.radius }), [molId, compiled]);
  const ea = energyAtom(compiled, Math.min(step, last));

  const controls = (
    <div className="hy-left" data-testid="hybridisation-left" data-tab="molecules">
      <section className="hy-ctl" aria-label="Molecule">
        <label className="hy-field">Molecule
          <select value={molId} onChange={(e) => select(e.target.value)} data-testid="select-molecule" aria-label="Select molecule">
            {MOLECULES.map((m) => <option key={m.id} value={m.id}>{formulaUnicode(m.plain)} {"–"} {m.name.toLowerCase()}</option>)}
          </select>
        </label>
        <p className="hy-small" data-testid="step-count"><span className="hy-steps-count">Step {Math.min(step, last) + 1} / {compiled.steps.length}</span></p>
        <div className="hy-play">
          <button type="button" className="hy-btn hy-btn--primary" onClick={togglePlay} aria-pressed={playing} data-testid="btn-play" title={playing ? "Pause the automatic sequence" : "Play the sequence"}>{playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {playing ? "Pause" : "Play"}</button>
          <button type="button" className="hy-btn" onClick={reset} data-testid="btn-mol-reset" title="Back to step 1"><RotateCcw size={14} aria-hidden="true" /> Reset</button>
          <button type="button" className="hy-btn" onClick={prev} disabled={step <= 0} data-testid="btn-prev" title="Previous step"><SkipBack size={14} aria-hidden="true" /> Previous</button>
          <button type="button" className="hy-btn" onClick={next} disabled={step >= last} data-testid="btn-next" title="Next step">Next <SkipForward size={14} aria-hidden="true" /></button>
        </div>
        <div className="hy-counts" data-testid="bond-counts" aria-live="polite">
          <span className="hy-chip hy-chip--sigma" data-testid="count-sigma">{st.sigma} {"σ"}</span>
          <span className="hy-chip hy-chip--pi" data-testid="count-pi">{st.pi} {"π"}</span>
          {st.ring && <span className="hy-chip hy-chip--pi" data-testid="count-delocalised">+ delocalised {"π"}</span>}
        </div>
        <Switch checked={showEnergy} onChange={setShowEnergy} testId="opt-energy">Energy-level diagram</Switch>
        {spec.note && <p className="hy-note" data-testid="mol-note">{spec.note}</p>}
      </section>
    </div>
  );

  const chamber = (
    <div className="hy-center" data-tab="molecules">
      <div className="hy-viewer">
        <ViewerStage
          view={view} fit={fit} interactive={false} tool="move" getAtom={() => null} ariaLabel={`3D orbital model of ${formulaUnicode(spec.plain)}`} testId="hy-stage"
          extraData={{ "data-molecule": molId, "data-step": Math.min(step, last), "data-steps": compiled.steps.length, "data-playing": playing ? "1" : "0", "data-sigma": st.sigma, "data-pi": st.pi }}
          tools={<button type="button" className="hy-vt" aria-pressed={showEnergy} onClick={() => setShowEnergy((v) => !v)} title="Show the energy-level diagram of the atom in this step" data-testid="vt-energy"><Layers size={16} aria-hidden="true" /><span>Energy</span></button>}
        >
          <div className="hy-bondbar" data-testid="bond-bar"><b>{formulaUnicode(spec.plain)}</b><span className="hy-chip hy-chip--sigma">{st.sigma} {"σ"}</span><span className="hy-chip hy-chip--pi">{st.pi} {"π"}{st.ring ? " + delocalised" : ""}</span></div>
          <div className="hy-legend" aria-hidden="true"><span><i className="pos" />+ phase</span><span><i className="neg" />{"−"} phase</span><span className="hy-legend-long"><i className="sg" />{"σ"} overlap</span><span className="hy-legend-long"><i className="pi" />{"π"} overlap</span><span className="hy-legend-long">Educational shapes (angular part only)</span></div>
        </ViewerStage>
      </div>
    </div>
  );

  const graph = showEnergy ? <div className="hy-right" data-tab="molecules"><EnergyPanel atom={ea.atom} selectable={false} hybridised={ea.hybridised} onCollapse={() => setShowEnergy(false)} label={ea.atom.id} testId="energy-panel" /></div> : null;
  const final = step >= last;
  const explain = st.text;
  return { controls, chamber, graph, graphShown: showEnergy, explain, onReset: reset, state: { molId, step, playing, compiled, final, summary: bondSummary(st.sigma, st.pi) } };
}
