import StepFrame from "../../components/StepFrame.jsx";
import { Badge, Legend, Readouts } from "../../components/ui.jsx";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import { EXPLORER_MOLECULES, MOLECULE_INFO, getModeCatalog } from "../physics/modeCatalog.js";
import MolStage from "../components/MolStage.jsx";
import { ActivityPill, ChipGroup, fmtWn } from "../components/ui.jsx";
import { IR_STAGES, MOL_LABEL, vibOf } from "./common.js";

/** Stage 4: the explorer. Five molecules, every mode with its REAL displacement pattern and its IR activity from the dipole-derivative rule. */
export default function Stage4Explorer() {
  const a = useIrActions(); const { mol, mode: modeId } = useIr((s) => s.s4);
  const cat = getModeCatalog(mol); const mode = cat.modes.find((m) => m.id === modeId) ?? cat.modes[0];
  const info = MOLECULE_INFO[mol];
  const viz = (
    <>
      <MolStage molId={mol} vib={vibOf(mode, `s4-${mol}-${mode.id}`)} testId="mol-stage" />
      <Badge className="ss-badge--tl ir-explbadge" testId="mode-caption">
        <b>{info.name}</b> · {mode.label} · {fmtWn(mode.wn)} cm⁻¹ {mode.degeneracy > 1 ? ` · one of ${mode.degeneracy} equivalent modes` : ""}
        <span className="ir-explbadge-row"><ActivityPill active={mode.active} size="lg" testId="activity-pill" /></span>
      </Badge>
      <Legend className="ss-legend-bl" items={[{ color: "#fcd34d", label: "arrows: displacement pattern of the selected mode", shape: "arrow" }, { color: "#8da4d8", label: "dashed ring: equilibrium position", shape: "ring" }]} />
    </>
  );
  const strip = (
    <div className="ir-explstrip">
      <div className="ss-controlrow"><span className="ss-stripnote">Molecule</span><ChipGroup label="Molecule" options={EXPLORER_MOLECULES.map((id) => ({ id, label: MOL_LABEL[id] }))} value={mol} onChange={a.setS4Mol} testId="s4-mol" /></div>
      <div className="ss-controlrow"><span className="ss-stripnote">Vibration</span><ChipGroup label="Vibration mode" options={cat.modes.map((m) => ({ id: m.id, label: m.label.replace(" (degenerate pair)", ""), sub: `${fmtWn(m.wn)} cm⁻¹${m.degeneracy > 1 ? ` ×${m.degeneracy}` : ""}`, active: m.active }))} value={mode.id} onChange={(id) => a.patch("s4", { mode: id })} testId="s4-mode" small /></div>
    </div>
  );
  const teacher = (
    <>
      <p><b>Where the patterns come from.</b> Each molecule has a small valence force field (bond-stretch and angle-bend force constants). Diagonalising it in mass-weighted coordinates gives the normal modes: the atoms' displacement vectors you see. The centre of mass stays fixed and there is no net rotation; the modes are orthogonal to each other.</p>
      <p><b>IR activity</b> is computed, not typed in: the dipole moment of the displaced molecule is evaluated from partial atomic charges and dμ/dQ is found numerically. For this mode: <span data-testid="rule">{mode.rule}</span>. Symmetry decides the zero cases, so the yes/no answer does not depend on the charges used; relative intensities are only qualitative.</p>
      <p>Wavenumbers shown are literature gas-phase fundamentals (NIST / Shimanouchi / Herzberg-type values, rounded). In the liquid or solid they shift and broaden.{mol === "co2" ? " The 1388 cm⁻¹ value is the upper level of the Fermi dyad with 2ν₂ (1285 / 1388), seen in the Raman spectrum." : ""}</p>
    </>
  );
  return (
    <StepFrame step={4} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--ir">
      <p data-testid="s4-reason"><b>{mode.active ? "The dipole moment changes." : "The dipole moment does not change."}</b> {mode.reason}</p>
      {mode.simplified && <p className="ss-note" data-testid="simplified-note"><b>Simplified normal-mode representation.</b> Ethanol has 21 vibrations that mix strongly; only representative, group-dominated modes of a simplified force field are shown, with representative gas-phase wavenumbers.</p>}
      <Readouts items={[
        { id: "wn", label: "Wavenumber", value: `${fmtWn(mode.wn)} cm⁻¹`, tone: "b0", title: "Gas phase, representative" },
        { id: "sym", label: "Type / symmetry", value: mode.sym },
        { id: "n", label: "Vibrations of this molecule", value: `${cat.set.modes.length}${mol === "ethanol" ? " (7 shown)" : ""}` },
        { id: "dq", label: "dμ/dQ", value: mode.active ? mode.dmu.toFixed(2) : "0" },
      ]} />
      <p className="ss-prompt">Pick a molecule, then each vibration. Look for IR-inactive ones.</p>
    </StepFrame>
  );
}
