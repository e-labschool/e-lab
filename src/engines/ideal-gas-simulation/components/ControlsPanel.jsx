import { Info, Lock } from "lucide-react";
import { LIMITS } from "../model.js";
import { ControlLegend, DashPanel, MiniSwitch, ReadOnlyRow, SliderRow } from "../../../components/simulation/SimulationDashboard.jsx";

import { GAS_DESCRIPTIONS } from "../gasDescriptions.js";

// Variable colours (shared with the Live values tiles).
const C = {
  N: { color: "#2F7BF5", bg: "#E1EDFD" },
  T: { color: "#F5A50B", bg: "#FDEFD0" },
  V: { color: "#34C256", bg: "#DFF5E4" },
  P: { color: "#8B5CF6", bg: "#EBE4FC" },
};

const CONTROL_OPTIONS = [
  { id: "volume", label: "Volume", title: "You set the volume; pressure is calculated" },
  { id: "pressure", label: "Pressure", title: "You set the target pressure; volume is calculated" },
];

// Compact controls column: one legend line, two always-adjustable sliders (n, T),
// the mutually exclusive Volume/Pressure control switch, and the controlled
// variable as a slider with the other one shown as a read-only calculated row.
export default function ControlsPanel({ controls, state, onChange }) {
  const pressureMode = controls.control === "pressure";
  const targetP = state.pTarget ?? state.pressure;
  const pValue = pressureMode ? controls.P : Math.min(LIMITS.P.max, Math.max(LIMITS.P.min, state.pressure));
  const note = pressureMode ? state.note : null;

  const volumeRow = pressureMode ? (
    <ReadOnlyRow
      key="V" label="Volume" symbol="V" hint="calculated" color={C.V.color} badgeBg={C.V.bg} testId="V" rowTestId="block-V"
      badgeText={`${state.V.toFixed(1)} L`} tooltip="Volume is calculated: the piston moves until the gas pressure matches the target."
    />
  ) : (
    <SliderRow
      key="V" id="ig-volume" label="Volume" symbol="V" tone="active" color={C.V.color} badgeBg={C.V.bg} testId="V" rowTestId="block-V"
      value={controls.V} {...LIMITS.V} onChange={(V) => onChange({ V })}
      badgeText={`${controls.V} L`} minText={`${LIMITS.V.min} L`} maxText={`${LIMITS.V.max} L`}
      valueText={`${controls.V.toFixed(1)} litres`}
    />
  );
  const pressureRow = pressureMode ? (
    <SliderRow
      key="P" id="ig-pressure" label="Pressure" symbol="P" tone="active" color={C.P.color} badgeBg={C.P.bg} testId="P" rowTestId="block-P"
      value={pValue} {...LIMITS.P} onChange={(P) => onChange({ P })}
      badgeText={`${targetP.toFixed(2)} atm`} minText={`${LIMITS.P.min} atm`} maxText={`${LIMITS.P.max} atm`}
      valueText={`${targetP.toFixed(2)} atmospheres, target`}
    />
  ) : (
    <ReadOnlyRow
      key="P" label="Pressure" symbol="P" hint="calculated" color={C.P.color} badgeBg={C.P.bg} testId="P" rowTestId="block-P"
      badgeText={`${state.pressure.toFixed(2)} atm`} tooltip="Pressure is calculated from n, T and V by the selected gas model."
    />
  );

  return (
    <DashPanel
      title="Controls" ariaLabel="Controls" grow testId="control-panel" bodyClassName="sd-rows"
    >
      <ControlLegend items={[
        { color: "#fff", text: "You change", strong: false },
        { color: "#FFF7DE", text: "Calculated" },
      ]} />
      <SliderRow
        id="ig-particles" label="Number of particles" symbol="n" tone="active" color={C.N.color} badgeBg={C.N.bg} testId="N" rowTestId="block-N"
        value={controls.N} {...LIMITS.N} onChange={(N) => onChange({ N })}
        badgeText={`${controls.N}`} minText={`${LIMITS.N.min}`} maxText={`${LIMITS.N.max}`} valueText={`${controls.N} particles`}
      />
      <SliderRow
        id="ig-temperature" label="Temperature" symbol="T" tone="active" color={C.T.color} badgeBg={C.T.bg} testId="T" rowTestId="block-T"
        value={controls.T} {...LIMITS.T} onChange={(T) => onChange({ T })}
        badgeText={`${controls.T} K`} minText={`${LIMITS.T.min} K`} maxText={`${LIMITS.T.max} K`} valueText={`${controls.T} kelvin`}
      />
      <div className="sd-row" style={{ "--sd-color": "#8a97b2", padding: "4px 8px" }} data-testid="control-mode">
        <div className="sd-row-top">
          <Lock size={13} className="shrink-0" aria-hidden="true" />
          <span id="ig-control-label" className="sd-row-label">Control:</span>
          <span className="sd-row-spacer" />
          <MiniSwitch
            large options={CONTROL_OPTIONS} value={controls.control} ariaLabel="Control" onChange={(control) => onChange({ control })}
            testId="control-switch"
          />
        </div>
      </div>
      {volumeRow}
      {pressureRow}
      {note && <p className="sd-note" data-testid="pressure-note">{note}</p>}
      <p
        className="sd-small flex items-start gap-1.5 rounded-lg bg-[#EAF2FE] px-2 py-1 text-[#14226B]"
        data-testid="gas-description"
      >
        <Info size={14} className="mt-px shrink-0 text-[#2F7BF5]" aria-hidden="true" />
        <span><strong>{controls.mode === "real" ? "Real gas" : "Ideal gas"}:</strong> {GAS_DESCRIPTIONS[controls.mode]}</span>
      </p>
    </DashPanel>
  );
}
