import { useState } from "react";
import { GASES, GAS_IDS, IB_UNITS, LIMITS, fmtPressure, fmtVolume, pFromDisplay, pToDisplay, unitLabelP, unitLabelV, vFromDisplay, vToDisplay } from "../model.js";
import { PRESSURE_UNITS, VOLUME_UNITS } from "../../../lib/gas/gasUnits.js";
import { REASON_TEXT } from "../../../components/interactive-shell/readings/readingsModel.js";
import NumberField from "../../../components/interactive-shell/NumberField.jsx";
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

const KPA = 101.325;

// Compact controls column: the Change Pressure | Change Volume selector (only ONE of the two is
// adjustable; the other is calculated), then T, amount, and the pressure / volume rows.
// Pressure and volume are shown in the chosen display units (default IB: kPa and dm3); the model itself is atm / L.
// Every adjustable value also has a typed box (exact values such as 100 kPa or 273.15 K) with explicit out-of-range messages.
export default function ControlsPanel({ controls, state, onChange, units = IB_UNITS, onRecord, readingCount = 0 }) {
  const pressureMode = controls.control === "pressure";
  const targetP = state.pTarget ?? state.pressure;
  // GS-05: in Real mode the slider ends at the highest pressure this gas can actually reach (it would condense or run out of free volume above it).
  const pTop = Math.min(LIMITS.P.max, state.pReachMax ?? LIMITS.P.max);
  const pValue = pressureMode ? Math.min(controls.P, pTop) : Math.min(LIMITS.P.max, Math.max(LIMITS.P.min, state.pressure));
  const [notice, setNotice] = useState({});
  const note = state.note;
  const uP = unitLabelP(units); const uV = unitLabelV(units);
  const fmtP = (atm) => fmtPressure(atm, units); const fmtV = (L) => fmtVolume(L, units);
  const dP = (atm) => pToDisplay(atm, units); const dV = (L) => vToDisplay(L, units);
  const setN = (k) => (text) => setNotice((n) => ({ ...n, [k]: text }));
  const typedP = (
    <NumberField value={dP(targetP)} min={dP(LIMITS.P.min)} max={dP(pTop)} decimals={units.pressure === "kPa" ? 1 : 3} unit={uP} label="Type a pressure"
      onCommit={(x) => onChange({ P: pFromDisplay(x, units) })} onNotice={setN("P")} testId="input-ig-P" width={72} />
  );
  const typedV = (
    <NumberField value={dV(state.V)} min={dV(LIMITS.V.min)} max={dV(LIMITS.V.max)} decimals={2} unit={uV} label="Type a volume"
      onCommit={(x) => onChange({ V: vFromDisplay(x, units) })} onNotice={setN("V")} testId="input-ig-V" width={72} />
  );
  const typedT = (
    <NumberField value={controls.T} min={LIMITS.T.min} max={LIMITS.T.max} decimals={2} unit="K" label="Type a temperature"
      onCommit={(T) => onChange({ T })} onNotice={setN("T")} testId="input-ig-T" width={66} />
  );

  const volumeRow = pressureMode ? (
    <ReadOnlyRow
      key="V" label="Volume" symbol="V" hint="calculated" color={C.V.color} badgeBg={C.V.bg} testId="V" rowTestId="block-V"
      badgeText={`${fmtV(state.V)} ${uV}`} tooltip="Volume is calculated: the piston moves until the gas pressure matches the target."
    />
  ) : (
    <SliderRow
      key="V" id="ig-volume" label="Volume" symbol="V" tone="active" color={C.V.color} badgeBg={C.V.bg} testId="V" rowTestId="block-V"
      value={V_SCALE.toPos(controls.V)} min={0} max={POS_MAX} step={1} onChange={(pos) => { setN("V")(null); onChange({ V: V_SCALE.fromPos(pos) }); }}
      badgeText={`${fmtV(controls.V)} ${uV}`} minText={`${fmtV(LIMITS.V.min)} ${uV}`} maxText={`${fmtV(LIMITS.V.max)} ${uV}`}
      valueText={`${fmtV(controls.V)} ${VOLUME_UNITS[units.volume]?.spoken ?? "cubic decimetres"}`} labelExtra={typedV} note={notice.V}
    />
  );
  const pressureRow = pressureMode ? (
    <SliderRow
      key="P" id="ig-pressure" label="Pressure" symbol="P" tone="active" color={C.P.color} badgeBg={C.P.bg} testId="P" rowTestId="block-P"
      value={P_SCALE.toPos(pValue)} min={0} max={Math.max(1, P_SCALE.toPos(pTop))} step={1} onChange={(pos) => { setN("P")(null); onChange({ P: Math.min(pTop, P_SCALE.fromPos(pos)) }); }}
      badgeText={`${fmtP(targetP)} ${uP}`} minText={`${fmtP(LIMITS.P.min)} ${uP}`} maxText={`${fmtP(pTop)} ${uP}`}
      valueText={`${fmtP(targetP)} ${PRESSURE_UNITS[units.pressure]?.spoken ?? "kilopascals"}, target`} labelExtra={typedP} note={notice.P}
    />
  ) : (
    <ReadOnlyRow
      key="P" label="Pressure" symbol="P" hint="calculated" color={C.P.color} badgeBg={C.P.bg} testId="P" rowTestId="block-P"
      badgeText={`${fmtP(state.pressure)} ${uP}`} tooltip="Pressure is calculated from n, T and V by the selected gas model."
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
      <div className="sd-selector" data-testid="gas-picker">
        <MiniSwitch
          large fill role="radio" value={controls.gasId} ariaLabel="Which gas?" onChange={(gasId) => onChange({ gasId })} testId="gas-id-switch"
          options={GAS_IDS.map((id) => ({ id, label: GASES[id].tag, title: `${GASES[id].name}: real-gas behaviour from van der Waals a = ${GASES[id].a}, b = ${GASES[id].b}` }))}
        />
      </div>
      <SliderRow
        id="ig-temperature" label="Temperature" symbol="T" tone="active" color={C.T.color} badgeBg={C.T.bg} testId="T" rowTestId="block-T"
        value={controls.T} {...LIMITS.T} onChange={(T) => { setN("T")(null); onChange({ T }); }}
        badgeText={`${Number(controls.T.toFixed(2))} K`} minText={`${LIMITS.T.min} K`} maxText={`${LIMITS.T.max} K`} valueText={`${Number(controls.T.toFixed(2))} kelvin, ${(controls.T - 273.15).toFixed(1)} degrees Celsius`}
        labelExtra={typedT} note={notice.T ?? `${(controls.T - 273.15).toFixed(1).replace("-", "\u2212")} \u00b0C`} noteTone="info"
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
      {onRecord && (
        <button type="button" className="sd-btn sd-btn--sm" data-testid="record-from-controls" title="Add the current P, V, T, n and Z to your readings table (Graph > My readings)"
          onClick={() => { const r = onRecord(); setNotice((n) => ({ ...n, rec: r && !r.ok ? REASON_TEXT[r.reason] : null })); }}>
          Record reading{readingCount ? ` (${readingCount})` : ""}
        </button>
      )}
      {notice.rec && <p className="sd-note" role="status" data-testid="record-note">{notice.rec}</p>}
    </DashPanel>
  );
}
