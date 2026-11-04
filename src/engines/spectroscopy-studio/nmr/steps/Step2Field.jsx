import { useMemo, useRef } from "react";
import { Magnet } from "lucide-react";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge, BigSlider, Legend, Readouts } from "../../components/ui.jsx";
import { usePhase, useTransition } from "../../components/useAnim.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { B0_MAX, B0_MIN, TEMPERATURE_K, sci } from "../physics/constants.js";
import { fieldReadouts, fieldSentence } from "../physics/fieldModel.js";
import { displayPolarization, exaggerationFactor } from "../physics/populations.js";
import { assignStates } from "../physics/spinEnsemble.js";
import SpinChamberScene, { ENSEMBLE } from "../scene/SpinChamberScene.jsx";
import LevelsDiagram from "./LevelsDiagram.jsx";

const fmtInt = (x) => Math.round(x).toLocaleString("en-US").replace(/,/g, " ");

/** Step 2: split view (nuclei | energy levels), Apply B0, ONE field slider that drives dE, nu0 and every number on the page. */
export default function Step2Field() {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const f = useStudio((s) => s.field);
  const p = useTransition({ id: "field-apply", target: f.applied ? 1 : 0, seconds: 2.6 });
  const phase = usePhase();
  const r = fieldReadouts(b0);
  const teaching = f.popMode === "teaching";
  const dispP = displayPolarization(f.popMode, b0);
  const live = useRef({ apply: 0, phase: 0, view: "scientific", polarization: 0, m0Length: 0 });
  live.current = { apply: p, phase: phase * 2 * Math.PI * 0.4, view: "scientific", polarization: dispP, m0Length: teaching ? 2.4 * dispP : 0 };
  const st = useMemo(() => assignStates(ENSEMBLE, dispP), [dispP]);
  const setApplied = (v) => { a.setPaused(false); a.patch("field", { applied: v }); };

  const viz = (
    <div className="ss-split" data-testid="field-view">
      <div className="ss-half ss-half--3d" data-testid="spin-viz">
        <ThreeCanvas label="Chamber of hydrogen nuclei: arrows for their magnetic moments, random before the field and on two cones about B0 after it" position={[3.6, -4.2, 2.4]} fallback="The 3D picture needs WebGL. Without a field the moments point in random directions; in a field each is in the lower-energy alpha or the higher-energy beta state.">
          <SpinChamberScene live={live} selected={-1} showArrows labels />
        </ThreeCanvas>
        <Legend className="ss-legend-bl" items={f.applied ? [{ color: "#2dd4bf", label: "α: lower energy", shape: "arrow" }, { color: "#a78bfa", label: "β: higher energy", shape: "arrow" }, { color: "#38bdf8", label: "field B₀", shape: "ring" }] : [{ color: "#c7d2ea", label: "moments: random directions", shape: "arrow" }]} />
      </div>
      <div className="ss-half ss-half--levels" data-testid="energy-panel">
        <LevelsDiagram b0={b0} p={p} polarization={dispP} exaggerated={teaching} />
      </div>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={() => setApplied(!f.applied)} aria-pressed={f.applied} data-testid="apply-field">
        <Magnet size={18} aria-hidden="true" /> {f.applied ? "Remove B₀" : "Apply B₀"}
      </button>
      <BigSlider
        id="ss-b0" label="Magnetic field strength" symbol="B₀" value={b0} min={B0_MIN} max={B0_MAX} step={0.1} onChange={a.setB0} badge={`${r.text.b0}`} valueText={`${b0.toFixed(1)} tesla, resonance frequency ${r.text.nu0}`}
        ticks={[{ at: 0, label: "1 T" }, { at: 0.5, label: "7.5 T" }, { at: 1, label: "14 T" }]} testId="b0-slider"
      />
      <button type="button" className="sim-btn ss-chipbtn" aria-pressed={teaching} onClick={() => a.patch("field", { popMode: teaching ? "real" : "teaching" })} data-testid="pop-toggle" title="Show the population difference larger than it really is, so that it can be seen. The real value is always stated.">
        Exaggerate population difference
      </button>
    </div>
  );
  const teacher = (
    <>
      <p>Each nucleus is in α <i>or</i> β (or a superposition; a measurement along B₀ gives one of two values). The ensemble has only a tiny <b>excess</b> in α: {r.text.excess} at {r.text.b0} and {TEMPERATURE_K} K. That is why NMR is an intrinsically insensitive technique and why higher fields help.</p>
      <p>“Up” and “down” are labels for m = ±½ along B₀. The moment is never exactly along z (|μ| = γħ√3/2), so in the 3D picture it sits on a cone and precesses at ν₀; random phases around the cone give no net transverse magnetisation.</p>
      <p>The exaggeration multiplies the true excess by a constant factor of about {fmtInt(exaggerationFactor())} (still linear in B₀). It is a visibility aid only, and the real number is shown whenever it is on.</p>
    </>
  );
  return (
    <StepFrame step={2} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--split">
      <p data-testid="what-is-happening" aria-live="polite">{fieldSentence(b0, f.applied)}</p>
      <Readouts items={[
        { id: "b0", label: "B₀", value: r.text.b0, tone: "b0" },
        { id: "nu0", label: "ν₀ = γB₀/2π", value: r.text.nu0, tone: "b0", title: "Resonance frequency of ¹H" },
        { id: "dE", label: "ΔE = hν₀", value: r.text.dE, tone: "b0", title: "Energy gap between α and β" },
        { id: "excess", label: "Excess in α", value: r.text.excess, tone: "mag", title: `Boltzmann polarisation ${r.text.polarization} at ${TEMPERATURE_K} K` },
      ]} />
      {f.applied && !teaching && <Badge testId="real-badge"><b>Real scale.</b> {st.nAlpha} of {ENSEMBLE.n} arrows are drawn in α and {st.nBeta} in β; the true excess is far below one arrow, so it cannot be drawn.</Badge>}
      {teaching && <Badge tone="warn" testId="teaching-badge"><b>Exaggerated.</b> The α excess is drawn about {fmtInt(exaggerationFactor())}× too large. The real excess is {sci(r.polarization, 2)} ({r.text.excess}).</Badge>}
      <p className="ss-note" data-testid="quantum-note">Quantum states: not all nuclei are “aligned” with the field. Every nucleus is in α or β, and only a tiny excess is in α.</p>
    </StepFrame>
  );
}
