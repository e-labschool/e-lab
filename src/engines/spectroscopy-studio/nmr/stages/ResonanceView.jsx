import { useEffect, useMemo } from "react";
import { responseVsOffset, transverse } from "../physics/blochSim.js";
import { deriveExcitation } from "../physics/excitation.js";
import { GAMMA_BAR_MHZ_PER_T, B0_MAX, larmorMHz } from "../physics/constants.js";
import LinePlot from "../../components/LinePlot.jsx";
import Slot from "../../components/Slot.jsx";
import RfControls from "./RfControls.jsx";
import { Explain, Group, Stats, TeacherNote } from "../../components/ui.jsx";
import { useSize } from "../../components/useSize.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";

const RANGE_KHZ = 120;
const FOUND_TOL_HZ = 1000;
const OFFS = Array.from({ length: 2 * RANGE_KHZ + 1 }, (_, i) => (i - RANGE_KHZ) * 1000);

/** Activity 3.3: what happens when the radiofrequency matches the nuclear resonance? The curves are the Bloch-model response to the pulse. */
export default function ResonanceView({ slots }) {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const rf = useStudio((s) => s.rf);
  const mode = useStudio((s) => s.mode);
  const ex = useMemo(() => deriveExcitation(b0, rf), [b0, rf]);
  const [topRef, top] = useSize();
  const [botRef, bot] = useSize();
  const challenge = rf.challenge;
  const hidden = challenge === "active";
  const curve = useMemo(() => responseVsOffset(ex.sched, OFFS, { steps: 500 }), [ex.sched]);
  const here = useMemo(() => responseVsOffset(ex.sched, [Math.max(-5e6, Math.min(5e6, ex.offsetHz))], { steps: 800 })[0], [ex]);
  const found = Math.abs(ex.offsetHz) <= FOUND_TOL_HZ;
  const nu0MHz = larmorMHz(b0);
  const offK = ex.offsetHz / 1000;

  const startChallenge = () => {
    const sign = Math.floor(b0 * 10) % 2 === 0 ? 1 : -1; const mag = 22 + ((Math.floor(b0 * 10) * 7) % 25);
    a.patch("rf", { challenge: "active", b1uT: 587.2, tpUs: 10, rfMHz: Math.round((nu0MHz + (sign * mag) / 1000) * 1e6) / 1e6 });
  };
  useEffect(() => { if (challenge === "active" && found) a.patch("rf", { challenge: "found" }); }, [challenge, found, a]);

  const clickPlot = (e) => {
    if (hidden) return;
    const r = e.currentTarget.getBoundingClientRect(); const ml = 44; const mr = 10; const pw = r.width - ml - mr;
    const x = ((e.clientX - r.left - ml) / pw) * 2 * RANGE_KHZ - RANGE_KHZ;
    if (x < -RANGE_KHZ || x > RANGE_KHZ) return;
    a.patch("rf", { rfMHz: Math.round((nu0MHz + Math.round(x * 2) / 2 / 1000) * 1e6) / 1e6 });
  };

  const text = challenge === "active"
    ? "Challenge: the sample is only excited when the RF frequency matches the resonance. Adjust the RF frequency until the response meter is high, using the fine-step buttons near the end."
    : found
      ? `On resonance (offset ${offK.toFixed(2)} kHz): the effective field is B₁ alone, so the 90° pulse turns all of M into the transverse plane (M_xy = ${here.mxy.toFixed(2)} M₀).`
      : here.mxy > 0.97
        ? `Near resonance (${offK.toFixed(1)} kHz away, small compared with ν₁ = ${(ex.nu1 / 1000).toFixed(0)} kHz): the pulse still turns almost all of M into the transverse plane (M_xy = ${here.mxy.toFixed(2)} M₀). A short pulse excites a band of frequencies, not a single one.`
        : `Off resonance by ${Math.abs(offK) > 2000 ? `${(offK / 1000).toFixed(2)} MHz` : `${offK.toFixed(1)} kHz`}: the effective field is tilted towards z, so the same pulse leaves M_xy = ${here.mxy.toFixed(2)} M₀ and M_z = ${here.mz.toFixed(2)} M₀.`;

  return (
    <>
      <div className="ss-res" data-testid="resonance-view">
        <div className="ss-res-top" ref={topRef}>
          <h3 className="ss-viz-title">What happens when the radiofrequency matches the nuclear resonance?</h3>
          {hidden ? (
            <div className="ss-meter" data-testid="response-meter" role="status" aria-live="polite">
              <p>Sample response after the pulse (M<sub>xy</sub> / M₀)</p>
              <div className="ss-meter-bar"><div style={{ width: `${Math.round(here.mxy * 100)}%` }} /></div>
              <p><b>{Math.round(here.mxy * 100)} %</b> — the curve and the offset are hidden during the challenge.</p>
            </div>
          ) : (
            <div className="ss-clickplot" onClick={clickPlot} data-testid="response-plot" title="Click the plot to set the RF frequency">
              <LinePlot
                width={top.width} height={Math.max(120, top.height - 56)} xDomain={[-RANGE_KHZ, RANGE_KHZ]} yDomain={[-1.1, 1.1]} xLabel="RF frequency minus resonance ν_rf − ν₀ (kHz)" yLabel="after the pulse (× M₀)"
                ariaLabel="Response of the magnetisation after the pulse against the RF offset from resonance" testId="plot-response"
                markers={[{ x: Math.max(-RANGE_KHZ, Math.min(RANGE_KHZ, offK)), color: "var(--ss-rf)" }]}
                series={[
                  { x: curve.map((c) => c.offsetHz / 1000), y: curve.map((c) => c.mxy), color: "#f472b6", width: 2.4, fillTo: 0 },
                  { x: curve.map((c) => c.offsetHz / 1000), y: curve.map((c) => c.mz), color: "#fcd34d", width: 1.8 },
                ]}
                overlay={({ sx, sy }) => (
                  <g>
                    <circle cx={sx(Math.max(-RANGE_KHZ, Math.min(RANGE_KHZ, offK)))} cy={sy(here.mxy)} r="5" fill="#f472b6" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={sx(Math.max(-RANGE_KHZ, Math.min(RANGE_KHZ, offK)))} cy={sy(here.mz)} r="5" fill="#fcd34d" stroke="#fff" strokeWidth="1.5" />
                  </g>
                )}
              />
            </div>
          )}
          {!hidden && <ul className="ss-legend ss-legend-inline" style={{ marginTop: 2 }}><li><span className="ss-dot ss-dot--bar" style={{ background: "#f472b6" }} aria-hidden="true" />M<sub>xy</sub> after the pulse (detectable)</li><li><span className="ss-dot ss-dot--bar" style={{ background: "#fcd34d" }} aria-hidden="true" />M<sub>z</sub> after the pulse</li><li><span className="ss-dot ss-dot--bar" style={{ background: "#fb923c" }} aria-hidden="true" />your RF frequency</li></ul>}
        </div>
        <div className="ss-res-bottom" ref={botRef}>
          <div className="ss-res-plot2">
            <LinePlot
              width={Math.max(120, bot.width * 0.55)} height={Math.max(110, bot.height)} xDomain={[0, B0_MAX]} yDomain={[0, 650]} xLabel="B₀ (T)" yLabel="ν₀ (MHz)" testId="plot-nu-b0"
              ariaLabel="Resonance frequency against magnetic field strength: a straight line through the origin"
              series={[{ x: [0, B0_MAX], y: [0, GAMMA_BAR_MHZ_PER_T * B0_MAX], color: "#38bdf8", width: 2.2 }]}
              markers={[{ x: b0, color: "#38bdf8", dash: "3 3" }]}
              overlay={({ sx, sy }) => (
                <g>
                  <circle cx={sx(b0)} cy={sy(nu0MHz)} r="5.5" fill="#38bdf8" stroke="#fff" strokeWidth="1.5" />
                  <text x={sx(b0) + 8} y={sy(nu0MHz) + 16} className="ss-svgtext ss-svgtext--sm">ν₀ = {nu0MHz.toFixed(1)} MHz</text>
                  {rf.rfMHz > 0 && rf.rfMHz < 650 && <line x1={sx(0)} x2={sx(B0_MAX)} y1={sy(rf.rfMHz)} y2={sy(rf.rfMHz)} stroke="#fb923c" strokeWidth="1.4" strokeDasharray="5 4" />}
                  {rf.rfMHz > 0 && rf.rfMHz < 650 && <text x={sx(0.2)} y={sy(rf.rfMHz) - 5} className="ss-svgtext ss-svgtext--sm" fill="#fdba74">RF {rf.rfMHz.toFixed(1)} MHz matches at {(rf.rfMHz / GAMMA_BAR_MHZ_PER_T).toFixed(2)} T</text>}
                </g>
              )}
            />
          </div>
          <div className="ss-res-facts">
            <Stats columns={1} items={[
              { id: "res-nu0", label: "Resonance ν₀ = γB₀/2π", value: nu0MHz.toFixed(3), unit: "MHz", tone: "b0" },
              { id: "res-off", label: "RF offset", value: hidden ? "hidden" : `${offK >= 0 ? "+" : "−"}${Math.abs(offK) >= 1000 ? (Math.abs(offK) / 1000).toFixed(2) + " MHz" : Math.abs(offK).toFixed(1) + " kHz"}` },
              { id: "res-mxy", label: "M_xy after the pulse", value: `${(here.mxy * 100).toFixed(0)}`, unit: "% of M₀", tone: "mxy" },
            ]} />
            <p className="ss-hint">ν₀ is proportional to B₀: {GAMMA_BAR_MHZ_PER_T.toFixed(3)} MHz per tesla for ¹H.</p>
          </div>
        </div>
      </div>

      <Slot target={slots.controls}>
        <RfControls
          ex={ex} showFrame={false} showRelax={false} hideOffset={hidden}
          onApply={() => { a.resetPlayback(); a.setActivity("principle", "rf"); setTimeout(() => a.setPlaying(true), 50); }}
          challengeBlock={(
            <Group title="Challenge 1: find the resonance" testId="grp-challenge1">
              {mode === "teacher" && challenge === "idle" && <p className="ss-hint">Teacher: the challenge hides the curve and the offset, so students must locate ν₀ from the sample response alone.</p>}
              {challenge === "idle" && <button type="button" className="sd-btn sd-btn--primary" onClick={startChallenge} data-testid="start-challenge">Start challenge</button>}
              {challenge === "active" && (
                <>
                  <p className="ss-hint" role="status">Adjust the RF frequency until the sample responds. The target is within 1 kHz.</p>
                  <button type="button" className="sd-btn sd-btn--sm" onClick={() => a.patch("rf", { challenge: "idle" })} data-testid="give-up">Show the curve</button>
                </>
              )}
              {challenge === "found" && (
                <>
                  <p className="ss-predict-fb is-ok" role="status" data-testid="challenge-found"><b>Found it.</b> The strongest response is at ν_rf = ν₀ = γB₀/2π = {nu0MHz.toFixed(4)} MHz (offset {offK.toFixed(2)} kHz). Change B₀ and it moves.</p>
                  <button type="button" className="sd-btn sd-btn--sm" onClick={() => a.patch("rf", { challenge: "idle" })} data-testid="challenge-retry">Try again</button>
                </>
              )}
            </Group>
          )}
        />
        <TeacherNote title="Teacher: reading the response curve">
          <p>For a pulse of length t_p the response is the Bloch-equation result: with B_eff = (B₁, 0, Δ/γ) the magnetisation turns about B_eff by |Ω|t_p, so M_xy = (ω₁/|Ω|)·√(…) is largest at Δ = 0 and falls off with a sinc-like shape of width ~1/t_p. Shorter, stronger pulses excite a wider range of frequencies.</p>
        </TeacherNote>
      </Slot>
      <Slot target={slots.graph}>
        <Group title="After the pulse" testId="grp-res-split">
          <Stats columns={2} items={[
            { id: "sp-mz", label: "Mz / M₀", value: here.mz.toFixed(3), tone: "mag" },
            { id: "sp-mxy", label: "Mxy / M₀", value: transverse([here.mx, here.my, 0]).toFixed(3), tone: "mxy" },
          ]} />
          <p className="ss-hint">Only transverse magnetisation induces a signal in the receiver coil. Where the curve is low, the same pulse produces little signal.</p>
        </Group>
      </Slot>
      <Explain slots={slots}>{text}</Explain>
    </>
  );
}
