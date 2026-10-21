import { CircleHelp, Info, Lock } from "lucide-react";
import { LIMITS } from "../model.js";

const titleCls = "text-[16px] font-bold text-[#14226B]";

const GAS_DESCRIPTIONS = {
  ideal: "Particles have negligible volume, no intermolecular forces and elastic collisions.",
  real: "Particles have finite size and experience intermolecular forces.",
};

function GasTypeToggle({ mode, onChange, dense }) {
  const opts = [
    { id: "ideal", label: "Ideal gas" },
    { id: "real", label: "Real gas" },
  ];
  return (
    <div role="radiogroup" aria-label="Gas type" className={(dense ? "mt-2 " : "mt-3 ") + "grid grid-cols-2 overflow-hidden rounded-xl bg-[#EDF3FD] p-0.5"}>
      {opts.map((o) => {
        const selected = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); onChange("real"); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); onChange("ideal"); }
            }}
            tabIndex={selected ? 0 : -1}
            className={
              "rounded-[10px] px-2 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5] " +
              (dense ? "py-1.5 " : "py-2.5 ") +
              (selected ? "bg-[#2F7BF5] text-white shadow-sm" : "text-[#14226B] hover:bg-white/70")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SliderField({ id, label, unit, value, min, max, step, onChange, valueText, color, chip, chipText, desc, descId, readOnly, dense, descTone, help }) {
  const fill = ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  const chipEl = (
    <span className={"min-w-[56px] rounded-lg px-2 text-center text-[15px] font-semibold tabular-nums text-[#14226B] " + (dense ? "py-0.5 " : "py-1.5 ") + chip} aria-hidden="true">
      {chipText ?? `${value}${unit ? ` ${unit}` : ""}`}
    </span>
  );
  const rangeLabels = (
    <div className="flex justify-between text-[11px] leading-none text-[#33415F]" aria-hidden="true">
      <span>{min}{unit ? ` ${unit}` : ""}</span>
      <span>{max}{unit ? ` ${unit}` : ""}</span>
    </div>
  );
  const input = (
    <input
      id={id}
      type="range"
      className={"ig-range" + (dense ? " ig-range-dense" : "")}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={readOnly}
      aria-readonly={readOnly || undefined}
      aria-describedby={descId}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-valuetext={valueText}
      style={{ "--ig-color": color, "--ig-fill": `${fill}%` }}
    />
  );
  return (
    <div className={dense ? "mt-1.5" : "mt-4"}>
      {dense ? (
        // Compact layout (viewport modes): label, range and value chip share one row.
        <>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={id} className={titleCls + " whitespace-nowrap text-[14px] leading-tight"}>{label}</label>
            {chipEl}
          </div>
          {input}
          <div className="flex justify-between text-[10px] leading-none text-[#6B7A99]" aria-hidden="true">
            <span>{min}{unit ? ` ${unit}` : ""}</span>
            <span>{max}{unit ? ` ${unit}` : ""}</span>
          </div>
        </>
      ) : (
        <>
          <label htmlFor={id} className={titleCls}>{label}</label>
          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div>{input}{rangeLabels}</div>
            {chipEl}
          </div>
        </>
      )}
      <p id={descId} className={"mt-0.5 leading-tight " + (dense ? "text-[10.5px] " : "text-[11px] ") + (descTone || "text-[#6B7A99]")}>
        {desc}
        {help && <CircleHelp size={11} className="ml-1 inline align-[-1px] text-[#8A97B2]" aria-hidden="true" />}
      </p>
    </div>
  );
}

function ControlModeCard({ control, onChange, dense }) {
  const opts = [
    { id: "volume", label: "Volume" },
    { id: "pressure", label: "Pressure" },
  ];
  const sub = control === "volume"
    ? "Pressure is calculated automatically from n, T and V."
    : "The piston moves to reach the target pressure; volume is calculated.";
  return (
    <div className={"rounded-xl border border-[#DAE5F7] bg-white/70 " + (dense ? "mt-2 px-2.5 py-1.5" : "mt-4 px-3 py-2.5")}>
      <div className="flex items-center gap-2">
        <Lock size={14} className="shrink-0 text-[#14226B]" aria-hidden="true" />
        <span id="ig-control-label" className="shrink-0 text-[13px] font-bold text-[#14226B]">Control:</span>
        <div role="radiogroup" aria-labelledby="ig-control-label" className="grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-lg bg-[#EDF3FD] p-0.5">
          {opts.map((o) => {
            const selected = control === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                title={o.id === "volume" ? "You set the volume; pressure is calculated" : "You set the target pressure; volume is calculated"}
                onClick={() => onChange(o.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); onChange("pressure"); }
                  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); onChange("volume"); }
                }}
                className={
                  "rounded-md px-1.5 py-1 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F7BF5] " +
                  (selected ? "bg-[#2F7BF5] text-white shadow-sm" : "text-[#14226B] hover:bg-white/70")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className={"mt-0.5 leading-tight text-[#6B7A99] " + (dense ? "text-[10.5px]" : "text-[11px]")}>{sub}</p>
    </div>
  );
}

export default function ControlsPanel({ controls, state, onChange, dense = false }) {
  const pressureMode = controls.control === "pressure";
  const targetP = state.pTarget ?? state.pressure;
  const pValue = pressureMode ? controls.P : Math.min(LIMITS.P.max, Math.max(LIMITS.P.min, state.pressure));
  const pChip = pressureMode ? `${targetP.toFixed(2)} atm` : `${state.pressure.toFixed(2)} atm`;
  const note = pressureMode ? state.note : null;
  const panel = "rounded-2xl border border-[#E3EAF6] bg-white/90 shadow-[0_2px_10px_rgba(60,90,150,0.07)] " + (dense ? "p-2.5" : "p-4");
  return (
    <section aria-label="Controls" className={panel}>
      <h3 className={titleCls}>Gas type</h3>
      <GasTypeToggle mode={controls.mode} onChange={(mode) => onChange({ mode })} dense={dense} />
      <p
        className={"flex items-start gap-1.5 rounded-lg bg-[#EAF2FE] px-2 " + (dense ? "py-1 mt-1.5 text-[10.5px]" : "py-1.5 mt-2 text-[12px]") + " leading-snug text-[#14226B]"}
        data-testid="gas-description"
      >
        <Info size={14} className="mt-px shrink-0 text-[#2F7BF5]" aria-hidden="true" />
        <span>
          <strong>{controls.mode === "real" ? "Real gas" : "Ideal gas"}:</strong> {GAS_DESCRIPTIONS[controls.mode]}
        </span>
      </p>
      <SliderField
        id="ig-particles" label="Number of particles (n)" value={controls.N} {...LIMITS.N} dense={dense}
        onChange={(N) => onChange({ N })} valueText={`${controls.N} particles`} color="#2F7BF5" chip="bg-[#E1EDFD]"
        desc="Changes the amount of gas inside the container." descId="ig-particles-desc"
      />
      <SliderField
        id="ig-temperature" label="Temperature (T)" unit="K" value={controls.T} {...LIMITS.T} dense={dense}
        onChange={(T) => onChange({ T })} valueText={`${controls.T} kelvin`} color="#F5A50B" chip="bg-[#FDEFD0]"
        desc="Higher temperature increases average particle kinetic energy." descId="ig-temperature-desc"
      />
      <SliderField
        id="ig-volume" label="Volume (V)" unit="L" value={pressureMode ? state.V : controls.V} {...LIMITS.V} dense={dense}
        readOnly={pressureMode}
        chipText={pressureMode ? `${state.V.toFixed(1)} L` : undefined}
        onChange={(V) => onChange({ V })} valueText={`${(pressureMode ? state.V : controls.V).toFixed(1)} litres${pressureMode ? ", calculated" : ""}`}
        color="#34C256" chip="bg-[#DFF5E4]"
        desc={"Changes the space available to the gas by moving the piston." + (pressureMode ? " (calculated)" : "")} descId="ig-volume-desc"
      />
      <SliderField
        id="ig-pressure" label="Pressure (P)" unit="atm" value={pValue} {...LIMITS.P} dense={dense}
        readOnly={!pressureMode}
        chipText={pChip}
        onChange={(P) => onChange({ P })} valueText={`${(pressureMode ? targetP : state.pressure).toFixed(2)} atmospheres${pressureMode ? ", target" : ", calculated"}`}
        color="#8B5CF6" chip="bg-[#EBE4FC]"
        desc={note || "Sets the target pressure; the piston adjusts the volume." }
        descTone={note ? "text-[#9A5B00]" : undefined}
        descId="ig-pressure-desc" help
      />
      <ControlModeCard control={controls.control} onChange={(control) => onChange({ control })} dense={dense} />
    </section>
  );
}
