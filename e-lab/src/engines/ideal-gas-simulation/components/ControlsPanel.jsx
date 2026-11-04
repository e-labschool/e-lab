import { LIMITS } from "../model.js";
import { DashPanel, MiniSwitch, ReadOnlyRow, SliderRow } from "../../../components/simulation/SimulationDashboard.jsx";

// Variable colours (shared with the live-value strip).
const C = {
  N: { color: "#2F7BF5", bg: "#E1EDFD" },
  T: { color: "#F5A50B", bg: "#FDEFD0" },
  V: { color: "#34C256", bg: "#DFF5E4" },
  P: { color: "#8B5CF6", bg: "#EBE4FC" },
};

const CONTROL_OPTIONS = [
  { id: "pressure", label: "Change Pressure", title: "You set the pressure; the piston moves and the volume is calculated" },
  { id: "volume", label: "Change Volume", title: "You set the volume with the piston; the pressure is calculated" },
];

// P and V span decades, so their sliders are logarithmic: slider position 0..1000.
const POS_MAX = 1000;
const logScale = ({ min, max }) => ({
  toPos: (x) => Math.round((Math.log(Math.min(max, Math.max(min, x)) / min) / Math.log(max / min)) * POS_MAX),
  fromPos: (p) => min * Math.pow(max / min, p / POS_MAX),
});
const P_SCALE = logScale(LIMITS.P);
const V_SCALE = logScale(LIMITS.V);

const fmtP = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const fmtV = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x.toFixed(3));

// Compact controls column: the Change Pressure | Change Volume selector (only ONE of the two is
// adjustable; the other is calculated), then T, amount, and the pressure / volume rows.
export default function ControlsPanel({ controls, state, onChange }) {
  const pressureMode = controls.control === "pressure";
  const targetP = state.pTarget ?? state.pressure;
  const pValue = pressureMode ? controls.P : Math.min(LIMITS.P.max, Math.max(LIMITS.P.min, state.pressure));
  const note = state.note;

  const volumeRow = pressureMode ? (
    <ReadOnlyRow
      key="V" label="Volume" symbol="V" hint="calculated" color={C.V.color} badgeBg={C.V.bg} testId="V" rowTestId="block-V"
      badgeText={`${fmtV(state.V)} L`} tooltip="Volume is calculated: the piston moves until the gas pressure matches the target."
    />
  ) : (
    <SliderRow
      key="V" id="ig-volume" label="Volume" symbol="V" tone="active" color={C.V.color} badgeBg={C.V.bg} testId="V" rowTestId="block-V"
      value={V_SCALE.toPos(controls.V)} min={0} max={POS_MAX} step={1} onChange={(pos) => onChange({ V: V_SCALE.fromPos(pos) })}
      badgeText={`${fmtV(controls.V)} L`} minText={`${LIMITS.V.min} L`} maxText={`${LIMITS.V.max} L`}
      valueText={`${fmtV(controls.V)} litres`}
    />
  );
  const pressureRow = pressureMode ? (
    <SliderRow
      key="P" id="ig-pressure" label="Pressure" symbol="P" tone="active" color={C.P.color} badgeBg={C.P.bg} testId="P" rowTestId="block-P"
      value={P_SCALE.toPos(pValue)} min={0} max={POS_MAX} step={1} onChange={(pos) => onChange({ P: P_SCALE.fromPos(pos) })}
      badgeText={`${fmtP(targetP)} atm`} minText={`${LIMITS.P.min} atm`} maxText={`${LIMITS.P.max} atm`}
      valueText={`${fmtP(targetP)} atmospheres, target`}
    />
  ) : (
    <ReadOnlyRow
      key="P" label="Pressure" symbol="P" hint="calculated" color={C.P.color} badgeBg={C.P.bg} testId="P" rowTestId="block-P"
      badgeText={`${fmtP(state.pressure)} atm`} tooltip="Pressure is calculated from n, T and V by the selected gas model."
    />
  );

  return (
    <DashPanel title="Controls" ariaLabel="Controls" grow testId="control-panel" bodyClassName="sd-rows">
      <div className="sd-selector" data-testid="control-mode">
        <MiniSwitch
          large fill options={CONTROL_OPTIONS} value={controls.control} ariaLabel="Which variable do you change?"
          onChange={(control) => onChange({ control })} testId="control-switch"
        />
      </div>
      <SliderRow
        id="ig-temperature" label="Temperature" symbol="T" tone="active" color={C.T.color} badgeBg={C.T.bg} testId="T" rowTestId="block-T"
        value={controls.T} {...LIMITS.T} onChange={(T) => onChange({ T })}
        badgeText={`${controls.T} K`} minText={`${LIMITS.T.min} K`} maxText={`${LIMITS.T.max} K`} valueText={`${controls.T} kelvin`}
      />
      <SliderRow
        id="ig-particles" label="Amount of gas" symbol="n" tone="active" color={C.N.color} badgeBg={C.N.bg} testId="N" rowTestId="block-N"
        value={controls.N} {...LIMITS.N} onChange={(N) => onChange({ N })}
        badgeText={`${state.n.toFixed(2)} mol`} minText={`${(LIMITS.N.min * 0.01).toFixed(2)} mol`} maxText={`${(LIMITS.N.max * 0.01).toFixed(2)} mol`}
        valueText={`${state.n.toFixed(2)} moles`}
      />
      {pressureRow}
      {volumeRow}
      {note && <p className="sd-note" data-testid="pressure-note" role="status">{note}</p>}
    </DashPanel>
  );
}
