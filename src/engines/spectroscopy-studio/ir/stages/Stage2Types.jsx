import StepFrame from "../../components/StepFrame.jsx";
import { Badge, Legend, Readouts } from "../../components/ui.jsx";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import MolStage from "../components/MolStage.jsx";
import { ChipGroup, fmtWn } from "../components/ui.jsx";
import { IR_STAGES, modeOf, molOptions, vibOf } from "./common.js";

const TYPES = [
  { id: "sym", label: "Symmetric stretch", kind: "stretch" }, { id: "asym", label: "Asymmetric stretch", kind: "stretch" }, { id: "bend", label: "Bending", kind: "bend" },
];
const TEXT = {
  sym: "Both bonds lengthen together and shorten together, keeping the molecule's symmetry.",
  asym: "One bond lengthens while the other shortens, then they swap.",
  bend: "The bond lengths hardly change; the angle between the bonds opens and closes.",
};

/** Stage 2: symmetric stretch, asymmetric stretch, bending (H2O and CO2). */
export default function Stage2Types() {
  const a = useIrActions(); const { mol, type } = useIr((s) => s.s2);
  const mode = modeOf(mol, type);
  const viz = (
    <>
      <MolStage molId={mol} vib={vibOf(mode, `s2-${mol}-${type}`)} testId="mol-stage" />
      <Badge className="ss-badge--tl" testId="vib-caption"><b>{mode.label}</b> · about {fmtWn(mode.wn)} cm⁻¹{mode.degeneracy > 1 ? " · one of two equivalent bends" : ""}</Badge>
      <Legend className="ss-legend-bl" items={[{ color: "#fcd34d", label: "arrows: direction of each atom's displacement", shape: "arrow" }, { color: "#8da4d8", label: "dashed ring: equilibrium position", shape: "ring" }]} />
    </>
  );
  const strip = (
    <div className="ss-controlrow">
      <ChipGroup label="Molecule" options={molOptions(["h2o", "co2"])} value={mol} onChange={(id) => a.patch("s2", { mol: id })} testId="s2-mol" />
      <ChipGroup label="Type of vibration" options={TYPES.map((t) => ({ id: t.id, label: t.label, sub: `${fmtWn(modeOf(mol, t.id).wn)} cm⁻¹` }))} value={type} onChange={(id) => a.patch("s2", { type: id })} testId="s2-type" />
    </div>
  );
  const teacher = (
    <>
      <p><b>Normal modes.</b> A molecule of N atoms has 3N − 6 vibrations (3N − 5 if linear): 3 for H₂O and 4 for CO₂ (its bend is a degenerate pair, two equal bends at right angles; only one is drawn). Each is a normal mode: all atoms move at the same frequency and pass through equilibrium together.</p>
      <p><b>Why different frequencies?</b> Bending a bond angle costs less energy than stretching a bond, so bends have the lowest wavenumbers. In CO₂ the symmetric stretch (1388 cm⁻¹) is lower than the asymmetric stretch (2349 cm⁻¹); in H₂O the two stretches are close (3657 and 3756 cm⁻¹).</p>
      <p>The patterns come from a harmonic normal-mode calculation: for CO₂ asymmetric stretch the carbon moves opposite to the two oxygens so that the centre of mass does not move.</p>
    </>
  );
  return (
    <StepFrame step={2} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--ir">
      <p data-testid="s2-text"><b>{mode.label}.</b> {TEXT[type]}</p>
      <p>Stretching changes bond <b>lengths</b>; bending changes bond <b>angles</b>. Each kind of motion has its own characteristic frequency.</p>
      <Readouts items={[{ id: "wn", label: `${mode.label} (wavenumber)`, value: `${fmtWn(mode.wn)} cm⁻¹`, tone: "b0", title: "Gas phase, representative" }, { id: "sym", label: "Symmetry", value: mode.sym }]} />
      <p className="ss-prompt">Compare the three wavenumbers on the buttons: bending is the lowest.</p>
    </StepFrame>
  );
}
