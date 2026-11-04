import { useEffect, useMemo, useRef, useState } from "react";
import { MiniSwitch, SettingToggle, SliderRow, StepButton } from "../../../../components/simulation/SimulationDashboard.jsx";
import { B0_MAX, B0_MIN, GAMMA_H1, MU_Z, TEMPERATURE_K, larmorMHz, sci } from "../physics/constants.js";
import { displayPolarization, excessPerMillion, exaggerationFactor, polarization } from "../physics/populations.js";
import { assignStates } from "../physics/spinEnsemble.js";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import Slot from "../../components/Slot.jsx";
import SpinChamberScene, { ENSEMBLE } from "../scene/SpinChamberScene.jsx";
import EnergyLevelDiagram from "./EnergyLevelDiagram.jsx";
import { Explain, Group, Legend, PredictBox, Stats, TeacherNote, useTween } from "../../components/ui.jsx";
import { usePhase } from "../../components/useTimeline.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";

const fmtInt = (x) => Math.round(x).toLocaleString("en-US").replace(/,/g, " ");

/** Stage 1, activity 2: a chamber of nuclei, the field B0, the two spin states and the energy-level diagram beside it. */
export default function FieldView({ slots }) {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const f = useStudio((s) => s.field);
  const mode = useStudio((s) => s.mode);
  const applyP = useTween(f.applied ? 1 : 0, 1300);
  const phase = usePhase({ enabled: f.applied && f.view === "scientific", speedScale: 1 });
  const dispP = displayPolarization(f.popMode, b0);
  const realP = polarization(b0);
  const teaching = f.popMode === "teaching";
  const live = useRef({ apply: 0, phase: 0, view: "simplified", polarization: 0, m0Length: 0 });
  live.current = { apply: applyP, phase: phase * 2 * Math.PI * 0.4, view: f.view, polarization: dispP, m0Length: teaching ? 2.4 * dispP : 0 };
  const [selected, setSelected] = useState(0);
  const st = useMemo(() => assignStates(ENSEMBLE, dispP), [dispP]);
  const nu0 = larmorMHz(b0);
  const alphaFrac = (1 + dispP) / 2; const betaFrac = (1 - dispP) / 2;
  const perM = excessPerMillion(b0);
  const selState = f.applied ? (st.alpha[selected] ? "α (m = +½, lower energy)" : "β (m = −½, higher energy)") : "no preferred orientation (field off)";
  const lastB0 = useRef(b0);
  const [b0Changed, setB0Changed] = useState(false);
  useEffect(() => { if (lastB0.current !== b0) { lastB0.current = b0; setB0Changed(true); } }, [b0]);

  const text = !f.applied
    ? "No field: each nucleus has a magnetic moment but no direction is preferred. The arrows point everywhere, the net magnetisation is zero and the two spin states have the same energy. Press Apply Magnetic Field."
    : `In B₀ = ${b0.toFixed(1)} T the two spin states split by ΔE = hν₀ with ν₀ = γB₀/2π = ${nu0.toFixed(1)} MHz. α (lower energy) is only very slightly more populated than β (${perM.toFixed(0)} extra per million nuclei at ${TEMPERATURE_K} K), and that small excess is the net magnetisation M₀. ${b0Changed ? "Doubling B₀ doubles both ΔE and ν₀." : ""}`;

  return (
    <>
      <div className="ss-field-split" data-testid="field-view">
        <div className="ss-viz ss-viz--main" data-testid="spin-viz">
          <ThreeCanvas label="Chamber of hydrogen nuclei with arrows for their magnetic moments, before and after the magnetic field is applied" position={[3.6, -4.2, 2.4]}>
            <SpinChamberScene live={live} selected={selected} onSelect={setSelected} showArrows={f.arrows} labels={f.labels} />
          </ThreeCanvas>
          <Legend className="ss-legend-bl" items={f.applied ? [{ color: "#2dd4bf", label: "α: lower energy" }, { color: "#a78bfa", label: "β: higher energy" }, { color: "#38bdf8", label: "field B₀", shape: "arrow" }, { color: "#fcd34d", label: "net M₀", shape: "arrow" }, { color: "#ffffff", label: "inspected nucleus" }] : [{ color: "#c7d2ea", label: "nuclear magnetic moment (random directions)" }, { color: "#ffffff", label: "inspected nucleus" }]} />
          {teaching && <div className="ss-badge-tl ss-badge--warn" data-testid="teaching-badge"><b>Exaggerated teaching mode</b><span>The α excess is drawn ~{fmtInt(exaggerationFactor())}× too large so that it can be seen. Real value: {sci(realP, 2)}.</span></div>}
          {!teaching && f.applied && <div className="ss-badge-tl" data-testid="real-badge"><b>Real scale</b><span>{st.nAlpha} of {ENSEMBLE.n} arrows up, {st.nBeta} down: the true excess ({sci(realP, 2)}) is far below one arrow, so the net M₀ cannot be drawn.</span></div>}
          <div className="ss-hud" data-testid="spin-hud"><span>Inspected nucleus #{selected + 1}: <b>{selState}</b></span></div>
        </div>
        <div className="ss-field-side" data-testid="energy-panel">
          <EnergyLevelDiagram
            b0={b0} applyP={applyP} alphaFrac={alphaFrac} betaFrac={betaFrac}
            popLabel={{ alpha: teaching ? `${(alphaFrac * 100).toFixed(0)} %` : `${fmtInt(1e6 * alphaFrac)} per million`, beta: teaching ? `${(betaFrac * 100).toFixed(0)} %` : `${fmtInt(1e6 * betaFrac)} per million` }}
            populationsText={teaching ? "Population bars are exaggerated (teaching mode)." : "Population bars use the true values: they look equal."}
          />
        </div>
      </div>

      <Slot target={slots.controls}>
        <Group title="Magnetic field" testId="grp-field">
          <button type="button" className="sd-btn sd-btn--primary" onClick={() => a.patch("field", { applied: !f.applied })} aria-pressed={f.applied} data-testid="apply-field">
            {f.applied ? "Remove Magnetic Field" : "Apply Magnetic Field"}
          </button>
          <SliderRow
            id="ss-b0" label="Field strength" symbol="B₀" value={b0} min={B0_MIN} max={B0_MAX} step={0.1} onChange={a.setB0} color="#38bdf8" badgeBg="#0b5d8f"
            badgeText={`${b0.toFixed(1)} T`} minText="1" maxText="14 T" valueText={`${b0.toFixed(1)} tesla, resonance frequency ${nu0.toFixed(1)} megahertz`} testId="b0"
            slideStart={<StepButton dir={-1} label="Decrease field by 0.1 tesla" onClick={() => a.setB0(b0 - 0.1)} testId="b0-down" />}
            slideEnd={<StepButton dir={1} label="Increase field by 0.1 tesla" onClick={() => a.setB0(b0 + 0.1)} testId="b0-up" />}
          />
          <Stats columns={2} items={[
            { id: "nu0", label: "Resonance ν₀", value: nu0.toFixed(1), unit: "MHz", tone: "b0", title: "nu0 = gamma B0 / 2 pi" },
            { id: "dE", label: "Energy gap ΔE", value: sci(6.62607015e-34 * nu0 * 1e6, 2), unit: "J", tone: "b0", title: "Delta E = h nu0" },
            { id: "pol", label: "Excess (α−β)/N", value: sci(realP, 2), tone: "mag", title: `Boltzmann polarisation at ${TEMPERATURE_K} K` },
            { id: "perm", label: "Excess per million", value: perM.toFixed(1), tone: "mag" },
          ]} />
          <p className="ss-hint ss-const" data-testid="constants-note">T = {TEMPERATURE_K} K (assumed) · γ(¹H) = {sci(GAMMA_H1, 4)} rad s⁻¹ T⁻¹ = 42.577 MHz T⁻¹ · μ_z = ±γħ/2 = ±{sci(MU_Z, 3)} J T⁻¹</p>
        </Group>
        <Group title="Display" testId="grp-display">
          <MiniSwitch ariaLabel="Population scale" testId="pop-switch" fill value={f.popMode} onChange={(v) => a.patch("field", { popMode: v })}
            options={[{ id: "real", label: "Real scale", title: "True populations: the excess is ~3 × 10⁻⁵" }, { id: "teaching", label: "Exaggerated", title: "Teaching mode: the excess is multiplied by a constant factor so that it can be seen" }]} />
          <MiniSwitch ariaLabel="Simplified or scientific view" testId="view-switch" fill value={f.view} onChange={(v) => a.patch("field", { view: v })}
            options={[{ id: "simplified", label: "Simplified view", title: "Plain up and down arrows" }, { id: "scientific", label: "Scientific view", title: "Moments on cones at 54.7° that precess about B0" }]} />
          <SettingToggle id="ss-t-arrows" label="Show magnetic-moment arrows" checked={f.arrows} onChange={(v) => a.patch("field", { arrows: v })} testId="toggle-arrows" />
          <SettingToggle id="ss-t-labels" label="Show labels" checked={f.labels} onChange={(v) => a.patch("field", { labels: v })} testId="toggle-labels" />
        </Group>
        {mode === "student" && (
          <PredictBox
            testId="predict-b0" question="B₀ is raised from 9.4 T to 14 T. What happens to the proton resonance frequency?"
            options={[{ id: "up", label: "It increases" }, { id: "same", label: "It stays the same" }, { id: "down", label: "It decreases" }]} correct="up"
            feedback={(id) => (id === "up" ? `ν₀ = γB₀/2π is proportional to B₀: 400.2 MHz at 9.4 T becomes ${larmorMHz(14).toFixed(1)} MHz at 14 T, and the energy gap grows by the same factor.` : "The gap ΔE = γħB₀ and ν₀ = ΔE/h both grow in proportion to B₀. Try the slider.")}
          />
        )}
        <TeacherNote title="Teacher: what to stress">
          <p>Every nucleus is in α <i>or</i> β (a superposition is possible, but a measurement along B₀ gives one of two values). The ensemble has only a tiny <b>excess</b> in α: about {perM.toFixed(0)} per million at {b0.toFixed(1)} T. That is why NMR is an intrinsically insensitive technique and why higher fields help.</p>
          <p>“Up” and “down” are labels for m = ±½ along B₀. The moment is never exactly along z: |μ| = γħ√3/2, so it sits on a cone (scientific view) and precesses at ν₀. Random phases around the cone mean no net transverse magnetisation at equilibrium.</p>
          <p>Exaggerated mode multiplies the real excess by a constant factor {fmtInt(exaggerationFactor())} (still linear in B₀) purely for visibility.</p>
        </TeacherNote>
      </Slot>
      <Slot target={slots.graph}>
        <Group title="Population difference and M₀" testId="grp-pops">
          <Stats columns={2} items={[
            { id: "pa", label: "N_α per million", value: fmtInt(1e6 * (1 + realP) / 2), tone: "alpha" },
            { id: "pb", label: "N_β per million", value: fmtInt(1e6 * (1 - realP) / 2), tone: "beta" },
          ]} />
          <p className="ss-hint">M₀ = N(γħ/2)·(N_α − N_β)/N is proportional to B₀ here (polarisation ∝ B₀ because ΔE ≪ kT). This is the net longitudinal magnetisation that the RF pulse will tip.</p>
        </Group>
      </Slot>
      <Explain slots={slots}>{text}</Explain>
    </>
  );
}
