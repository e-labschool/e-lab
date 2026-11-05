import StepFrame from "../../components/StepFrame.jsx";
import LinePlot from "../../components/LinePlot.jsx";
import { Badge, BigSlider, Readouts } from "../../components/ui.jsx";
import { useSize } from "../../components/useSize.js";
import { usePhase } from "../../components/useAnim.js";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import { NU_MAX, NU_MIN } from "../state/irState.js";
import { getModeCatalog } from "../physics/modeCatalog.js";
import { TEACHING_HWHM, absorption, absorptionState, frequencyMatch, lorentz } from "../physics/absorption.js";
import { energyJ } from "../physics/constants.js";
import MolStage from "../components/MolStage.jsx";
import EnergyLadder from "../components/EnergyLadder.jsx";
import IrWave from "../components/IrWave.jsx";
import { ActivityPill, ChipGroup, fmtWn, sci } from "../components/ui.jsx";
import { IR_STAGES, molOptions, vibOf } from "./common.js";

const STATE = {
  absorbed: { tone: "ok", head: "IR absorbed", text: "The frequency matches the vibration and the vibration changes the dipole moment." },
  "match-inactive": { tone: "warn", head: "Frequency matches, but no dipole change → not absorbed", text: "A perfect match is not enough: this vibration does not change the dipole moment, so the radiation cannot drive it." },
  near: { tone: "warn", head: "Close: weak absorption", text: "Only part of the radiation is absorbed this far from the exact frequency." },
  "near-inactive": { tone: "off", head: "Not absorbed", text: "Close in frequency, but this vibration does not change the dipole moment." },
  off: { tone: "off", head: "Little or no absorption", text: "The photon energy does not match the spacing of the vibrational levels (hν ≠ ΔE)." },
};
const NU_TICKS = [{ at: 0, label: "4000" }, { at: 0.25, label: "3100" }, { at: 0.5, label: "2200" }, { at: 0.75, label: "1300" }, { at: 1, label: "400" }];

/** Stage 3: an IR wave meets a vibrating molecule; ONE slider (the IR wavenumber) decides whether it is absorbed. */
export default function Stage3Absorb() {
  const a = useIrActions(); const { mol, mode: modeId, nu } = useIr((s) => s.s3);
  const cat = getModeCatalog(mol); const mode = cat.modes.find((m) => m.id === modeId) ?? cat.modes[0];
  const phase = usePhase(); const [waveRef, wsize] = useSize();
  const abs = absorption(nu, mode.wn, mode.active); const match = frequencyMatch(nu, mode.wn); const st = absorptionState(nu, mode.wn, mode.active);
  const info = STATE[st];
  const curve = (() => { const xs = []; const ys = []; for (let v = NU_MIN; v <= NU_MAX; v += 10) { xs.push(v); ys.push(mode.active ? lorentz(v, mode.wn, TEACHING_HWHM) : 0); } return { x: xs, y: ys }; })();
  const freqCurve = (() => { const xs = []; const ys = []; for (let v = NU_MIN; v <= NU_MAX; v += 10) { xs.push(v); ys.push(lorentz(v, mode.wn, TEACHING_HWHM)); } return { x: xs, y: ys }; })();
  const [graphRef, gsize] = useSize();

  const viz = (
    <div className="ir-absview" data-testid="absorb-view" data-state={st} data-absorption={abs.toFixed(3)} data-match={match.toFixed(3)}>
      <div className="ir-wavepane" ref={waveRef}>
        <IrWave nu={nu} absorbed={abs} phase={phase} width={wsize.width} height={wsize.height} state={st} />
        <div className="ir-wavemol"><MolStage molId={mol} vib={vibOf(mode, `s3-${mol}-${mode.id}`)} gain={1 + 1.1 * abs} glow={abs} arrows={false} labels testId="mol-stage" /></div>
        <Badge className="ss-badge--tl ir-statusbadge" tone={info.tone === "ok" ? undefined : info.tone === "warn" ? "warn" : undefined} testId="absorb-status"><b data-testid="absorb-head">{info.head}</b></Badge>
      </div>
      <div className="ir-levelpane" data-testid="levels-pane"><EnergyLadder wn={mode.wn} absorb={abs} phase={phase} mismatch={st === "off"} /></div>
      <div className="ir-graphpane" ref={graphRef}>
        <div className="ir-graphhead"><b>Absorption response of this vibration</b><span> (peak at its own wavenumber; teaching width)</span></div>
        <div className="ir-graphplot">
          {gsize.width > 40 && (
            <LinePlot width={gsize.width} height={Math.max(60, gsize.height - 30)} series={[{ x: (mode.active ? curve : freqCurve).x, y: (mode.active ? curve : freqCurve).y, color: mode.active ? "#2dd4bf" : "#8197c8", dash: mode.active ? undefined : "5 4", width: 2.2, fillTo: mode.active ? 0 : undefined }]}
              xDomain={[NU_MIN, NU_MAX]} yDomain={[0, 1.05]} reverseX xLabel="IR wavenumber (cm⁻¹)" yLabel="Absorption" cursorX={nu} xTicks={[4000, 3500, 3000, 2500, 2000, 1500, 1000, 500]} yTicks={[0, 0.5, 1]} margin={{ l: 40, r: 10, t: 6, b: 32 }}
              markers={[{ x: mode.wn, color: "#fbbf24" }]} ariaLabel="Absorption response against IR wavenumber" testId="absorb-graph" />
          )}
          {!mode.active && <p className="ir-graphnote">Dashed: where the frequency would match. Because the dipole does not change, nothing is absorbed.</p>}
        </div>
      </div>
    </div>
  );
  const strip = (
    <div className="ss-controlrow ir-s3controls">
      <BigSlider id="ir-nu" label="IR wavenumber" symbol="ν̃" value={NU_MAX + NU_MIN - nu} min={NU_MIN} max={NU_MAX} step={1} onChange={(v) => a.patch("s3", { nu: NU_MAX + NU_MIN - v })} badge={`${fmtWn(nu)} cm⁻¹`} valueText={`${nu} reciprocal centimetres`} color="#fb923c" testId="nu-slider" ticks={NU_TICKS} />
      <div className="ir-s3pick">
        <ChipGroup label="Molecule" options={molOptions(["hcl", "h2o", "co2", "n2"])} value={mol} onChange={a.setS3Mol} testId="s3-mol" small />
        <ChipGroup label="Vibration" options={cat.modes.map((m) => ({ id: m.id, label: m.label.replace(" (degenerate pair)", ""), sub: `${fmtWn(m.wn)}` }))} value={mode.id} onChange={(id) => a.patch("s3", { mode: id })} testId="s3-mode" small />
      </div>
    </div>
  );
  const teacher = (
    <>
      <p><b>Two conditions.</b> (1) Resonance: hν = ΔE = E(v=1) − E(v=0), so ν̃ must equal the vibration's wavenumber. (2) Selection rule: the dipole moment must change during the vibration, (dμ/dQ) ≠ 0, because the oscillating electric field of the radiation can only push on a changing dipole.</p>
      <p><b>The response curve</b> is a Lorentzian, 1/(1 + ((ν̃ − ν̃₀)/Γ)²) with Γ = {TEACHING_HWHM} cm⁻¹, chosen so that the slider shows a visible width. Isolated gas-phase lines are far narrower; liquids and solids are broader. Off resonance the response is small but, in this simple shape, not exactly zero.</p>
      <p><b>CO₂ symmetric stretch</b> (1388 cm⁻¹) is the classic case: the frequency can match perfectly, yet the two C=O bond dipoles change equally and cancel, so dμ/dQ = 0 and there is no IR absorption (it appears in the Raman spectrum instead). N₂ is the simplest case: a homonuclear diatomic has no dipole at all.</p>
      <p>The molecule swings with more amplitude (and glows) when it is absorbing; the wave leaving it is weaker. Real molecules absorb photons one at a time, only about 1 molecule in a million starts in v = 1 at room temperature.</p>
    </>
  );
  return (
    <StepFrame step={3} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--irabs">
      <p data-testid="s3-conditions">IR radiation is absorbed only if <b>1.</b> its frequency matches an allowed vibrational transition and <b>2.</b> the vibration changes the <b>dipole moment</b>.</p>
      <p className="ir-eq" data-testid="photon-eq">ΔE = hν = hcν̃</p>
      <p data-testid="absorb-text" aria-live="polite"><b>{info.head}.</b> {info.text}</p>
      <Readouts items={[
        { id: "mode", label: `${mode.label}`, value: `${fmtWn(mode.wn)} cm⁻¹`, tone: "b0" },
        { id: "photon", label: "Photon energy hν", value: `${sci(energyJ(nu), 2)} J`, tone: "rf" },
        { id: "gap", label: "Level spacing ΔE", value: `${sci(energyJ(mode.wn), 2)} J`, tone: "mag" },
        { id: "act", label: "Dipole changes?", value: <ActivityPill active={mode.active} size="sm" testId="s3-activity" /> },
      ]} />
      {!mode.active && <p className="ss-note" data-testid="s3-reason">{mode.reason}</p>}
      <p className="ss-prompt">Slide to the vibration's wavenumber. Then try CO₂ → symmetric stretch.</p>
    </StepFrame>
  );
}
