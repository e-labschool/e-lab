import { useState } from "react";
import StepFrame from "../../components/StepFrame.jsx";
import { BigSlider, Readouts } from "../../components/ui.jsx";
import { usePhase } from "../../components/useAnim.js";
import { useReducedMotion, useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { H_PLANCK, larmorHz, larmorMHz, sci } from "../physics/constants.js";
import { fieldReadouts } from "../physics/fieldModel.js";
import { CW, CW_FWHM_HZ, CW_SPAN_HZ, cwAbsorption, cwFwhm, cwRegion, rfFromOffset, rfOffsetHz } from "../physics/cwResponse.js";
import { displayPolarization, exaggerationFactor } from "../physics/populations.js";
import { IRRADIATION_WINDOW_S, modelSecondsPerDisplaySecond, populationDifferenceDisplay, populationDifferenceSteady } from "../physics/rfPopulation.js";
import ChainStrip from "./ChainStrip.jsx";
import LevelsDiagram from "./LevelsDiagram.jsx";
import ResponseGraph from "./ResponseGraph.jsx";
import RfWave from "./RfWave.jsx";
import { LARMOR_NOTE } from "./texts.js";

const signed = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x))}`;
const fmtInt = (x) => Math.round(x).toLocaleString("en-US").replace(/,/g, " ");

/** Seconds of RF irradiation (animation time) at the current RF frequency: restarts from equilibrium whenever the frequency changes; a finite window; static (window end) with reduced motion. */
function useIrradiation(off, phase, reduced) {
  const [st, setSt] = useState({ off, at: phase });
  let cur = st;
  if (st.off !== off) { cur = { off, at: phase }; setSt(cur); }
  return reduced ? IRRADIATION_WINDOW_S : Math.min(IRRADIATION_WINDOW_S, Math.max(0, phase - cur.at));
}

/**
 * Step 3: ONE incoming RF wave travelling to a proton model, the alpha / beta energy-level diagram beside it, the chain
 * applied field -> splitting -> matching RF energy -> resonance -> absorption, and ONE slider (the RF frequency) with the simplified CW response graph.
 */
export default function Step3Radio() {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const rfMHz = useStudio((s) => s.rf.rfMHz);
  const reduced = useReducedMotion();
  const phase = usePhase();
  const r = fieldReadouts(b0);
  const nu0 = larmorMHz(b0); const nu0Hz = larmorHz(b0);
  const off = Math.round(rfOffsetHz(rfMHz, b0));
  const resp = cwAbsorption(off); const region = cwRegion(off); const on = region === "on";
  const fwhm = cwFwhm();
  const t = useIrradiation(off, phase, reduced);
  const d = populationDifferenceDisplay(off, t);
  const dEnd = populationDifferenceSteady(off);
  const pDisp = displayPolarization("teaching", b0);

  const viz = (
    <div className="ss-rfview" data-testid="rf-view" data-offset={off} data-region={region} data-on-resonance={on ? "1" : "0"} data-response={resp.toFixed(3)}>
      <ChainStrip region={region} />
      <div className="ss-rf-wave"><RfWave response={resp} region={region} phase={phase} nu0Hz={nu0Hz} /></div>
      <div className="ss-rf-levels" data-testid="energy-panel">
        <LevelsDiagram b0={b0} p={1} polarization={pDisp} exaggerated rf={{ response: resp, region, offsetHz: off, d, phase }} />
      </div>
      <div className="ss-rf-graph" data-testid="cw-graph-box"><ResponseGraph off={off} /></div>
    </div>
  );
  const strip = (
    <BigSlider
      id="ss-rf" label="RF frequency" symbol="ν_RF" value={off} min={-CW_SPAN_HZ} max={CW_SPAN_HZ} step={1} onChange={(v) => a.patch("rf", { rfMHz: rfFromOffset(v, b0) })}
      badge={`${rfMHz.toFixed(7)} MHz  (ν₀ ${signed(off)} Hz)`} valueText={`RF frequency ${rfMHz.toFixed(7)} megahertz, ${signed(off)} hertz from the resonance at ${nu0.toFixed(7)} megahertz`} color="#fb923c"
      ticks={[{ at: 0, label: "ν₀ − 100 Hz" }, { at: 0.5, label: `ν₀ = ${nu0.toFixed(4)} MHz` }, { at: 1, label: "ν₀ + 100 Hz" }]} testId="rf-slider"
    />
  );
  const teacher = (
    <>
      <p><b>The response curve.</b> It is the steady state of the same Bloch equations used elsewhere in the lab (rotating frame): M<sub>y</sub> = M₀ω₁T₂ / (1 + Δ²T₂² + ω₁²T₁T₂), a Lorentzian in Δ = 2π(ν₀ − ν_RF) of full width at half maximum (1/πT₂)√(1 + s), s = ω₁²T₁T₂. The absorbed power is proportional to M<sub>y</sub>. The curve and the region labels are computed from this width: <i>on</i> = within ±FWHM/2 (response ≥ ½), <i>near</i> = within ±FWHM, otherwise <i>off</i>.</p>
      <p><b>The population model.</b> The same equations give the α−β population difference D = M<sub>z</sub>/M₀ = 1 − s/(1 + s)·L(offset), where L is the plotted response, approached exponentially with τ = T₁(1 + s − sL)/(1 + s) when the RF is switched on. With s = {(CW.omega1 ** 2 * CW.t1 * CW.t2).toFixed(0)} the difference is at most halved on resonance and never reversed, so β moves <i>towards</i> equal populations, never beyond. The animation shows {IRRADIATION_WINDOW_S} s of irradiation from equilibrium (it restarts when the RF frequency changes); one animation second stands for {(1000 * modelSecondsPerDisplaySecond()).toFixed(1)} ms of model time.</p>
      <p><b>Illustrative values.</b> The width is {CW_FWHM_HZ} Hz (T₂ ≈ T₁ ≈ {(1000 * CW.t2).toFixed(0)} ms) so that the line can be found with a ±{CW_SPAN_HZ} Hz slider; real ¹H lines in solution are about 1 Hz wide or narrower, one part in 10⁹ of ν₀. The RF is stronger (s = 1) than in a real CW experiment so that the saturation can be seen. The bars use the labelled exaggeration (about {fmtInt(exaggerationFactor())}×) because the real excess ({r.text.excess}) is too small to draw.</p>
      <p><b>Not a pulsed experiment.</b> A modern spectrometer excites with a short pulse, which contains a whole band of frequencies, so it never needs to “find” each resonance. Steps 4 and 5 separate RF excitation, the FID and the Fourier transform.</p>
    </>
  );
  return (
    <StepFrame step={3} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--rf">
      <p className="ss-statehead" data-testid="resonance-state" data-region={region} aria-live="polite">
        {on ? "Resonance achieved" : region === "near" ? "Near resonance" : "Off resonance"}
      </p>
      <p data-testid="what-is-happening">
        {on
          ? <>The photon energy matches the gap, <b>hν_RF = ΔE</b>, so the RF energy is <b>absorbed</b>: the response is {Math.round(resp * 100)} % of its maximum, and the excited-state (β) population rises towards equal populations, but not beyond.</>
          : region === "near"
            ? <>The RF is {signed(off)} Hz from ν₀, within one linewidth. hν_RF is almost, but not quite, ΔE, so only part of the energy is absorbed ({Math.round(resp * 100)} % of the maximum).</>
            : <>The wave reaches the proton, but it is {signed(off)} Hz from ν₀, more than one linewidth ({fwhm.toFixed(0)} Hz). hν_RF ≠ ΔE (it differs by h × {signed(off)} Hz), so the levels stay as they are and there is little or no excitation ({Math.round(resp * 100)} %).</>}
      </p>
      <p data-testid="larmor-note"><b>Larmor frequency (ν₀).</b> {LARMOR_NOTE}</p>
      <p className="ss-note" data-testid="ensemble-note"><b>One arrow is a teaching model of one nucleus.</b> A real sample is an ensemble: resonant RF changes the spin populations (N<sub>β</sub> rises towards, never beyond, N<sub>α</sub>) and creates coherent transverse magnetisation. RF excitation, the FID and the Fourier transform are separated in steps 4 and 5.</p>
      <Readouts items={[
        { id: "nurf", label: "ν_RF", value: `${rfMHz.toFixed(7)} MHz`, tone: "rf" },
        { id: "nu0", label: `ν₀ = γB₀/2π at ${r.text.b0}`, value: `${nu0.toFixed(7)} MHz`, tone: "b0" },
        { id: "off", label: "ν_RF − ν₀", value: `${signed(off)} Hz`, tone: on ? "ok" : "rf" },
        { id: "diff", label: "hν_RF − ΔE", value: off === 0 ? "0 J" : `${sci(H_PLANCK * off, 2)} J`, tone: on ? "ok" : "rf", title: `Tiny in absolute terms, but the resonance is only about ${CW_FWHM_HZ} Hz wide` },
      ]} />
      <span className="ss-sr" data-testid="irradiation" data-t={t.toFixed(2)} data-d={d.toFixed(4)} data-d-final={dEnd.toFixed(4)}>{`RF on for ${t.toFixed(1)} s of animation; α−β difference ${Math.round(d * 100)} % of equilibrium`}</span>
    </StepFrame>
  );
}
