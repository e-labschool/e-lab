import { Play } from "lucide-react";
import MsFrame from "./common.jsx";
import { Equation, Scene } from "../components/ui.jsx";
import TofScene from "../components/TofScene.jsx";
import { BigSlider, Readouts } from "../../components/ui.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { TOF, TOF_ION_COLORS, arrivalOrder, displayClock, raceTable } from "../physics/tof.js";
import { fmtUs } from "../physics/constants.js";
import { SECTOR } from "../physics/sector.js";

const FIXED = [16, 31, 43];
/** Stage 7: time-of-flight race, with a contrast to the magnetic sector. */
export default function Stage7Tof() {
  const a = useMsActions(); const V = useMs((s) => s.V); const { massX, started } = useMs((s) => s.s7);
  const progress = useTransition({ id: "ms-tof", target: started ? 1 : 0, seconds: 7, from: 0 });
  const ions = [...FIXED.map((mz) => ({ id: `m${mz}`, mz })), { id: "x", mz: massX }];
  const rows = raceTable(ions, V); const tau = displayClock(progress, rows);
  const order = arrivalOrder(rows).map((r) => ({ ...r, done: tau >= r.t - 1e-12 }));
  const nDone = order.filter((r) => r.done).length;
  const idx = (r) => ions.findIndex((i) => i.id === r.id);
  const viz = (
    <div className="ms-boxfill" data-testid="tof-view" data-started={started ? "1" : "0"} data-done={nDone}>
      <Scene>{({ w, h }) => <TofScene w={w} h={h} progress={progress} V={V} ions={ions} />}</Scene>
      <Equation testId="t-equation" className="ms-eq--over" parts={[{ t: "t = L √(m / 2zeV)", on: true }]} ariaLabel="t equals L times the square root of m over 2 z e V" />
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <button type="button" className="sim-btn sim-btn--primary ss-cta" onClick={() => a.patch("s7", { started: true })} data-testid="start-flight"><Play size={16} aria-hidden="true" /> {started ? "Flight started" : "Start Flight"}</button>
      <BigSlider id="ms-massx" label="Mass of ion X" symbol="m/z" value={massX} min={TOF.MASS_MIN} max={TOF.MASS_MAX} step={1} onChange={(v) => a.patch("s7", { massX: v })} badge={`m/z ${massX}`} color={TOF_ION_COLORS[3]} testId="massx-slider" />
    </div>
  );
  const teacher = (
    <>
      <p><b>Derivation.</b> ze V = ½mv² gives v = √(2zeV/m); crossing the field-free length L takes t = L/v = L√(m/(2zeV)). So t ∝ √(m/z): quadrupling the mass doubles the flight time. All ions here have z = 1 and V = {V} V, L = {TOF.L} m.</p>
      <p><b>Display.</b> The animation shows constant-speed motion in the tube, with a constant stretch of time so that arrival times keep their true ratios. The tube is not drawn to scale. Real instruments use pulsed acceleration, and reflectrons to correct for the spread of starting energies.</p>
    </>
  );
  return (
    <MsFrame stage={7} viz={viz} strip={strip} teacher={teacher} ribbon="analyser" analyser="tof" vizClass="ss-viz--ms-tof">
      <p data-testid="s7-text">Ions are accelerated together into a <b>field-free tube</b>. Same charge and energy, so <b>lighter ions are faster</b> and arrive sooner.</p>
      <Equation testId="t-equation-panel" className="ms-eq--block" parts={[{ t: "t = L √(m / 2zeV)" }]} ariaLabel="t equals L times the square root of m over 2 z e V" />
      <ol className="ms-arrivals" data-testid="arrivals" aria-label="Arrival order">
        {order.map((r) => (
          <li key={r.id} className={r.done ? "is-done" : ""} data-testid={`arrival-${r.id}`} data-rank={r.rank} style={{ borderColor: TOF_ION_COLORS[idx(r)] }}>
            <b>m/z {r.mz}{r.id === "x" ? " (X)" : ""}</b><span>{r.done ? `arrives at ${fmtUs(r.t)}` : `flight time ${fmtUs(r.t)}`}</span>
          </li>
        ))}
      </ol>
      <Readouts items={[{ id: "tx", label: "Flight time of X", value: fmtUs(rows[3].t), tone: "mag" }]} />
      <p className="ms-contrast" data-testid="tof-contrast"><b>TOF vs magnetic sector.</b> TOF separates by <i>time</i> along a straight path with no magnetic field (t ∝ √(m/z)). A magnetic sector separates by <i>path radius</i> in a field: r ∝ √(m/z)/B, and only the ion with the right radius reaches the fixed detector (detector at r = {(SECTOR.R_DET * 100).toFixed(0)} cm).</p>
    </MsFrame>
  );
}
