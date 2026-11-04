import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Layers } from "lucide-react";
import EnergyPanel from "./EnergyPanel.jsx";
import ViewerStage from "./ViewerStage.jsx";
import { Switch } from "./useOrbitalLab.jsx";
import { MOLECULES, MOLECULE_BY_ID } from "../model/moleculeData.js";
import { compileMolecule } from "../model/moleculeLayout.js";
import { stepView, energyAtom, stepDuration, geometryRequests } from "../scene/stepView.js";
import PhaseLegend from "./PhaseLegend.jsx";
import { MOLECULE_DIR } from "../scene/Scene3D.jsx";
import { bondSummary } from "../model/overlap.js";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const formulaUnicode = (plain) => plain.replace(/\d/g, (d) => SUB[Number(d)]);
const idle = (fn) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 0));

export default function useMoleculeExplorer({ active }) {
  const [molId, setMolId] = useState("C2H4");
  const [step, setStep] = useState(0); const [playing, setPlaying] = useState(false); const [showEnergy, setShowEnergy] = useState(false);
  const [labels, setLabels] = useState(true); const [showPhase, setShowPhase] = useState(false);
  const [stamp, setStamp] = useState(0); // bumps whenever a step is (re)started: the scene restarts that step's animation from it
  const compiled = useMemo(() => compileMolecule(molId), [molId]);
  const last = compiled.steps.length - 1; const spec = MOLECULE_BY_ID[molId];
  const stepRef = useRef(step); stepRef.current = step;

  // idle-time warm-up when the tab / molecule is selected: fill the overlap-lens cache for every step (the geometries are warmed by the viewer)
  const warm = useMemo(() => geometryRequests(compiled), [compiled]);
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false; let i = 0; const run = () => { if (cancelled || i > last) return; stepView(compiled, i, 0); i += 1; idle(run); };
    idle(run); return () => { cancelled = true; };
  }, [active, compiled, last]);

  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  // autoplay: every step is shown for its own motion time plus a short dwell (stepDuration), so there is no long motionless gap
  useEffect(() => {
    if (!active || !playing) return undefined;
    const st = compiled.steps[Math.min(step, last)];
    if (step >= last) { const t = setTimeout(() => setPlaying(false), 600); return () => clearTimeout(t); }
    const t = setTimeout(() => { setStep((s) => Math.min(last, s + 1)); setStamp((n) => n + 1); }, stepDuration(st));
    return () => clearTimeout(t);
  }, [active, playing, step, last, compiled]);

  const select = (id) => { setMolId(id); setStep(0); setStamp((n) => n + 1); setPlaying(false); };
  const go = (n) => { setStep(n); setStamp((c) => c + 1); };
  const next = () => { setPlaying(false); go(Math.min(last, step + 1)); };
  const prev = () => { setPlaying(false); go(Math.max(0, step - 1)); };
  const reset = useCallback(() => { setPlaying(false); setStep(0); setStamp((n) => n + 1); }, []);
  // Play starts moving at once: from the current step it immediately begins the NEXT step (or restarts from step 1 after the end)
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    setPlaying(true);
    if (step >= last) go(0); else go(step + 1);
  };

  const st = compiled.steps[Math.min(step, last)];
  const view = useMemo(() => ({ ...stepView(compiled, Math.min(step, last), performance.now(), { labels }), showPhase }), [compiled, step, last, stamp, labels, showPhase]); // eslint-disable-line react-hooks/exhaustive-deps
  const fit = useMemo(() => ({ key: `mol:${molId}`, center: compiled.center, radius: compiled.radius, dir: MOLECULE_DIR }), [molId, compiled]);
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
        <Switch checked={labels} onChange={setLabels} testId="opt-labels" title="Label the sigma and pi bonds on the finished molecule">{"σ/π"} labels</Switch>
        {spec.note && <p className="hy-note" data-testid="mol-note">{spec.note}</p>}
      </section>
    </div>
  );

  const chamber = (
    <div className="hy-center" data-tab="molecules">
      <div className="hy-viewer">
        <ViewerStage
          view={view} fit={fit} interactive={false} tool="move" getAtom={() => null} ariaLabel={`3D orbital model of ${formulaUnicode(spec.plain)}`} testId="hy-stage" warm={warm}
          extraData={{ "data-molecule": molId, "data-step": Math.min(step, last), "data-steps": compiled.steps.length, "data-playing": playing ? "1" : "0", "data-sigma": st.sigma, "data-pi": st.pi }}
          tools={<button type="button" className="hy-vt" aria-pressed={showEnergy} onClick={() => setShowEnergy((v) => !v)} title="Show the energy-level diagram of the atom in this step" data-testid="vt-energy"><Layers size={16} aria-hidden="true" /><span>Energy</span></button>}
        >
          <div className="hy-bondbar" data-testid="bond-bar"><b>{formulaUnicode(spec.plain)}</b><span className="hy-chip hy-chip--sigma">{st.sigma} {"σ"}</span><span className="hy-chip hy-chip--pi">{st.pi} {"π"}{st.ring ? " + delocalised" : ""}</span></div>
          <PhaseLegend showPhase={showPhase} onToggle={setShowPhase} />
        </ViewerStage>
      </div>
    </div>
  );

  const graph = showEnergy ? <div className="hy-right" data-tab="molecules"><EnergyPanel atom={ea.atom} selectable={false} hybridised={ea.hybridised} onCollapse={() => setShowEnergy(false)} label={ea.atom.id} testId="energy-panel" /></div> : null;
  const final = step >= last;
  const explain = st.text;
  return { controls, chamber, graph, graphShown: showEnergy, explain, onReset: reset, state: { molId, step, playing, compiled, final, summary: bondSummary(st.sigma, st.pi) } };
}
