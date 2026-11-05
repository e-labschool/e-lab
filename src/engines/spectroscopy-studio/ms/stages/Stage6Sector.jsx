import { Crosshair } from "lucide-react";
import MsFrame from "./common.jsx";
import { ChipGroup, Equation, Scene } from "../components/ui.jsx";
import SectorScene from "../components/SectorScene.jsx";
import { Badge, BigSlider, Readouts } from "../../components/ui.jsx";
import { usePhase } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { SECTOR_MZ_CHOICES, V_MAX, V_MIN } from "../state/msState.js";
import { SECTOR, outcomeText, sectorTrajectory, tunedField } from "../physics/sector.js";
import { fmtCm, fmtT } from "../physics/constants.js";

/** Stage 6: separation in a magnetic sector. The selected ion follows a circular arc; B and V decide which m/z reaches the fixed detector. */
export default function Stage6Sector() {
  const a = useMsActions(); const V = useMs((s) => s.V); const { mz, B } = useMs((s) => s.s6);
  const phase = usePhase();
  const t = sectorTrajectory(mz, V, B); const Bnow = tunedField(mz, V);
  const viz = (
    <div className="ms-boxfill" data-testid="sector-view" data-outcome={t.outcome}>
      <Scene>{({ w, h }) => <SectorScene w={w} h={h} phase={phase} V={V} B={B} mz={mz} />}</Scene>
      <Badge className="ss-badge--tl" testId="sector-label">Illustrative instrument model · 180° magnetic sector (simplified)</Badge>
      <Equation testId="r-equation" className="ms-eq--over" parts={[{ t: "r = mv / zeB", on: true }]} ariaLabel="r equals m v over z e B" />
    </div>
  );
  const strip = (
    <div className="ms-s6strip">
      <div className="ss-controlrow">
        <span className="ss-stripnote">Select m/z</span>
        <ChipGroup label="Select m/z" options={SECTOR_MZ_CHOICES.map((m) => ({ id: String(m), label: String(m) }))} value={String(mz)} onChange={(id) => a.selectMz(Number(id))} testId="mz" small />
        <button type="button" className="sim-btn ss-chipbtn" onClick={a.tuneB} data-testid="tune-b" title="Set B so that the selected m/z reaches the detector"><Crosshair size={15} aria-hidden="true" /> Tune B for m/z {mz}</button>
      </div>
      <div className="ss-controlrow ms-s6sliders">
        <BigSlider id="ms-b" label="Magnetic field" symbol="B" value={B} min={SECTOR.B_MIN} max={SECTOR.B_MAX} step={0.001} onChange={a.setB} badge={fmtT(B)} color="#38bdf8" testId="b-slider" />
        <BigSlider id="ms-v6" label="Accelerating voltage" symbol="V" value={V} min={V_MIN} max={V_MAX} step={50} onChange={a.setV} badge={`${V.toLocaleString("en-US")} V`} color="#fbbf24" testId="v-slider" />
      </div>
    </div>
  );
  const teacher = (
    <>
      <p><b>Derivation.</b> The magnetic force zevB supplies the centripetal force mv²/r, so r = mv/(zeB). With zeV = ½mv² the speed is v = √(2zeV/m), hence r = (1/B)√(2mV/(ze)) and <b>m/z = eB²r²/(2V)</b> (m/z in kg per unit charge number; divide by u for the usual number). At fixed V and B, r ∝ √(m/z); at fixed r (the detector), m/z ∝ B²/V.</p>
      <p><b>Here:</b> the detector slit is {fmtCm(SECTOR.R_DET)} from the axis (path radius), V = {V} V; m/z {mz} needs B = {Bnow.toFixed(3)} T. The slit is {(2 * SECTOR.SLIT * 1000).toFixed(1)} mm wide in radius, which separates neighbouring m/z up to about 30. A narrower slit gives better resolution but fewer ions.</p>
      <p><b>Sweeping B</b> (or V) brings each m/z in turn onto the detector: that is how a scanning magnetic-sector instrument records a spectrum. The paths are circular arcs, not straight lines, and ions that miss the slit strike the wall or the plate and are lost.</p>
    </>
  );
  return (
    <MsFrame stage={6} viz={viz} strip={strip} teacher={teacher} ribbon="analyser" analyser="sector" vizClass="ss-viz--ms-sector">
      <p data-testid="s6-text">In a <b>magnetic field</b> perpendicular to their motion, ions move on <b>circular paths</b>. After the same acceleration, a <b>larger m/z gives a larger radius</b>.</p>
      <Equation testId="mz-equation" className="ms-eq--block" parts={[{ t: "m/z = eB²r² / 2V" }]} ariaLabel="m over z equals e B squared r squared over 2 V" />
      <Readouts items={[
        { id: "mz", label: "Selected m/z", value: String(mz), tone: "mag" },
        { id: "r", label: "Radius of its path", value: fmtCm(t.r), tone: "b0" },
        { id: "B", label: "B needed to reach the detector", value: fmtT(Bnow), tone: "rf" },
      ]} />
      <p className={`ms-outcome is-${t.outcome === "detector" ? "ok" : "no"}`} data-testid="sector-outcome" aria-live="polite"><b>{t.outcome === "detector" ? "Detected." : "Not detected."}</b> {outcomeText(t)}</p>
      <p className="ss-note">Changing B or V changes which ions reach the fixed detector.</p>
    </MsFrame>
  );
}
