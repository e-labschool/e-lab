import { useState } from "react";
import { Undo2 } from "lucide-react";
import { IB_UNITS, MODES, RANGES, VARS, depOf, displayAmount, displayValue, effectiveRange, formatScientific, formatValue, freeKeys, fromDisplayValue, limitReason, unitLabel } from "../model.js";
import { PRESSURE_UNITS, VOLUME_UNITS } from "../../../lib/gas/gasUnits.js";
import NumberField from "../../../components/interactive-shell/NumberField.jsx";
import { VAR_CHIP } from "../theme.js";
import { ConstantsRow, DashPanel, MiniSwitch, PopoverSection, ReadOnlyRow, SettingToggle, SliderRow, StepButton } from "../../../components/simulation/SimulationDashboard.jsx";

const ORDER = ["n", "T", "V", "P"];
const UNIT_OPTIONS = [
  { id: "mol", label: "mol", title: "Show the amount of gas in moles" },
  { id: "molecules", label: "molecules", title: "Show the amount of gas as a number of molecules" },
];

/** Amount of gas as text/JSX in the chosen unit (one line). */
export function AmountChip({ n, unit, className = "" }) {
  if (unit === "molecules") {
    const f = formatScientific(n * 6.02214076e23, 2);
    return <span className={"whitespace-nowrap " + className} data-testid="amount-chip">{f.mantissa} × 10<sup>{f.exponent}</sup></span>;
  }
  return <span className={"whitespace-nowrap " + className} data-testid="amount-chip">{displayAmount(n, "mol").text}</span>;
}

const labelOf = (k) => (k === "n" ? "Amount" : VARS[k].name);
const STEP = { P: { kPa: 5, atm: 0.05, mmHg: 5 }, V: { dm3: 0.5, L: 0.5, cm3: 500 }, T: 1, n: 0.05 };
const stepOf = (k, units) => (k === "P" ? STEP.P[units.pressure] ?? 5 : k === "V" ? STEP.V[units.volume] ?? 0.5 : STEP[k]);
const decOf = (k, units) => (k === "P" ? PRESSURE_UNITS[units.pressure]?.decimals ?? 1 : k === "V" ? VOLUME_UNITS[units.volume]?.decimals ?? 1 : k === "T" ? 2 : 2);

function VarSlider({ k, state, unit, units, onChange, accent, tone = "active", idPrefix = "gl", typed = true }) {
  const v = VARS[k];
  const range = effectiveRange(state, k);
  const value = state[k];
  const isAmount = k === "n";
  const [notice, setNotice] = useState(null);
  // A slider moves in whole steps from its minimum, so when the real end is not on a step the last notch sits just below it: still the limit.
  const maxTol = Math.abs(fromDisplayValue(k, displayValue(k, range.min, units) + stepOf(k, units), units) - range.min);
  const limit = limitReason(state, k, units, k === "n" ? 0 : maxTol);
  const ul = unitLabel(k, units);
  // GS-16: say which part of the full range can be reached, and why, before the student hits the end.
  const reach = range.limited && !limit && !notice
    ? `Reachable: ${Number(displayValue(k, range.min, units).toFixed(k === "n" ? 2 : decOf(k, units)))} to ${Number(displayValue(k, range.max, units).toFixed(k === "n" ? 2 : decOf(k, units)))} ${ul} (full range ${Number(displayValue(k, range.hard.min, units).toFixed(k === "n" ? 2 : decOf(k, units)))} to ${Number(displayValue(k, range.hard.max, units).toFixed(k === "n" ? 2 : decOf(k, units)))}; the ${VARS[range.dep].name.toLowerCase()} must stay in its range)`
    : null;
  const snap = (x) => Number(x.toPrecision(10)); // float dust must not make a whole-number end unreachable by the slider
  const dMin = snap(displayValue(k, range.min, units)); const dMax = snap(displayValue(k, range.max, units));
  const tx = (x) => (isAmount ? x.toFixed(2) : Number(x.toFixed(k === "T" ? 0 : decOf(k, units))).toString());
  const badgeText = isAmount ? <AmountChip n={value} unit={unit} /> : `${formatValue(k, value, units)} ${ul}`;
  const valueText = isAmount ? displayAmount(value, unit).text : `${formatValue(k, value, units)} ${ul}`;
  const step = (dir) => onChange(k, Math.round((value + dir * RANGES.n.step) / RANGES.n.step) * RANGES.n.step);
  const commit = (x) => onChange(k, fromDisplayValue(k, x, units));
  return (
    <SliderRow
      id={`${idPrefix}-${k}`} label={labelOf(k)} symbol={k} tone={tone} color={accent.slider} badgeBg={VAR_CHIP[k]} testId={k} rowTestId={`block-${k}`}
      value={displayValue(k, value, units)} min={dMin} max={dMax} step={stepOf(k, units)}
      onChange={(x) => { setNotice(null); commit(x); }}
      badgeText={badgeText} valueText={valueText}
      minText={`${tx(dMin)} ${ul}`} maxText={`${tx(dMax)} ${ul}`}
      labelExtra={typed ? (
        <NumberField value={displayValue(k, value, units)} min={dMin} max={dMax} decimals={k === "T" ? 2 : decOf(k, units)} unit={ul}
          label={`Type a value for ${labelOf(k).toLowerCase()}`} onCommit={commit} onNotice={setNotice} testId={`input-${idPrefix}-${k}`} width={k === "V" || k === "T" ? 66 : 62} />
      ) : null}
      slideStart={isAmount ? <StepButton dir={-1} onClick={() => step(-1)} label="Remove 0.05 mol of gas" testId={`${idPrefix}-n-minus`} /> : null}
      slideEnd={isAmount ? <StepButton dir={1} onClick={() => step(1)} label="Add 0.05 mol of gas" testId={`${idPrefix}-n-plus`} /> : null}
      note={notice ?? limit ?? reach} noteTone={!notice && !limit && reach ? "info" : undefined}
    />
  );
}

function CalcRow({ k, state, unit, units, accent }) {
  const value = state[k];
  return (
    <ReadOnlyRow
      label={labelOf(k)} symbol={k} hint="calculated" color={accent.slider} badgeBg={VAR_CHIP[k]} testId={k} rowTestId={`block-${k}`}
      badgeText={k === "n" ? <AmountChip n={value} unit={unit} /> : `${formatValue(k, value, units)} ${unitLabel(k, units)}`} tooltip="Calculated from PV = nRT, R = 8.31 J K\u207b\u00b9 mol\u207b\u00b9"
    />
  );
}

/** Main controls: ONLY the independent variable is a slider (the combined mode has three). The controlled variables are one compact
 * read-only row; the calculated variable is a read-only value. Each slider also has a typed-value box, and its ends are the REAL
 * reachable limits (so nothing is clamped silently). */
export default function ControlPanel({ state, unit, units = IB_UNITS, onChange, accent, onRecord, readingCount = 0, onCalc }) {
  const m = MODES[state.mode];
  const dep = depOf(state);
  const free = freeKeys(state);
  const constants = m.locked.map((k) => ({
    id: k, label: labelOf(k), color: accent.slider,
    value: k === "n" ? <AmountChip n={state[k]} unit={unit} /> : `${formatValue(k, state[k], units)} ${unitLabel(k, units)}`,
  }));
  return (
    <DashPanel title="Controls" ariaLabel="Control panel" grow testId="control-panel" bodyClassName="sd-rows">
      {state.mode === "comb" && (
        <div className="gl-calc-pick" data-testid="calc-pick">
          <span id="gl-calc-label">Calculate</span>
          <MiniSwitch options={["P", "V", "T", "n"].map((k) => ({ id: k, label: k, title: `Calculate the ${labelOf(k).toLowerCase()}` }))} value={dep} onChange={onCalc} ariaLabel="Variable to calculate" testId="calc-toggle" />
        </div>
      )}
      {free.map((k) => <VarSlider key={k + dep} k={k} state={state} unit={unit} units={units} onChange={onChange} accent={accent} />)}
      {constants.length > 0 && <ConstantsRow items={constants} />}
      <CalcRow k={dep} state={state} unit={unit} units={units} accent={accent} />
      <button type="button" className="sd-btn sd-btn--sm gl-record" onClick={onRecord} data-testid="record-from-controls" title="Add the current P, V, T and n to your readings table (Graph > My readings)">
        Record reading{readingCount ? ` (${readingCount})` : ""}
      </button>
    </DashPanel>
  );
}

/** Settings popover: units, standard-condition presets, initial conditions (starting values), display options, amount unit. */
export function GasLawsSettings({ state, phase, unit, onUnit, display, onDisplay, onSetInitial, onBackToStart, onStandardStart, accent, units, unitSystem, onUnitSystem, onPreset }) {
  const dep = depOf(state);
  return (
    <>
      <PopoverSection title="Units" testId="settings-units">
        <MiniSwitch large options={[{ id: "ib", label: "kPa, dm\u00b3", title: "IB data booklet units: kPa with dm\u00b3, R = 8.31 J K\u207b\u00b9 mol\u207b\u00b9" }, { id: "atm", label: "atm, L", title: "Older convention: atmospheres and litres" }]} value={unitSystem} onChange={onUnitSystem} ariaLabel="Pressure and volume units" testId="unit-system" />
        <p className="sd-pop-note">Temperature is always in kelvin (T = t + 273.15). The gas behaves the same in either unit system.</p>
      </PopoverSection>
      <PopoverSection title="Standard conditions" testId="settings-presets">
        <div className="gl-presets">
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => onPreset("stp")} data-testid="preset-stp" title="STP: 273.15 K (0 \u00b0C), 100 kPa, 1.00 mol, so V = 22.7 dm\u00b3">STP</button>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => onPreset("satp")} data-testid="preset-satp" title="SATP: 298.15 K (25 \u00b0C), 100 kPa, 1.00 mol, so V = 24.8 dm\u00b3">SATP</button>
        </div>
        <p className="sd-pop-note">IB data booklet: STP = 273.15 K and 100 kPa (molar volume 22.7 dm\u00b3 mol\u207b\u00b9); SATP = 298.15 K and 100 kPa. Sets n = 1.00 mol and recalculates the rest.</p>
      </PopoverSection>
      <PopoverSection title="Initial conditions" testId="settings-initial">
        <p className="sd-pop-note">Choose the starting values. {labelOf(dep)} is calculated.</p>
        {ORDER.filter((k) => k !== dep).map((k) => (
          <VarSlider key={k} k={k} state={state} unit={unit} units={units} onChange={onSetInitial} accent={accent} tone="edit" idPrefix="gl-init" />
        ))}
        <button type="button" className="sd-btn sd-btn--sm" onClick={onBackToStart} disabled={phase !== "running"} data-testid="back-to-start" title="Return to the starting values of this investigation">
          <Undo2 size={13} aria-hidden="true" /> Back to starting values
        </button>
        {onStandardStart && (
          <button type="button" className="sd-btn sd-btn--sm" onClick={onStandardStart} data-testid="standard-start" title="Set this investigation to 1.00 mol, 300 K and 25 dm\u00b3 (the standard start)">
            Standard start (1.00 mol, 300 K, 25 dm\u00b3)
          </button>
        )}
      </PopoverSection>
      <PopoverSection title="Particle picture" testId="settings-display">
        <SettingToggle id="gl-set-trails" label="Particle trails" hint="Show the recent path of each particle." checked={display.trails} onChange={(trails) => onDisplay({ trails })} testId="toggle-trails" />
        <SettingToggle id="gl-set-flashes" label="Collision flashes" hint="Highlight particle-particle and particle-wall collisions." checked={display.collisions} onChange={(collisions) => onDisplay({ collisions })} testId="toggle-collisions" />
      </PopoverSection>
      <PopoverSection title="Amount of gas">
        <MiniSwitch large options={UNIT_OPTIONS} value={unit} onChange={onUnit} ariaLabel="Show amount of gas as" testId="unit-toggle" />
      </PopoverSection>
    </>
  );
}
