import { Lock, LockOpen, Minus, Plus, Play, Settings2 } from "lucide-react";
import { MODES, RANGES, VARS, displayAmount, effectiveRange, formatScientific, formatValue } from "../model.js";
import { VAR_CHIP } from "../theme.js";

const navy = "text-[#14226B]";
const ORDER = ["n", "T", "V", "P"];
const ACTIVE_TEXT = {
  V: "Adjust the volume by moving the piston.",
  T: "Adjust the temperature.",
  n: "Add or remove gas.",
};

export function AmountChip({ n, unit, className = "" }) {
  if (unit === "molecules") {
    const f = formatScientific(n * 6.02214076e23, 2);
    return (
      <span className={"flex flex-col items-center leading-tight " + className} data-testid="amount-chip">
        <span className="whitespace-nowrap">{f.mantissa} × 10<sup>{f.exponent}</sup></span>
        <span className="text-[9.5px] font-medium">molecules</span>
      </span>
    );
  }
  return <span className={"whitespace-nowrap " + className} data-testid="amount-chip">{displayAmount(n, "mol").text}</span>;
}

function UnitToggle({ unit, onUnit }) {
  const opts = [{ id: "mol", label: "Moles" }, { id: "molecules", label: "Molecules" }];
  return (
    <div role="radiogroup" aria-label="Show amount of gas as" className="grid shrink-0 grid-cols-2 overflow-hidden rounded-lg bg-[#EDF3FD] p-px" data-testid="unit-toggle">
      {opts.map((o) => {
        const sel = unit === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={sel} tabIndex={sel ? 0 : -1} onClick={() => onUnit(o.id)}
            onKeyDown={(e) => {
              if (["ArrowRight", "ArrowDown"].includes(e.key)) { e.preventDefault(); onUnit("molecules"); }
              if (["ArrowLeft", "ArrowUp"].includes(e.key)) { e.preventDefault(); onUnit("mol"); }
            }}
            className={"rounded-md px-1 py-0.5 text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F7BF5] " + (sel ? "text-white shadow-sm" : navy + " hover:bg-white/70")}
            style={sel ? { background: "#2F7BF5" } : undefined}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function VarBlock({ k, state, role, unit, onUnit, onChange, accent, dense }) {
  const v = VARS[k];
  const hard = RANGES[k];
  const range = effectiveRange(state, k);
  const value = state[k];
  const id = `gl-${k}`;
  const depName = VARS[MODES[state.mode].dependent];
  const slider = role !== "calc";
  const disabled = role === "locked";
  const atLimit = slider && !disabled && range.limited && (value <= range.min + 1e-9 || value >= range.max - 1e-9);
  const fill = ((value - hard.min) / (hard.max - hard.min)) * 100;
  const rangeText = (x) => (k === "n" ? x.toFixed(2) : k === "V" ? Number(x.toFixed(1)).toString() : String(Math.round(x)));
  const isAmount = k === "n";

  let helper;
  if (role === "locked") helper = "Kept constant for this investigation.";
  else if (role === "calc") helper = "Calculated from PV = nRT.";
  else if (role === "edit") helper = "Initial value. It is fixed once you start.";
  else helper = ACTIVE_TEXT[k];
  const limitNote = slider && !disabled && range.limited
    ? atLimit ? `Limit reached: ${depName.name.toLowerCase()} must stay within ${RANGES[depName.key].min}–${RANGES[depName.key].max} ${depName.unit}.` : `Range here: ${rangeText(range.min)}–${rangeText(range.max)} ${v.unit}.`
    : null;

  const bg = role === "active" || role === "edit" ? accent.soft : role === "calc" ? "#FFF6DD" : "#FFFFFF";
  const border = role === "active" || role === "edit" ? accent.border : role === "calc" ? "#F6E4B0" : "#E7ECF6";
  const lockIcon = role === "locked" ? <Lock size={15} className="text-[#8A97B2]" aria-label="Locked" />
    : role === "edit" ? <LockOpen size={15} className="text-[#8A97B2]" aria-label="Unlocked for setting initial conditions" /> : null;
  const chipCls = "min-w-[68px] rounded-lg px-2 text-center font-semibold tabular-nums " + navy + (dense ? " py-1 text-[14px]" : " py-1.5 text-[15px]");
  const chip = (
    <span className={chipCls} style={{ background: VAR_CHIP[k] }} aria-hidden="true" data-testid={`chip-${k}`}>
      {isAmount ? <AmountChip n={value} unit={unit} /> : `${formatValue(k, value)} ${v.unit}`}
    </span>
  );
  const valueText = isAmount ? displayAmount(value, unit).text : `${formatValue(k, value)} ${v.unit}`;
  const input = slider ? (
    <input
      id={id} type="range" min={hard.min} max={hard.max} step={hard.step} value={value} disabled={disabled}
      aria-describedby={`${id}-desc`} aria-valuetext={`${valueText}${disabled ? ", constant" : ""}`}
      onChange={(e) => onChange(k, Number(e.target.value))}
      className={"gl-range" + (dense ? " gl-range-dense" : "")}
      style={{ "--gl-color": accent.slider, "--gl-fill": `${fill}%` }}
      data-testid={`slider-${k}`}
    />
  ) : null;
  const step = (dir) => onChange(k, Math.round((value + dir * RANGES.n.step) / RANGES.n.step) * RANGES.n.step);

  return (
    <div className={"rounded-xl border " + (dense ? "px-2 py-0.5" : "px-3 py-2.5")} style={{ background: bg, borderColor: border }} data-testid={`block-${k}`} data-role={role}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={slider ? id : undefined} className={"flex items-center gap-1.5 font-bold " + navy + (dense ? " whitespace-nowrap text-[13px]" : " whitespace-nowrap text-[15.5px]")} id={`${id}-label`}>
          {v.name} ({k}) {lockIcon}
        </label>
        {isAmount && <UnitToggle unit={unit} onUnit={onUnit} />}
        {role === "calc" && chip}
      </div>
      {slider && (
        <div className={"grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 " + (dense ? "mt-0" : "mt-1.5")}>
          {dense ? (
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
              <span className="text-[10px] leading-none text-[#33415F]" aria-hidden="true">{isAmount ? hard.min.toFixed(1) : hard.min} {v.unit}</span>
              {input}
              <span className="text-[10px] leading-none text-[#33415F]" aria-hidden="true">{isAmount ? hard.max.toFixed(1) : hard.max} {v.unit}</span>
            </div>
          ) : (
            <div>
              {input}
              <div className="flex justify-between text-[10.5px] leading-none text-[#33415F]" aria-hidden="true">
                <span>{isAmount ? hard.min.toFixed(1) : hard.min} {v.unit}</span><span>{isAmount ? hard.max.toFixed(1) : hard.max} {v.unit}</span>
              </div>
            </div>
          )}
          {chip}
        </div>
      )}
      <div className={"flex items-start justify-between gap-2 leading-tight " + (dense ? "mt-0.5 text-[10.5px]" : "mt-1.5 text-[12px]")}>
        <p id={`${id}-desc`} className={atLimit ? "text-[#9A5B00]" : role === "calc" ? "text-[#6B5B20]" : "text-[#52618A]"} data-testid={`helper-${k}`}>
          {helper}{limitNote && <span className={(dense ? "ml-1 " : "block ") + (atLimit ? "text-[#9A5B00]" : "text-[#52618A]")} data-testid={`limit-${k}`} title="The calculated variable is kept inside its displayable range so the piston and particles stay valid.">{limitNote}</span>}
        </p>
        {isAmount && !disabled && role !== "calc" && (
          <span className="flex shrink-0 gap-1">
            <button type="button" onClick={() => step(-1)} aria-label="Remove 0.05 mol of gas" data-testid="n-minus"
              className="grid h-6 w-6 place-items-center rounded-full border border-[#CBD6EC] bg-white text-[#14226B] hover:bg-[#EEF4FF] focus-visible:outline-2 focus-visible:outline-[#2F7BF5]"><Minus size={13} aria-hidden="true" /></button>
            <button type="button" onClick={() => step(1)} aria-label="Add 0.05 mol of gas" data-testid="n-plus"
              className="grid h-6 w-6 place-items-center rounded-full border border-[#CBD6EC] bg-white text-[#14226B] hover:bg-[#EEF4FF] focus-visible:outline-2 focus-visible:outline-[#2F7BF5]"><Plus size={13} aria-hidden="true" /></button>
          </span>
        )}
      </div>
    </div>
  );
}

export default function ControlPanel({ state, phase, unit, onUnit, onChange, onEditBaseline, onStart, onNewInvestigation, accent, dense }) {
  const m = MODES[state.mode];
  const roleOf = (k) => (k === m.dependent ? "calc" : phase === "editing" ? "edit" : k === m.independent ? "active" : "locked");
  const mainBtn = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-1.5 py-0.5 text-[11.5px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5] ";
  return (
    <section aria-label="Control panel" className={"flex h-full min-h-0 flex-col rounded-2xl border border-[#E3EAF6] bg-white/90 shadow-[0_2px_10px_rgba(60,90,150,0.07)] " + (dense ? "gap-1 p-2" : "gap-2.5 p-3.5")} data-testid="control-panel" data-phase={phase}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className={"whitespace-nowrap font-bold " + navy + (dense ? " text-[15px]" : " text-[17px]")}>Control panel</h3>
        {phase === "ready" && (
          <button type="button" onClick={onEditBaseline} data-testid="set-initial" className={mainBtn + "border-[#D5DEEF] bg-white text-[#14226B] hover:bg-[#EEF4FF]"} title="Choose the starting values before you begin investigating">
            <Settings2 size={13} aria-hidden="true" /> Set initial conditions
          </button>
        )}
        {phase === "editing" && (
          <button type="button" onClick={onStart} data-testid="start-investigation" className={mainBtn + "border-transparent text-white"} style={{ background: accent.solid }}>
            <Play size={12} aria-hidden="true" /> Start investigation
          </button>
        )}
        {phase === "running" && (
          <button type="button" onClick={onNewInvestigation} data-testid="new-investigation" className={mainBtn + "border-[#D5DEEF] bg-white text-[#14226B] hover:bg-[#EEF4FF]"} title="Return to the starting values and choose new initial conditions">
            <Settings2 size={13} aria-hidden="true" /> New investigation
          </button>
        )}
      </div>
      {phase === "editing" && (
        <p className="rounded-lg bg-[#FFF6DD] px-2 py-1 text-[11px] leading-tight text-[#6B5B20]" data-testid="editing-hint">Set the starting values. Press Start investigation to lock the constant variables.</p>
      )}
      {ORDER.map((k) => (
        <VarBlock key={k} k={k} state={state} role={roleOf(k)} unit={unit} onUnit={onUnit} onChange={onChange} accent={accent} dense={dense} />
      ))}
      <div className={"rounded-xl border border-[#DAE5F7] bg-[#F2F7FF] " + (dense ? "px-2.5 py-0.5" : "px-3 py-2.5") + " mt-auto"} data-testid="relationship-card">
        <h4 className={"font-bold " + navy + (dense ? " text-[12px] leading-tight" : " text-[15px]")}>Current relationship</h4>
        <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <span className={"font-bold italic " + navy + (dense ? " text-[18px]" : " text-[24px]")} data-testid="relation">{m.relation}</span>
          <span className="text-[11.5px] text-[#33415F]">({m.constantText})</span>
        </p>
        <p className={"leading-tight text-[#33415F] " + (dense ? "text-[11px]" : "text-[12px]")}>{m.sentence}</p>
      </div>
    </section>
  );
}
