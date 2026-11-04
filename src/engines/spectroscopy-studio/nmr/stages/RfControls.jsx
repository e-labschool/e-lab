import { SliderRow, StepButton } from "../../../../components/simulation/SimulationDashboard.jsx";
import { MiniSwitch } from "../../../../components/simulation/SimulationDashboard.jsx";
import { B0_MAX, B0_MIN, larmorMHz } from "../physics/constants.js";
import { Group, Stats } from "../../components/ui.jsx";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { tpForFlipUs } from "../physics/excitation.js";

const RF_SPAN_MHZ = 0.06;
const kHz = (hz) => `${hz >= 0 ? "+" : "−"}${(Math.abs(hz) / 1000).toFixed(2)} kHz`;

/** Controls shared by the RF pulse and Resonance activities: B0, RF frequency / amplitude / duration, demos. */
export default function RfControls({ ex, onApply, showFrame = true, showRelax = true, hideOffset = false, hideB0 = false, challengeBlock }) {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const rf = useStudio((s) => s.rf);
  const nu0MHz = larmorMHz(b0);
  const lo = nu0MHz - RF_SPAN_MHZ; const hi = nu0MHz + RF_SPAN_MHZ;
  const setRf = (p) => a.patch("rf", p);
  const rfShown = Math.min(hi, Math.max(lo, rf.rfMHz));
  const far = rf.rfMHz < lo - 1e-9 || rf.rfMHz > hi + 1e-9;
  const demo = (deg) => setRf({ b1uT: 587.2, tpUs: Math.round(tpForFlipUs(deg, 587.2) * 100) / 100, rfMHz: Math.round(nu0MHz * 1e6) / 1e6 });
  return (
    <>
      <Group title="Radiofrequency pulse" testId="grp-rf">
        <div className="ss-btnrow">
          <button type="button" className="sd-btn sd-btn--primary" onClick={onApply} data-testid="apply-pulse">Apply Pulse</button>
          <button type="button" className="sd-btn" onClick={() => { a.resetPlayback(); }} data-testid="reset-pulse" title="Back to equilibrium magnetisation">Reset</button>
        </div>
        {!hideB0 && (
          <SliderRow
            id="ss-b0-rf" label="Magnetic field" symbol="B₀" value={b0} min={B0_MIN} max={B0_MAX} step={0.1} onChange={a.setB0} color="#38bdf8" badgeBg="#0b5d8f"
            badgeText={`${b0.toFixed(1)} T`} minText="1" maxText="14" valueText={`${b0.toFixed(1)} tesla, resonance ${nu0MHz.toFixed(1)} megahertz`} testId="b0-rf"
          />
        )}
        <SliderRow
          id="ss-rf-freq" label="RF frequency" value={rfShown} min={lo} max={hi} step={0.0005} onChange={(v) => setRf({ rfMHz: Math.round(v * 1e6) / 1e6 })}
          color="#fb923c" badgeBg="#9a4a0b" badgeText={`${rf.rfMHz.toFixed(4)} MHz`} minText={`${(-RF_SPAN_MHZ * 1000).toFixed(0)}`} maxText={`+${(RF_SPAN_MHZ * 1000).toFixed(0)} kHz`}
          valueText={`${rf.rfMHz.toFixed(4)} megahertz`} testId="rf-freq" note={far ? "The RF frequency is far from this resonance (the field changed). Retune it." : undefined}
          slideStart={<StepButton dir={-1} label="Decrease RF frequency by 0.5 kilohertz" onClick={() => setRf({ rfMHz: Math.round((rf.rfMHz - 0.0005) * 1e6) / 1e6 })} testId="rf-freq-down" />}
          slideEnd={<StepButton dir={1} label="Increase RF frequency by 0.5 kilohertz" onClick={() => setRf({ rfMHz: Math.round((rf.rfMHz + 0.0005) * 1e6) / 1e6 })} testId="rf-freq-up" />}
        />
        {!hideOffset && <p className="ss-hint" data-testid="rf-offset">Offset from resonance: <b>{Math.abs(ex.offsetHz) > 2e6 ? `${(ex.offsetHz / 1e6).toFixed(2)} MHz` : kHz(ex.offsetHz)}</b> (ν₀ = {nu0MHz.toFixed(4)} MHz)</p>}
        <SliderRow
          id="ss-b1" label="RF amplitude" symbol="B₁" value={rf.b1uT} min={50} max={1000} step={1} onChange={(v) => setRf({ b1uT: v })} color="#fb923c" badgeBg="#9a4a0b"
          badgeText={`${rf.b1uT.toFixed(0)} µT`} minText="50" maxText="1000" valueText={`${rf.b1uT.toFixed(0)} microtesla`} testId="b1"
        />
        <SliderRow
          id="ss-tp" label="Pulse duration" symbol="tp" value={rf.tpUs} min={1} max={100} step={0.5} onChange={(v) => setRf({ tpUs: v })} color="#fb923c" badgeBg="#9a4a0b"
          badgeText={`${rf.tpUs.toFixed(1)} µs`} minText="1" maxText="100 µs" valueText={`${rf.tpUs.toFixed(1)} microseconds`} testId="tp"
        />
        <div className="ss-btnrow">
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => { demo(90); a.resetPlayback(); }} data-testid="demo-90" title="On resonance, B₁ = 587 µT, pulse length for a 90° rotation">90° demo</button>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => { demo(180); a.resetPlayback(); }} data-testid="demo-180" title="On resonance, pulse length for a 180° rotation">180° demo</button>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => setRf({ rfMHz: Math.round(nu0MHz * 1e6) / 1e6 })} data-testid="match-rf" title="Set the RF frequency equal to γB₀/2π">Match RF to ν₀</button>
        </div>
        <Stats
          columns={2}
          items={[
            { id: "nu1", label: "RF strength ν₁ = γB₁/2π", value: (ex.nu1 / 1000).toFixed(1), unit: "kHz", title: "nu1 = gamma B1 / 2 pi" },
            { id: "flip", label: "Flip angle γB₁t_p (on resonance)", value: ex.flipDeg.toFixed(0), unit: "°", tone: "rf", title: "theta = gamma B1 tp, valid on resonance" },
          ]}
        />
      </Group>
      {showFrame && (
        <Group title="Frame of reference" testId="grp-frame">
          <MiniSwitch
            ariaLabel="Frame of reference" testId="frame-switch" fill value={rf.frame} onChange={(v) => setRf({ frame: v })}
            options={[{ id: "rotating", label: "Rotating frame", title: "Axes rotate about z at the RF frequency: the RF field is then stationary" }, { id: "lab", label: "Laboratory frame", title: "Fixed axes: the magnetisation precesses about B0 (rate slowed ×10⁸ for the display)" }]}
          />
        </Group>
      )}
      {showRelax && (
        <Group title="Relaxation" testId="grp-relax">
          <label className="ss-check">
            <input type="checkbox" checked={rf.shortenRelax} onChange={(e) => setRf({ shortenRelax: e.target.checked })} data-testid="relax-demo" />
            <span>Demonstrate relaxation <small>(shortens T₂ and T₁ so the decay is visible)</small></span>
          </label>
          <p className="ss-hint" data-testid="relax-values">T₂ = {ex.sched.t2 >= 0.1 ? `${ex.sched.t2.toFixed(2)} s` : `${(ex.sched.t2 * 1000).toFixed(2)} ms`}, T₁ = {ex.sched.t1 >= 0.1 ? `${ex.sched.t1.toFixed(2)} s` : `${(ex.sched.t1 * 1000).toFixed(2)} ms`}{ex.demoRelax ? " (shortened for the demonstration)" : " (illustrative)"}</p>
        </Group>
      )}
      {challengeBlock}
    </>
  );
}
