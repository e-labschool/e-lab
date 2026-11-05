import MsFrame from "./common.jsx";
import { Equation, Scene } from "../components/ui.jsx";
import AccelerationScene, { ACCEL_IONS } from "../components/AccelerationScene.jsx";
import { BigSlider, Readouts } from "../../components/ui.jsx";
import { usePhase } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { V_MAX, V_MIN } from "../state/msState.js";
import { kineticEnergyJ, speedFromMz } from "../physics/kinematics.js";
import { E_CHARGE, fmtKms } from "../physics/constants.js";

/** Stage 5: acceleration of positive ions through a potential difference V: Ek = zeV for every ion; v depends on the mass. */
export default function Stage5Accelerate() {
  const a = useMsActions(); const V = useMs((s) => s.V);
  const phase = usePhase();
  const ek = kineticEnergyJ(1, V);
  const viz = (
    <div className="ms-boxfill" data-testid="accel-view" data-v={V}>
      <Scene>{({ w, h }) => <AccelerationScene w={w} h={h} phase={phase} V={V} />}</Scene>
      <Equation testId="ek-equation" className="ms-eq--over" parts={[{ t: "Eₖ = zeV", on: true }]} ariaLabel="Kinetic energy equals z e V" />
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <BigSlider id="ms-v" label="Accelerating voltage" symbol="V" value={V} min={V_MIN} max={V_MAX} step={50} onChange={a.setV} badge={`${V.toLocaleString("en-US")} V`} color="#fbbf24" testId="v-slider" ticks={[{ at: 0, label: "500 V" }, { at: 0.5, label: "2750 V" }, { at: 1, label: "5000 V" }]} />
    </div>
  );
  const teacher = (
    <>
      <p><b>Energy.</b> A particle of charge ze moving through a potential difference V gains the energy ze·V: here E<sub>k</sub> = zeV = {(ek / E_CHARGE).toLocaleString("en-US")} eV = {ek.toExponential(3)} J for z = 1, whatever the mass. This assumes the ions start with negligible kinetic energy; real ions start with a small spread of energies.</p>
      <p><b>Speed.</b> From ½mv² = zeV, v = √(2zeV/m): for the same V and z the speed is proportional to 1/√m, so the m/z 16 ion is √(58/16) ≈ 1.9 times faster than the m/z 58 ion.</p>
      <p><b>Doubling V</b> doubles E<sub>k</sub> and multiplies every speed by √2.</p>
    </>
  );
  return (
    <MsFrame stage={5} viz={viz} strip={strip} teacher={teacher} ribbon="accelerator" vizClass="ss-viz--ms-inst">
      <p data-testid="s5-text">Positive ions are pushed through a <b>potential difference V</b> between two electrodes. They gain <b>kinetic energy</b>:</p>
      <Equation testId="ek-equation-panel" className="ms-eq--block" parts={[{ t: "Eₖ = zeV" }]} ariaLabel="Kinetic energy equals z e V" />
      <p className="ss-note">z = charge number of the ion · e = elementary charge · V = accelerating voltage</p>
      <p data-testid="s5-key"><b>Different masses, same charge: about the same kinetic energy, not the same speed.</b> Lighter ions go faster.</p>
      <Readouts items={[
        { id: "ek", label: "Kinetic energy (any z = 1 ion)", value: `${(ek / E_CHARGE).toLocaleString("en-US")} eV`, tone: "mag" },
        ...ACCEL_IONS.map((i) => ({ id: `v${i.mz}`, label: `Speed, m/z ${i.mz}`, value: fmtKms(speedFromMz(i.mz, V)), tone: "b0" })),
      ]} />
    </MsFrame>
  );
}
