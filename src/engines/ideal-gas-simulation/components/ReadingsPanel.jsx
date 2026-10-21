import { useEffect, useState } from "react";
import { Info, Pause, Play, RotateCcw } from "lucide-react";
import ComparisonPanel from "./ComparisonPanel.jsx";

const panelBase = "rounded-2xl border border-[#E3EAF6] bg-white/90 shadow-[0_2px_10px_rgba(60,90,150,0.07)] ";

function ValueRow({ label, value, unit, tone, dense }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <dt className="text-[13px] text-[#14226B]">{label}</dt>
      <dd className={"min-w-[92px] rounded-lg px-3 " + (dense ? "py-1" : "py-2") + " text-center text-[16px] font-semibold tabular-nums text-[#14226B] " + tone}>
        {value}{unit ? ` ${unit}` : ""}
      </dd>
    </div>
  );
}

function Toggle({ id, label, checked, onChange, disabled, hint, tip }) {
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
        {tip && <span title={tip} className="cursor-help text-[#8A97B2]"><Info size={13} aria-hidden="true" /></span>}
      </label>
      {hint && <p id={`${id}-hint`} className="ml-[26px] text-[11px] text-[#6B7A99]">{hint}</p>}
    </div>
  );
}

export default function ReadingsPanel({ readings, display, onDisplayChange, playing, onTogglePlay, onReset, dense = false }) {
  const panelCls = panelBase + (dense ? "p-3" : "p-4");
  const headingCls = (dense ? "mb-2 text-[16px]" : "mb-3 text-[17px]") + " font-bold text-[#14226B]";
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
  const btn = dense ? "py-2" : "py-3";
  return (
    <div className={"flex min-h-0 flex-col " + (dense ? "gap-2.5" : "gap-3")}>
      <section aria-label="Live values" className={panelCls + " relative"}>
        <h3 className={headingCls}>Live values</h3>
        <dl className={"flex flex-col " + (dense ? "gap-1.5" : "gap-2")}>
          <ValueRow dense={dense} label="Pressure (P)" value={readings.pressure.toFixed(2)} unit="atm" tone="bg-[#DDF4E2]" />
          <ValueRow dense={dense} label="Volume (V)" value={readings.V.toFixed(1)} unit="L" tone="bg-[#E1EDFD]" />
          <ValueRow dense={dense} label="Temperature (T)" value={readings.T} unit="K" tone="bg-[#FDEFD0]" />
          <ValueRow dense={dense} label="Number of particles (n)" value={readings.N} tone="bg-[#E9E4FB]" />
        </dl>
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      </section>

      {real && <ComparisonPanel comparison={readings.comparison} dense={dense} />}

      <section aria-label="Display options" className={panelCls + " flex flex-col " + (dense ? "gap-1.5" : "gap-2")}>
        <h3 className={headingCls + " !mb-0.5"}>Display options</h3>
        <Toggle id="ig-trails" label="Show particle trails" tip="Displays the paths of moving particles." checked={display.trails} onChange={(v) => onDisplayChange({ trails: v })} />
        <Toggle id="ig-collisions" label="Show collisions (flashes)" tip="Highlights particle-particle and particle-wall collisions." checked={display.collisions} onChange={(v) => onDisplayChange({ collisions: v })} />
        <Toggle
          id="ig-forces"
          label="Show intermolecular forces"
          tip="Shows attractive forces between nearby particles."
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
          className={"flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#2F7BF5] px-2 text-[14px] font-semibold text-white shadow-sm hover:bg-[#2468DB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5] " + btn}
        >
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset simulation to default conditions"
          className={"flex items-center justify-center gap-1.5 rounded-xl border border-[#D5DEEF] bg-white px-2 text-[14px] font-semibold text-[#14226B] hover:bg-[#EEF4FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5] " + btn}
        >
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </button>
      </section>
    </div>
  );
}
