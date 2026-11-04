import { useMemo } from "react";
import { trajectory, stateAt, transverse } from "../physics/blochSim.js";
import { LAB_DISPLAY_RATE, PULSE_DISPLAY_S, RF_DURATION, deriveExcitation } from "../physics/excitation.js";
import { polarization } from "../physics/populations.js";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import LinePlot from "../../components/LinePlot.jsx";
import Slot from "../../components/Slot.jsx";
import BlochScene from "../scene/BlochScene.jsx";
import RfControls from "./RfControls.jsx";
import { Explain, Group, Legend, PredictBox, Stats, TeacherNote } from "../../components/ui.jsx";
import { useSize } from "../../components/useSize.js";
import { useTimeline } from "../../components/useTimeline.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { sci } from "../physics/constants.js";

/** The oscillating RF field beside the sample (conceptual strip). The drawn oscillation is ~10^7 times slower than the real one. */
function RfStrip({ amount, phase, ex }) {
  const W = 600; const H = 54; const amp = 6 + 14 * Math.min(1, ex.nu1 / 42000);
  const pts = []; for (let x = 118; x <= W - 10; x += 4) pts.push(`${x},${(H / 2 - amount * amp * Math.sin((x - 118) * 0.16 - phase * 9)).toFixed(1)}`);
  return (
    <svg className="ss-rfstrip" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet" role="img" aria-label={amount > 0 ? "RF transmitter coil beside the sample, transmitting an oscillating field" : "RF transmitter coil beside the sample, switched off"} data-testid="rf-strip">
      <rect x="8" y="12" width="40" height="30" rx="6" className="ss-box" /><text x="28" y="31" textAnchor="middle" className="ss-svgtext">RF</text>
      <line x1="48" y1="27" x2="70" y2="27" className="ss-wire" />
      {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={78 + i * 9} cy="27" rx="6" ry="15" className="ss-coil" />)}
      <rect x="104" y="6" width="9" height="42" rx="4" className="ss-tube" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--ss-rf)" strokeWidth="2.2" opacity={amount > 0 ? 1 : 0.15} />
      <text x="124" y="52" className="ss-svgtext ss-svgtext--sm">{amount > 0 ? `B₁ oscillating at ν_rf = ${(ex.nu0 / 1e6 + ex.offsetHz / 1e6).toFixed(4)} MHz (drawn ~10⁷× slower)` : "RF off"}</text>
    </svg>
  );
}

export default function RFView({ slots }) {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const rf = useStudio((s) => s.rf);
  const mode = useStudio((s) => s.mode);
  const ex = useMemo(() => deriveExcitation(b0, rf), [b0, rf]);
  const tl = useTimeline({ id: "rf", duration: RF_DURATION, events: [PULSE_DISPLAY_S] });
  const tau = tl.t;
  const traj = useMemo(() => trajectory(ex.sched, ex.timeline, 320), [ex]);
  const m = useMemo(() => stateAt(ex.sched, ex.timeline.toPhysical(tau)), [ex, tau]);
  const trail = useMemo(() => { const out = []; for (const p of traj) { if (p.tau > tau) break; out.push(p.m); } out.push(m); return out; }, [traj, tau, m]);
  const pulseOn = tau > 0 && tau < PULSE_DISPLAY_S;
  const labPhase = LAB_DISPLAY_RATE * tau;
  const phaseName = tau <= 0 ? "Equilibrium (RF off)" : pulseOn ? "RF pulse on" : tau >= RF_DURATION ? "Free precession ended" : "Free precession (RF off)";
  const P = polarization(b0);
  const [plotRef, ps] = useSize();

  const text = tau <= 0
    ? "Equilibrium: M lies along B₀ (z) and there is no transverse magnetisation, so nothing can be detected yet. Press Apply Pulse."
    : pulseOn
      ? `While the RF pulse is on, M turns about the effective field B_eff = (B₁, 0, ΔB₀) in the ${rf.frame === "rotating" ? "rotating frame" : "laboratory frame (spiralling down while it precesses)"}. ${Math.abs(ex.offsetHz) < 500 ? "The RF is at resonance, so B_eff = B₁ and M tips straight away from z." : "The RF is off resonance, so B_eff is tilted towards z and M tips less."}`
      : `The pulse is over (flip ${ex.flipDeg.toFixed(0)}° on resonance). Mxy = ${transverse(m).toFixed(2)} M₀ now precesses and decays by T₂ relaxation; this transverse magnetisation is what the receiver coil detects.`;

  return (
    <>
      <div className="ss-viz-col">
        <RfStrip amount={pulseOn ? 1 : 0} phase={tau} ex={ex} />
        <div className="ss-viz" data-testid="bloch-viz">
          <ThreeCanvas label="Three-dimensional view of the net magnetisation vector during and after the radiofrequency pulse" position={[2.7, -3.1, 1.7]}>
            <BlochScene m={m} trail={trail} frame={rf.frame} labPhase={labPhase} b1Amount={pulseOn ? 1 : 0} effDir={ex.effDir} labels />
          </ThreeCanvas>
          <div className="ss-badge-tl" data-testid="frame-label">
            <b>{rf.frame === "rotating" ? "Rotating frame" : "Laboratory frame"}</b>
            <span>{rf.frame === "rotating" ? "axes turn about z at the RF frequency; the RF field B₁ is stationary" : "fixed axes: M precesses about B₀ (display rate ~10⁸× slower than the real ~400 MHz)"}</span>
          </div>
          <div className="ss-hud" data-testid="bloch-hud">
            <span><b>{phaseName}</b></span>
            <span>M<sub>z</sub> = <b data-testid="mz-readout">{m[2].toFixed(3)}</b> M₀</span>
            <span>M<sub>xy</sub> = <b data-testid="mxy-readout">{transverse(m).toFixed(3)}</b> M₀</span>
          </div>
          <Legend className="ss-legend-bl" items={[{ color: "#fcd34d", label: "net magnetisation M", shape: "arrow" }, { color: "#fb923c", label: "RF field B₁", shape: "arrow" }, { color: "#c4b5fd", label: "effective field", shape: "arrow" }, { color: "#f472b6", label: "transverse part Mxy", shape: "bar" }]} />
        </div>
      </div>

      <Slot target={slots.controls}>
        <RfControls ex={ex} onApply={() => { tl.jump(0); a.setPlaying(true); }} />
        <PredictBox
          testId="predict-90" question="On resonance, what does a 90° pulse do to the magnetisation M?"
          options={[{ id: "a", label: "M stays at M₀ along z" }, { id: "b", label: "Mz becomes 0, M lies in the xy plane" }, { id: "c", label: "M reverses to −M₀" }]} correct="b"
          feedback={(id) => (id === "b" ? "A 90° rotation takes M from z into the transverse plane: Mz = 0 and Mxy = M₀ (population difference zero, but the nuclei now precess in phase)." : id === "a" ? "That is the state before the pulse, or the result when the RF is far off resonance." : "That is a 180° (inversion) pulse: the population difference is reversed.")}
        />
        <TeacherNote title="Teacher: what the vector means">
          <p>M is the <b>ensemble average</b> of many nuclei, not one proton. A 90° pulse does <b>not</b> put every proton in the upper state: it equalises the populations (Mz = 0) <i>and</i> creates phase coherence between α and β, which is the transverse magnetisation.</p>
          <p>Rotating frame: viewed from axes that turn at the RF frequency, B₁ is static and the motion is a plain rotation about B_eff = (B₁, 0, ΔB₀) with ΔB₀ = (ν₀ − ν_rf)·2π/γ. Flip angle θ = γB₁t_p on resonance.</p>
          <p>Model: one isochromat, Bloch equations (RK4), rectangular pulse, only the co-rotating RF component, no radiation damping. The pulse (µs) and the free precession (ms to s) use different, stated time compressions.</p>
        </TeacherNote>
      </Slot>

      <Slot target={slots.graph}>
        <Group title="Magnetisation components (display time)" testId="grp-timeplot">
          <div className="ss-plotbox" ref={plotRef} style={{ height: 190 }}>
            <LinePlot
              width={ps.width} height={ps.height} xDomain={[0, RF_DURATION]} yDomain={[-1.1, 1.1]} xLabel="animation time (s) — pulse 0-3, free precession 3-8" cursorX={tau} testId="plot-mcomp"
              ariaLabel="Mz, Mx and My against animation time" markers={[{ x: PULSE_DISPLAY_S, color: "var(--ss-rf)" }]}
              series={[
                { x: traj.map((p) => p.tau), y: traj.map((p) => p.m[2]), color: "#fcd34d", width: 2 },
                { x: traj.map((p) => p.tau), y: traj.map((p) => p.m[1]), color: "#f472b6", width: 1.6 },
                { x: traj.map((p) => p.tau), y: traj.map((p) => p.m[0]), color: "#38bdf8", width: 1.6 },
              ]}
            />
          </div>
          <Legend items={[{ color: "#fcd34d", label: "Mz (longitudinal)" }, { color: "#f472b6", label: "My" }, { color: "#38bdf8", label: "Mx" }]} />
        </Group>
        <Group title="Populations follow Mz" testId="grp-pop-rf">
          <p className="ss-hint">Population difference N<sub>α</sub> − N<sub>β</sub> is proportional to M<sub>z</sub>. Per million nuclei at {b0.toFixed(1)} T:</p>
          <Stats columns={3} items={[
            { id: "pa", label: "N_α", value: (500000 * (1 + P * m[2])).toFixed(0) },
            { id: "pb", label: "N_β", value: (500000 * (1 - P * m[2])).toFixed(0) },
            { id: "pd", label: "N_α − N_β", value: (1e6 * P * m[2]).toFixed(1), tone: "mag" },
          ]} />
          <p className="ss-hint">Equilibrium difference {sci(P, 2)} of all nuclei; only this small excess contributes to M₀.</p>
        </Group>
      </Slot>
      <Explain slots={slots}>{text}</Explain>
    </>
  );
}
