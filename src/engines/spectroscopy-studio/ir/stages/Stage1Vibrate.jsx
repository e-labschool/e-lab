import StepFrame from "../../components/StepFrame.jsx";
import { Badge, Legend, Readouts } from "../../components/ui.jsx";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import { getModeCatalog } from "../physics/modeCatalog.js";
import { frequencyHz, energyJ } from "../physics/constants.js";
import MolStage from "../components/MolStage.jsx";
import EnergyLadder from "../components/EnergyLadder.jsx";
import { ChipGroup, fmtWn, sci } from "../components/ui.jsx";
import { IR_STAGES, molOptions, vibOf } from "./common.js";

const MAIN = { hcl: "stretch", h2o: "sym", co2: "sym" };
const NAME = { hcl: "hydrogen chloride", h2o: "water", co2: "carbon dioxide" };
const LINE = {
  hcl: "In HCl the two atoms move towards and away from each other: the bond stretches and compresses. The light H atom moves far more than the heavy Cl atom.",
  h2o: "In H₂O both O–H bonds stretch and compress together, in step with each other.",
  co2: "In CO₂ both C=O bonds stretch and compress together while the carbon atom stays still.",
};

/** Stage 1: how molecules vibrate (HCl first; H2O and CO2 on request). */
export default function Stage1Vibrate() {
  const a = useIrActions(); const mol = useIr((s) => s.s1.mol);
  const mode = getModeCatalog(mol).modes.find((m) => m.id === MAIN[mol]);
  const nuHz = frequencyHz(mode.wn);
  const viz = (
    <>
      <MolStage molId={mol} vib={vibOf(mode, `s1-${mol}`)} testId="mol-stage" />
      <Badge className="ss-badge--tl" testId="vib-caption"><b>{NAME[mol][0].toUpperCase() + NAME[mol].slice(1)}</b> · {mode.label} · about {fmtWn(mode.wn)} cm⁻¹</Badge>
      <div className="ir-inset" data-testid="levels-inset"><EnergyLadder wn={mode.wn} absorb={0} compact label="Quantised vibrational energy levels v = 0, 1, 2" showPhoton={false} /></div>
      <Legend className="ss-legend-bl" items={[{ color: "#fcd34d", label: "arrow: each atom swings along it", shape: "arrow" }, { color: "#8da4d8", label: "dashed ring: equilibrium position", shape: "ring" }]} />
    </>
  );
  const strip = (
    <div className="ss-controlrow">
      <span className="ss-stripnote">Molecule</span>
      <ChipGroup label="Molecule" options={molOptions(["hcl", "h2o", "co2"])} value={mol} onChange={(id) => a.patch("s1", { mol: id })} testId="s1-mol" />
    </div>
  );
  const teacher = (
    <>
      <p><b>Harmonic picture.</b> A bond behaves like a spring of force constant k joining masses with reduced mass μ: the vibration frequency is ν = (1/2π)√(k/μ), or in wavenumbers ν̃ = (1/2πc)√(k/μ). Stiffer bonds and lighter atoms vibrate faster.</p>
      <p><b>Quantised.</b> The allowed energies are E<sub>v</sub> = (v + ½)hν with v = 0, 1, 2 …, so neighbouring levels are ΔE = hν apart (equal spacing in the harmonic model; real bonds are slightly anharmonic and the levels get closer together as v grows). At room temperature almost every molecule is in v = 0.</p>
      <p><b>The motion shown</b> is the true normal mode: atoms move with the displacement pattern from a normal-mode calculation (centre of mass fixed, no rotation). {mol === "hcl" ? "Because m(Cl)/m(H) ≈ 35, the H atom swings about 35 times farther than Cl." : "The arrows show the pattern, not the size of the real motion, which is only a few per cent of a bond length."}</p>
    </>
  );
  return (
    <StepFrame step={1} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--ir">
      <p data-testid="s1-text">Atoms in a molecule are never still. They swing back and forth about their <b>equilibrium positions</b>. {LINE[mol]}</p>
      <p>This motion is a <b>molecular vibration</b>. It repeats about <b>{sci(nuHz, 1)}</b> times every second, and the energy it carries is <b>quantised</b>: only the levels v = 0, 1, 2 … exist (inset).</p>
      <Readouts items={[
        { id: "wn", label: "Vibration (wavenumber)", value: `${fmtWn(mode.wn)} cm⁻¹`, tone: "b0", title: "Gas phase, representative" },
        { id: "freq", label: "Frequency", value: `${sci(nuHz, 2)} Hz`, tone: "mag" },
        { id: "de", label: "Level spacing ΔE = hν", value: `${sci(energyJ(mode.wn), 2)} J`, tone: "rf" },
        { id: "gap", label: "Slowed down for display", value: "≈ 10¹⁴ ×", title: "Same factor for every mode: frequencies keep their true ratios" },
      ]} />
      <p className="ss-prompt">Try H₂O and CO₂: a molecule can vibrate in more than one way.</p>
    </StepFrame>
  );
}
