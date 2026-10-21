import { Settings2, Play } from "lucide-react";
import { MODES, RANGES, TEXT_ONE_LINER, VARS, displayAmount, effectiveRange, formatScientific, formatValue } from "../model.js";
import { VAR_CHIP } from "../theme.js";
import { ControlLegend, DashPanel, MiniSwitch, ReadOnlyRow, SliderRow, StepButton } from "../../../components/simulation/SimulationDashboard.jsx";

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

function VarRow({ k, state, role, unit, onUnit, onChange, accent }) {
  const v = VARS[k];
  const hard = RANGES[k];
  const range = effectiveRange(state, k);
  const value = state[k];
  const id = `gl-${k}`;
  const depName = VARS[MODES[state.mode].dependent];
  const isAmount = k === "n";
  const slider = role !== "calc";
  const adjustable = role === "active" || role === "edit";
  const atLimit = slider && adjustable && range.limited && (value <= range.min + 1e-9 || value >= range.max - 1e-9);
  const rangeText = (x) => (isAmount ? x.toFixed(2) : k === "V" ? Number(x.toFixed(1)).toString() : String(Math.round(x)));
  const limitNote = slider && adjustable && range.limited
    ? atLimit
      ? `Limit reached: ${depName.name.toLowerCase()} must stay within ${RANGES[depName.key].min}–${RANGES[depName.key].max} ${depName.unit}.`
      : `Range here: ${rangeText(range.min)}–${rangeText(range.max)} ${v.unit}.`
    : null;
  const tone = role === "locked" ? "locked" : role === "edit" ? "edit" : "active";
  const label = isAmount ? "Amount of gas" : v.name;
  const badgeText = isAmount ? <AmountChip n={value} unit={unit} /> : `${formatValue(k, value)} ${v.unit}`;
  const valueText = isAmount ? displayAmount(value, unit).text : `${formatValue(k, value)} ${v.unit}`;
  const step = (dir) => onChange(k, Math.round((value + dir * RANGES.n.step) / RANGES.n.step) * RANGES.n.step);

  if (role === "calc") {
    return (
      <ReadOnlyRow
        label={label} symbol={k} hint="calculated" color={accent.slider} badgeBg={VAR_CHIP[k]} testId={k} rowTestId={`block-${k}`}
        badgeText={badgeText} tooltip="Calculated from PV = nRT"
      />
    );
  }
  return (
    <SliderRow
      id={id} label={label} symbol={k} tone={tone} color={accent.slider} badgeBg={VAR_CHIP[k]} testId={k} rowTestId={`block-${k}`}
      value={value} min={hard.min} max={hard.max} step={hard.step}
      onChange={(x) => onChange(k, x)}
      badgeText={badgeText} valueText={`${valueText}${role === "locked" ? ", constant" : ""}`}
      minText={`${isAmount ? hard.min.toFixed(1) : hard.min} ${v.unit}`} maxText={`${isAmount ? hard.max.toFixed(1) : hard.max} ${v.unit}`}
      lockTitle="Locked: kept constant"
      minmaxMid={isAmount ? <MiniSwitch options={UNIT_OPTIONS} value={unit} onChange={onUnit} ariaLabel="Show amount of gas as" testId="unit-toggle" /> : null}
      slideStart={isAmount && adjustable ? <StepButton dir={-1} onClick={() => step(-1)} label="Remove 0.05 mol of gas" testId="n-minus" /> : null}
      slideEnd={isAmount && adjustable ? <StepButton dir={1} onClick={() => step(1)} label="Add 0.05 mol of gas" testId="n-plus" /> : null}
      note={limitNote}
    />
  );
}

export default function ControlPanel({ state, phase, unit, onUnit, onChange, onEditBaseline, onStart, onNewInvestigation, accent }) {
  const m = MODES[state.mode];
  const roleOf = (k) => (k === m.dependent ? "calc" : phase === "editing" ? "edit" : k === m.independent ? "active" : "locked");
  const legend = phase === "editing"
    ? [{ text: "Set the start values, then press Start", strong: true }]
    : [{ lock: true, text: "= Kept constant", strong: true }, { color: accent.soft, text: "Adjust" }, { color: "#FFF7DE", text: "Calculated" }];
  return (
    <DashPanel
      title="Controls" ariaLabel="Control panel" grow testId="control-panel" data-phase={phase}
      aside={
        <>
          {phase === "ready" && (
            <button type="button" className="sd-btn sd-btn--sm" onClick={onEditBaseline} data-testid="set-initial" aria-label="Set initial conditions" title="Set initial conditions: choose the starting values before you begin investigating">
              <Settings2 size={13} aria-hidden="true" /> Initial conditions
            </button>
          )}
          {phase === "editing" && (
            <button type="button" className="sd-btn sd-btn--sm" onClick={onStart} data-testid="start-investigation" style={{ background: accent.solid, borderColor: accent.solid, color: "#fff" }} title="Confirm the starting values and lock the constant variables">
              <Play size={12} aria-hidden="true" /> Start investigation
            </button>
          )}
          {phase === "running" && (
            <button type="button" className="sd-btn sd-btn--sm" onClick={onNewInvestigation} data-testid="new-investigation" title="Return to the starting values and choose new initial conditions">
              <Settings2 size={13} aria-hidden="true" /> New investigation
            </button>
          )}
        </>
      }
      bodyClassName="sd-rows"
    >
      <ControlLegend items={legend} />
      {ORDER.map((k) => (
        <VarRow key={k} k={k} state={state} role={roleOf(k)} unit={unit} onUnit={onUnit} onChange={onChange} accent={accent} />
      ))}
      <div className="sd-row" style={{ "--sd-color": "#7b8fb8", background: "#f2f7ff", padding: "4px 8px" }} data-testid="relationship-card" aria-label="Current relationship">
        <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <span className="sd-small font-bold text-[#14226B]">Current relationship:</span>
          <span className="text-[17px] font-bold italic text-[#14226B]" data-testid="relation">{m.relation}</span>
          <span className="sd-small">({m.constantText})</span>
        </p>
        <p className="sd-small">{m.sentence}</p>
      </div>
      <p className="sd-small sd-only-one rounded-lg border border-[#F2E2B0] bg-[#FFF7DC] px-2 py-0.5 font-medium text-[#4A3B0A]" data-testid="one-liner">{TEXT_ONE_LINER}</p>
    </DashPanel>
  );
}
