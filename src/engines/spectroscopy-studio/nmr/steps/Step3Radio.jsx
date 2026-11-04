import { useMemo } from "react";
import StepFrame from "../../components/StepFrame.jsx";
import LinePlot from "../../components/LinePlot.jsx";
import { Badge, BigSlider, Readouts } from "../../components/ui.jsx";
import { usePhase } from "../../components/useAnim.js";
import { useSize } from "../../components/useSize.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { H_PLANCK, larmorMHz, sci } from "../physics/constants.js";
import { fieldReadouts } from "../physics/fieldModel.js";
import { CW, CW_FWHM_HZ, CW_LABEL, CW_SPAN_HZ, cwAbsorption, cwCurve, cwFwhm, cwOnResonance, rfFromOffset, rfOffsetHz } from "../physics/cwResponse.js";
import RfWaves from "./RfWaves.jsx";

const CURVE = cwCurve(CW_SPAN_HZ, 401);
const signed = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x))}`;

/** Step 3: an incoming RF wave and ONE slider for its frequency, centred on the resonance of the field chosen in step 2, with a live response graph. */
export default function Step3Radio() {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const rfMHz = useStudio((s) => s.rf.rfMHz);
  const phase = usePhase();
  const [ref, size] = useSize();
  const r = fieldReadouts(b0);
  const nu0 = larmorMHz(b0);
  const off = Math.round(rfOffsetHz(rfMHz, b0));
  const on = cwOnResonance(off);
  const abs = cwAbsorption(off);
  const fwhm = cwFwhm();
  const abbrev = useMemo(() => (size.height < 250 || size.width < 380), [size]);

  const graph = (
    <div className="ss-graphbox" ref={ref} data-testid="cw-graph-box">
      <LinePlot
        width={size.width} height={size.height} series={[{ x: CURVE.x, y: CURVE.y, color: "var(--ss-cyan)", width: 3, fillTo: 0 }]}
        xDomain={[-CW_SPAN_HZ, CW_SPAN_HZ]} yDomain={[0, 1.12]} xLabel="RF frequency offset from resonance, ν_rf − ν₀ (Hz)" yLabel="Response (absorption)" xFormat={(v) => signed(v)} yFormat={(v) => (v === 0 ? "0" : v === 1 ? "max" : "")}
        xTicks={[-100, -50, 0, 50, 100]} margin={{ l: 50, r: 26, t: 10, b: 44 }} yTicks={[0, 1]} ariaLabel={`Response of the nuclei to a continuous RF wave against its frequency: a peak at resonance. The RF is ${signed(off)} hertz from resonance, absorption ${Math.round(abs * 100)} percent of the maximum.`}
        testId="cw-graph"
        overlay={({ sx, sy, plot }) => (
          <g data-testid="cw-overlay" data-offset={off} data-on-resonance={on ? "1" : "0"}>
            <rect x={sx(-fwhm / 2)} width={sx(fwhm / 2) - sx(-fwhm / 2)} y={plot.t} height={plot.h} fill="var(--ss-amber)" opacity={on ? 0.28 : 0.1} data-testid="cw-resonance-band" />
            <line x1={sx(0)} x2={sx(0)} y1={plot.t} y2={plot.t + plot.h} stroke="var(--ss-amber)" strokeWidth="2" strokeDasharray="6 4" />
            <text x={sx(0) + 6} y={plot.t + 14} className="ss-svgtext ss-svgtext--b" fill="var(--ss-amber)">resonance: hν = ΔE</text>
            <line x1={sx(off)} x2={sx(off)} y1={sy(abs)} y2={plot.t + plot.h} stroke="var(--ss-rf)" strokeWidth="2" opacity="0.9" />
            <circle cx={sx(off)} cy={sy(abs)} r={on ? 9 : 7} fill="var(--ss-rf)" stroke="#fff" strokeWidth="2.5" data-testid="cw-dot" data-y={abs.toFixed(4)} />
            {!abbrev && <text x={sx(off) + (off > 60 ? -12 : 12)} y={sy(abs) - 12} textAnchor={off > 60 ? "end" : "start"} className="ss-svgtext ss-svgtext--b" fill="var(--ss-rf)">{`${Math.round(abs * 100)} %`}</text>}
          </g>
        )}
      />
    </div>
  );
  const viz = (
    <div className="ss-stack2" data-testid="rf-view" data-offset={off} data-on-resonance={on ? "1" : "0"}>
      <div className="ss-top"><RfWaves offsetHz={off} phase={phase} onResonance={on} absorption={abs} /></div>
      <div className="ss-bottomgraph">
        <Badge className="ss-badge--tr" testId="cw-label"><b>{CW_LABEL}</b></Badge>
        {graph}
      </div>
    </div>
  );
  const strip = (
    <BigSlider
      id="ss-rf" label="RF frequency" symbol="ν_rf" value={off} min={-CW_SPAN_HZ} max={CW_SPAN_HZ} step={1} onChange={(v) => a.patch("rf", { rfMHz: rfFromOffset(v, b0) })}
      badge={`${rfMHz.toFixed(6)} MHz  (ν₀ ${signed(off)} Hz)`} valueText={`RF frequency ${rfMHz.toFixed(6)} megahertz, ${signed(off)} hertz from the resonance at ${nu0.toFixed(6)} megahertz`} color="#fb923c"
      ticks={[{ at: 0, label: "ν₀ − 100 Hz" }, { at: 0.5, label: `ν₀ = ${nu0.toFixed(3)} MHz` }, { at: 1, label: "ν₀ + 100 Hz" }]} testId="rf-slider"
    />
  );
  const teacher = (
    <>
      <p><b>How the curve is derived.</b> It is the steady state of the same Bloch equations used in the rest of the lab (rotating frame): M<sub>y</sub> = M₀ω₁T₂ / (1 + Δ²T₂² + ω₁²T₁T₂), a Lorentzian in Δ = 2π(ν₀ − ν_rf). Its full width at half maximum is (1/πT₂)√(1 + s) with s = ω₁²T₁T₂ ≪ 1 (a weak field, s = 0.05 here). The absorbed power is proportional to M<sub>y</sub>.</p>
      <p><b>Widths are illustrative.</b> The width here is {CW_FWHM_HZ} Hz (T₂ ≈ {(1000 * CW.t2).toFixed(0)} ms) so the line can be found with a ±{CW_SPAN_HZ} Hz slider. Real ¹H lines in solution are about 1 Hz wide or narrower, one part in 10⁹ of ν₀.</p>
      <p>Because a modern spectrometer excites with a short pulse, which contains a whole band of frequencies, it never needs to “find” each resonance. That is the idea of steps 4 and 5.</p>
    </>
  );
  return (
    <StepFrame step={3} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--stack">
      <p data-testid="what-is-happening" aria-live="polite">
        {on
          ? <>The RF wave is <b>in step</b> with the precessing nuclei: its photon energy matches the gap, <b>hν_rf = ΔE</b>, so the nuclei absorb energy and flip between α and β (ΔE = hν₀ = {sci(r.dEJ, 3)} J). The response is at its <b>maximum</b>.</>
          : <>The RF frequency is {signed(off)} Hz away from ν₀. Its photon energy does not match the gap (<b>hν_rf ≠ ΔE</b>; the difference is only h × {signed(off)} Hz, small in joules but large compared with the narrow resonance), so the nuclei hardly respond: {Math.round(abs * 100)} % of the maximum.</>}
      </p>
      <p className="ss-prompt">Slide the RF frequency until the response peaks.</p>
      <Readouts items={[
        { id: "nurf", label: "ν_rf", value: `${rfMHz.toFixed(6)} MHz`, tone: "rf" },
        { id: "nu0", label: `ν₀ at ${r.text.b0}`, value: `${nu0.toFixed(6)} MHz`, tone: "b0" },
        { id: "off", label: "ν_rf − ν₀", value: `${signed(off)} Hz`, tone: on ? "ok" : "rf" },
        { id: "diff", label: "hν_rf − ΔE", value: off === 0 ? "0 J" : `${sci(H_PLANCK * off, 2)} J`, tone: on ? "ok" : "rf", title: "Tiny in absolute terms, but the resonance is only about 20 Hz wide" },
      ]} />
      <p className="ss-note" data-testid="pulse-note"><b>Why a simplified model?</b> Modern spectrometers do not sweep one frequency. They use short RF <b>pulses</b> plus a <b>Fourier transform</b> (steps 4 and 5).</p>
    </StepFrame>
  );
}
