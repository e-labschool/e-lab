import { LIMITS } from "../model.js";

const panelCls = "rounded-2xl border border-[#E3EAF6] bg-white/90 p-4 shadow-[0_2px_10px_rgba(60,90,150,0.07)]";
const titleCls = "text-[16px] font-bold text-[#14226B]";

function GasTypeToggle({ mode, onChange }) {
  const opts = [
    { id: "ideal", label: "Ideal gas" },
    { id: "real", label: "Real gas" },
  ];
  return (
    <div role="radiogroup" aria-label="Gas type" className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl bg-[#EDF3FD] p-0.5">
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
              "rounded-[10px] px-2 py-2.5 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5] " +
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

function SliderField({ id, label, unit, value, min, max, step, onChange, valueText, color, chip }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="mt-4">
      <label htmlFor={id} className={titleCls}>{label}</label>
      <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div>
          <input
            id={id}
            type="range"
            className="ig-range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-valuetext={valueText}
            style={{ "--ig-color": color, "--ig-fill": `${fill}%` }}
          />
          <div className="mt-0.5 flex justify-between text-[12px] text-[#33415F]" aria-hidden="true">
            <span>{min}{unit ? ` ${unit}` : ""}</span>
            <span>{max}{unit ? ` ${unit}` : ""}</span>
          </div>
        </div>
        <span className={"min-w-[58px] rounded-lg px-2.5 py-1.5 text-center text-[15px] font-semibold tabular-nums text-[#14226B] " + chip} aria-hidden="true">
          {value}{unit ? ` ${unit}` : ""}
        </span>
      </div>
    </div>
  );
}

export default function ControlsPanel({ controls, onChange }) {
  return (
    <section aria-label="Controls" className={panelCls}>
      <h3 className={titleCls}>Gas type</h3>
      <GasTypeToggle mode={controls.mode} onChange={(mode) => onChange({ mode })} />
      <SliderField
        id="ig-particles" label="Number of particles (n)" value={controls.N} {...LIMITS.N}
        onChange={(N) => onChange({ N })} valueText={`${controls.N} particles`} color="#2F7BF5" chip="bg-[#E1EDFD]"
      />
      <SliderField
        id="ig-temperature" label="Temperature (T)" unit="K" value={controls.T} {...LIMITS.T}
        onChange={(T) => onChange({ T })} valueText={`${controls.T} kelvin`} color="#F5A50B" chip="bg-[#FDEFD0]"
      />
      <SliderField
        id="ig-volume" label="Volume (V)" unit="L" value={controls.V} {...LIMITS.V}
        onChange={(V) => onChange({ V })} valueText={`${controls.V} litres`} color="#34C256" chip="bg-[#DFF5E4]"
      />
    </section>
  );
}
