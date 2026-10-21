import { Undo2 } from "lucide-react";
import { MODES, RANGES, VARS, displayAmount, effectiveRange, formatScientific, formatValue } from "../model.js";
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

function VarSlider({ k, state, unit, onChange, accent, tone = "active", idPrefix = "gl" }) {
  const v = VARS[k];
  const hard = RANGES[k];
  const range = effectiveRange(state, k);
  const value = state[k];
  const depName = VARS[MODES[state.mode].dependent];
  const isAmount = k === "n";
  const atLimit = range.limited && (value <= range.min + 1e-9 || value >= range.max - 1e-9);
  const rangeText = (x) => (isAmount ? x.toFixed(2) : k === "V" ? Number(x.toFixed(1)).toString() : String(Math.round(x)));
  const limitNote = range.limited && atLimit
    ? `Limit reached: ${depName.name.toLowerCase()} must stay within ${RANGES[depName.key].min}–${RANGES[depName.key].max} ${depName.unit}.`
    : null;
  const badgeText = isAmount ? <AmountChip n={value} unit={unit} /> : `${formatValue(k, value)} ${v.unit}`;
  const valueText = isAmount ? displayAmount(value, unit).text : `${formatValue(k, value)} ${v.unit}`;
  const step = (dir) => onChange(k, Math.round((value + dir * RANGES.n.step) / RANGES.n.step) * RANGES.n.step);
  return (
    <SliderRow
      id={`${idPrefix}-${k}`} label={labelOf(k)} symbol={k} tone={tone} color={accent.slider} badgeBg={VAR_CHIP[k]} testId={k} rowTestId={`block-${k}`}
      value={value} min={hard.min} max={hard.max} step={hard.step}
      onChange={(x) => onChange(k, x)}
      badgeText={badgeText} valueText={valueText}
      minText={`${isAmount ? hard.min.toFixed(1) : hard.min} ${v.unit}`} maxText={`${isAmount ? hard.max.toFixed(1) : hard.max} ${v.unit}`}
      slideStart={isAmount ? <StepButton dir={-1} onClick={() => step(-1)} label="Remove 0.05 mol of gas" testId={`${idPrefix}-n-minus`} /> : null}
      slideEnd={isAmount ? <StepButton dir={1} onClick={() => step(1)} label="Add 0.05 mol of gas" testId={`${idPrefix}-n-plus`} /> : null}
      note={limitNote}
    />
  );
}

function CalcRow({ k, state, unit, accent }) {
  const v = VARS[k];
  const value = state[k];
  return (
    <ReadOnlyRow
      label={labelOf(k)} symbol={k} hint="calculated" color={accent.slider} badgeBg={VAR_CHIP[k]} testId={k} rowTestId={`block-${k}`}
      badgeText={k === "n" ? <AmountChip n={value} unit={unit} /> : `${formatValue(k, value)} ${v.unit}`} tooltip="Calculated from PV = nRT"
    />
  );
}

/** Main controls: ONLY the independent variable is a slider. The two controlled variables are one compact
 * read-only row; the calculated variable is a read-only value. */
export default function ControlPanel({ state, unit, onChange, accent }) {
  const m = MODES[state.mode];
  const constants = m.locked.map((k) => ({
    id: k, label: labelOf(k), color: accent.slider,
    value: k === "n" ? <AmountChip n={state[k]} unit={unit} /> : `${formatValue(k, state[k])} ${VARS[k].unit}`,
  }));
  return (
    <DashPanel title="Controls" ariaLabel="Control panel" grow testId="control-panel" bodyClassName="sd-rows">
      <VarSlider k={m.independent} state={state} unit={unit} onChange={onChange} accent={accent} />
      <ConstantsRow items={constants} />
      <CalcRow k={m.dependent} state={state} unit={unit} accent={accent} />
    </DashPanel>
  );
}

/** Settings popover: initial conditions (starting values), display options, amount unit. */
export function GasLawsSettings({ state, phase, unit, onUnit, display, onDisplay, onSetInitial, onBackToStart, accent }) {
  const m = MODES[state.mode];
  return (
    <>
      <PopoverSection title="Initial conditions" testId="settings-initial">
        <p className="sd-pop-note">Choose the starting values. {labelOf(m.dependent)} is calculated.</p>
        {ORDER.filter((k) => k !== m.dependent).map((k) => (
          <VarSlider key={k} k={k} state={state} unit={unit} onChange={onSetInitial} accent={accent} tone="edit" idPrefix="gl-init" />
        ))}
        <button type="button" className="sd-btn sd-btn--sm" onClick={onBackToStart} disabled={phase !== "running"} data-testid="back-to-start" title="Return to the starting values of this investigation">
          <Undo2 size={13} aria-hidden="true" /> Back to starting values
        </button>
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
