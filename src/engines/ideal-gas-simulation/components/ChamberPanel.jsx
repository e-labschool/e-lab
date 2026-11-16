import { useEffect, useState } from "react";
import { Pause, Play, TriangleAlert } from "lucide-react";
import { DashPanel } from "../../../components/simulation/SimulationDashboard.jsx";
import GasCanvas from "./GasCanvas.jsx";
import { DEVIATION_CLASSES, GAS, IB_UNITS, Z_BOUNDS, fmtVolume, unitLabelV } from "../model.js";

const THRESHOLD_HELP =
  `Deviation from ideal behaviour is judged from |Z - 1|, where Z = PV/(nRT): ` +
  `near ideal below ${Z_BOUNDS.nearIdeal}, noticeable from ${Z_BOUNDS.nearIdeal} to ${Z_BOUNDS.noticeable}, strong from ${Z_BOUNDS.noticeable} up. ` +
  `Z < 1: attractions dominate. Z > 1: molecular size dominates.`;

const LIMIT_SHORT = {
  condensation: "Model limit: CO₂ would condense",
  "two-phase": "Model limit: CO₂ would condense",
  "excluded-volume": "Model limit: molecules fill the volume",
  "unstable-region": "Model limit: unstable state",
  "out-of-range": "Outside the piston range",
};

// Compact deviation indicator over the chamber: class label + numeric Z. In Ideal mode it reports Z = 1
// and, on a second line, what the REAL gas does at the same conditions (the comparison the student
// makes by switching). A model limit is shown as a visible warning, never as a number.
export function DeviationBadge({ state }) {
  const real = state.mode === "real";
  const ref = state.ref;
  if (real && state.limit) {
    return (
      <div className="ig-dev ig-dev--limit" data-testid="deviation" data-class="limit" title={state.limit.text}>
        <span className="ig-dev-main"><TriangleAlert size={13} aria-hidden="true" /> <b data-testid="deviation-label">{LIMIT_SHORT[state.limit.reason] ?? "Model limit"}</b></span>
      </div>
    );
  }
  const cls = real ? state.cls : null;
  return (
    <div className={"ig-dev" + (real ? ` ig-dev--${cls.id}` : " ig-dev--ideal")} data-testid="deviation" data-class={real ? cls.id : "ideal"} title={THRESHOLD_HELP}>
      <span className="ig-dev-main">
        <b data-testid="deviation-label">{real ? DEVIATION_CLASSES[cls.index].label : "Ideal gas"}</b>
        <span className="ig-dev-z" data-testid="deviation-z">Z = {state.Z.toFixed(3)}</span>
      </span>
      {!real && (
        <span className="ig-dev-sub" data-testid="deviation-ref">
          {ref.status === "ok"
            ? <>Real {GAS.formula.replace("2", "₂")} here: Z = {ref.Z.toFixed(3)} ({DEVIATION_CLASSES[ref.cls.index].label.toLowerCase()})</>
            : <>Real gas: model limit here</>}
        </span>
      )}
    </div>
  );
}

// The animated chamber (illustrative particle picture) + deviation indicator + play/pause.
/** "Pressure from collisions": the momentum the particles hand to the piston per second, compared with the kinetic value of the
 *  same particles. Polled (not per-frame) so it is readable and cheap. In the picture the pressure really IS this wall impact rate;
 *  the number on the pressure slider comes from PV = nRT (or van der Waals), which this gauge should agree with in the ideal case. */
export function WallGauge({ sim, real }) {
  const [w, setW] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setW(sim.getWallStats()), 450);
    return () => clearInterval(id);
  }, [sim]);
  if (!w || w.ratio == null) return null;
  const pct = Math.round(w.ratio * 100);
  return (
    <div className="ig-wall" data-testid="wall-gauge" role="status"
      title={"Each time a particle bounces off the piston it hands it momentum. Pressure = total momentum handed over per second \u00f7 piston area (here per unit length, because the picture is 2D). "
        + "The percentage compares that with the value from the particles' own kinetic energy (ideal gas of points = 100 %). With about 50 particles it flickers by roughly 10 %; "
        + (real ? "in the real-gas picture attractions and finite size shift it." : "finite particle size adds a few percent.")}>
      <span className="ig-wall-title">Pressure from collisions</span>
      <span className="ig-wall-row"><b data-testid="wall-hits">{Math.round(w.hitsPerSec)}</b> piston hits per s</span>
      <span className="ig-wall-row"><b data-testid="wall-ratio">{pct} %</b> of the kinetic value{!w.steady ? " (piston moving)" : ""}</span>
    </div>
  );
}

export default function ChamberPanel({ sim, state, reducedMotion, playing, onTogglePlay, units = IB_UNITS, showWall = true }) {
  const real = state.mode === "real";
  const label = `Gas cylinder with ${state.N} drawn particles, ${Number(state.T.toFixed(2))} kelvin, ${fmtVolume(state.V, units)} ${unitLabelV(units) === "L" ? "litres" : "cubic decimetres"}, ${real ? "real" : "ideal"} gas. The piston scale is labelled in ${unitLabelV(units)}.`;
  return (
    <DashPanel ariaLabel="Gas chamber" grow noBody className="!p-1.5">
      <div className="sd-chamber" data-testid="chamber">
        <GasCanvas sim={sim} reducedMotion={reducedMotion} label={label} />
        <DeviationBadge state={state} />
        {showWall && <WallGauge sim={sim} real={real} />}
        <button
          type="button" className="sd-chamber-btn" onClick={onTogglePlay} data-testid="play-pause"
          aria-label={playing ? "Pause simulation" : "Play simulation"} title={playing ? "Pause simulation" : "Play simulation"}
        >
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
        <p className="sd-chamber-foot" data-testid="chamber-caption">
          Illustrative particle picture, not molecular dynamics. {real ? "Finite-size molecules with a short-range attraction." : "Point-like particles, elastic collisions, no forces."} 1 particle = 0.01 mol.
        </p>
      </div>
    </DashPanel>
  );
}
