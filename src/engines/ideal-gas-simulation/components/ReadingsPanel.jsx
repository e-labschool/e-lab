import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

const panelCls = "rounded-2xl border border-[#E3EAF6] bg-white/90 p-4 shadow-[0_2px_10px_rgba(60,90,150,0.07)]";
const headingCls = "mb-3 text-[17px] font-bold text-[#14226B]";

function ValueRow({ label, value, unit, tone }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <dt className="text-[13px] text-[#14226B]">{label}</dt>
      <dd className={"min-w-[92px] rounded-lg px-3 py-2 text-center text-[16px] font-semibold tabular-nums text-[#14226B] " + tone}>
        {value}{unit ? ` ${unit}` : ""}
      </dd>
    </div>
  );
}

const LEVEL_TONE = {
  Low: "bg-[#E4F5E8] text-[#1F6B3A] border-[#BFE5C9]",
  Moderate: "bg-[#FFF1C9] text-[#7A5600] border-[#EBD58D]",
  High: "bg-[#FBE3E0] text-[#9B2F24] border-[#F0BDB6]",
};

function Toggle({ id, label, checked, onChange, disabled, hint }) {
  return (
    <div>
      <label htmlFor={id} className={"flex items-center gap-2.5 text-[13px] " + (disabled ? "cursor-not-allowed text-[#7C8AA8]" : "cursor-pointer text-[#14226B]")}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-[#2F7BF5]"
        />
        <span>{label}</span>
      </label>
      {hint && <p id={`${id}-hint`} className="ml-[26px] text-[11px] text-[#6B7A99]">{hint}</p>}
    </div>
  );
}

export default function ReadingsPanel({ readings, display, onDisplayChange, playing, onTogglePlay, onReset }) {
  // Debounced plain-language summary for screen readers (the visible numbers
  // change continuously while a slider is dragged; announcing each would spam).
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounce(
        `Pressure ${readings.pressure.toFixed(2)} atmospheres at ${readings.T} kelvin, ${readings.V} litres, ${readings.N} particles.`
      );
    }, 700);
    return () => clearTimeout(t);
  }, [readings.pressure, readings.T, readings.V, readings.N]);

  const real = readings.mode === "real";
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <section aria-label="Live values" className={panelCls + " relative"}>
        <h3 className={headingCls}>Live values</h3>
        <dl className="flex flex-col gap-2">
          <ValueRow label="Pressure (P)" value={readings.pressure.toFixed(2)} unit="atm" tone="bg-[#DDF4E2]" />
          <ValueRow label="Volume (V)" value={readings.V.toFixed(1)} unit="L" tone="bg-[#E1EDFD]" />
          <ValueRow label="Temperature (T)" value={readings.T} unit="K" tone="bg-[#FDEFD0]" />
          <ValueRow label="Number of particles (n)" value={readings.N} tone="bg-[#E9E4FB]" />
        </dl>
        {real && (
          <p
            className={"mt-2.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium " + LEVEL_TONE[readings.deviationLevel]}
            title={`Real vs ideal pressure: ${readings.deviationPct.toFixed(1)}% difference`}
          >
            Deviation from ideal behaviour: <strong>{readings.deviationLevel}</strong>
            <span className="ml-1 font-normal opacity-80 tabular-nums">({readings.deviationPct.toFixed(1)}%)</span>
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      </section>

      <section aria-label="Display options" className={panelCls + " flex flex-col gap-2"}>
        <h3 className={headingCls + " !mb-1"}>Display options</h3>
        <Toggle id="ig-trails" label="Show particle trails" checked={display.trails} onChange={(v) => onDisplayChange({ trails: v })} />
        <Toggle id="ig-collisions" label="Show collisions (flashes)" checked={display.collisions} onChange={(v) => onDisplayChange({ collisions: v })} />
        <Toggle
          id="ig-forces"
          label="Show intermolecular forces"
          checked={display.forces && real}
          disabled={!real}
          hint={real ? undefined : "Available in Real Gas mode"}
          onChange={(v) => onDisplayChange({ forces: v })}
        />
      </section>

      <section aria-label="Playback controls" className="grid grid-cols-[1.35fr_1fr] gap-2">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Pause simulation" : "Play simulation"}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#2F7BF5] px-2 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#2468DB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5]"
        >
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          Play / Pause
        </button>
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset simulation to default conditions"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D5DEEF] bg-white px-2 py-3 text-[14px] font-semibold text-[#14226B] hover:bg-[#EEF4FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5]"
        >
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </button>
      </section>
    </div>
  );
}
