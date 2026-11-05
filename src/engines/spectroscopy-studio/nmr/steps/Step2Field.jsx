import { useMemo, useRef } from "react";
import { Magnet } from "lucide-react";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge, BigSlider, Legend, Readouts } from "../../components/ui.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useReducedMotion, useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { B0_MAX, B0_MIN, TEMPERATURE_K, sci } from "../physics/constants.js";
import { fieldReadouts, fieldSentence } from "../physics/fieldModel.js";
import { displayPolarization, exaggerationFactor } from "../physics/populations.js";
import { CONE_ANGLE, assignStates } from "../physics/spinEnsemble.js";
import SpinChamberScene, { ENSEMBLE } from "../scene/SpinChamberScene.jsx";
import LevelsDiagram from "./LevelsDiagram.jsx";
import { SPIN_CLARIFICATION } from "./texts.js";

const fmtInt = (x) => Math.round(x).toLocaleString("en-US").replace(/,/g, " ");

/** Step 2: split view (nuclei | energy levels), Apply B0, ONE field slider that drives dE, nu0 and every number on the page. */
export default function Step2Field() {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const f = useStudio((s) => s.field);
  const p = useTransition({ id: "field-apply", target: f.applied ? 1 : 0, seconds: 2.6 });
  const paused = useStudio((s) => s.paused);
  const speed = useStudio((s) => s.speed);
  const reduced = useReducedMotion();
  const r = fieldReadouts(b0);
  const teaching = f.popMode === "teaching";
  const dispP = displayPolarization(f.popMode, b0);
  const st = useMemo(() => assignStates(ENSEMBLE, dispP), [dispP]);
  const live = useRef({ apply: 0, grow: 1, states: st, paused: false, reduced: false, speed: 1, m0Length: 0 });
  live.current = { apply: p, grow: 1, states: st, paused, reduced, speed, m0Length: teaching ? 2.4 * dispP : 0 };
  const setApplied = (v) => { a.setPaused(false); a.patch("field", { applied: v }); };

  const viz = (
    <div className="ss-split" data-testid="field-view">
      <div className="ss-half ss-half--3d" data-testid="spin-viz">
        <ThreeCanvas label="Chamber of proton models, each a sphere with an arrow for its magnetic moment: random before the field; after B0 is applied, moments along B0 (alpha) or against it (beta), each precessing on its own cone" position={[4.7, -5.4, 2.9]} fallback="The 3D picture needs WebGL. Without a field the moments point in random directions; in a field each is in the lower-energy alpha state (moment along B0) or the higher-energy beta state (moment against B0), and precesses about B0.">
          <SpinChamberScene live={live} labels />
        </ThreeCanvas>
        <Legend className="ss-legend-bl" items={f.applied ? [{ color: "#2dd4bf", label: "α: moment along B₀", shape: "arrow" }, { color: "#a78bfa", label: "β: moment against B₀", shape: "arrow" }, { color: "#38bdf8", label: "B₀", shape: "arrow" }, { color: "#8ba3d6", label: "ring: precession cone", shape: "ring" }] : [{ color: "#fcd34d", label: "arrow: moment μ (random directions)", shape: "arrow" }, { color: "#a9d8ff", label: "sphere: a proton (conceptual)", shape: "dot" }]} />
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
      <p>“Up” and “down” are labels for m = ±½ along B₀. The moment is never exactly along z (|μ| = γħ√3/2, μ<sub>z</sub> = ±γħ/2), so the angle between μ and B₀ is arccos(1/√3) = {((CONE_ANGLE * 180) / Math.PI).toFixed(1)}° for α and {(180 - (CONE_ANGLE * 180) / Math.PI).toFixed(1)}° for β. In the 3D picture each arrow sits on that cone and precesses at ν₀; random phases around the cone give no net transverse magnetisation. This is a <b>conceptual</b> picture: quantum mechanics fixes the length and the z-component of μ but not its azimuth, so “an arrow going round a cone” is the standard classical-vector analogy, as is the turning sphere.</p>
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
      {f.applied && !teaching && <Badge testId="real-badge"><b>Real scale.</b> {st.nAlpha} of {ENSEMBLE.n} protons are drawn in α and {st.nBeta} in β; the true excess ({r.text.excess}) is far below one proton, so it cannot be drawn.</Badge>}
      {teaching && <Badge tone="warn" testId="teaching-badge"><b>Exaggerated.</b> The α excess is drawn about {fmtInt(exaggerationFactor())}× too large. The real excess is {sci(r.polarization, 2)} ({r.text.excess}).</Badge>}
      {f.applied && <p data-testid="precession-note">Once B₀ is on, each moment <b>precesses</b> about B₀ (rings: the circle each arrow tip follows) at the Larmor frequency ν₀, the same ν₀ that sets the gap ΔE = hν₀. Spinning of the sphere and precession of the arrow are different motions.</p>}
      <p className="ss-note" data-testid="spin-note">{SPIN_CLARIFICATION}</p>
      <p className="ss-note" data-testid="quantum-note">Not all nuclei are “aligned” with the field. Every nucleus is in α or β, and only a tiny excess is in α.</p>
    </StepFrame>
  );
}
