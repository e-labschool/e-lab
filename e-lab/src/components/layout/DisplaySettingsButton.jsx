import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, RotateCcw, X } from "lucide-react";
import { useDisplaySettings } from "../../context/DisplaySettingsContext.jsx";

const choices = {
  textSize: [["small","Small"],["default","Default"],["large","Large"],["xl","Extra Large"]],
  contentWidth: [["comfortable","Comfortable"],["wide","Wide"]],
  sideSpacing: [["compact","Small"],["balanced","Balanced"],["roomy","Roomy"]],
  lineSpacing: [["compact","Compact"],["normal","Normal"],["relaxed","Relaxed"]],
  contrast: [["standard","Standard"],["high","High"]],
};

export default function DisplaySettingsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { settings, updateDisplaySettings, resetDisplaySettings } = useDisplaySettings();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);
  return <div className="relative" ref={ref}>
    <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Display settings" aria-expanded={open}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]">
      <SlidersHorizontal size={17}/>
    </button>
    {open && <div role="dialog" aria-label="Display settings" className="absolute right-0 top-11 z-50 w-[310px] rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between"><div><p className="font-semibold text-[var(--color-ink)]">Display Settings</p><p className="text-xs text-[var(--color-ink-faint)]">Saved for this profile</p></div><button onClick={() => setOpen(false)} aria-label="Close"><X size={16}/></button></div>
      {Object.entries(choices).map(([name, opts]) => <fieldset key={name} className="mb-4"><legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{name.replace(/([A-Z])/g," $1")}</legend><div className="flex flex-wrap gap-1.5">{opts.map(([value,label]) => <button type="button" key={value} onClick={() => updateDisplaySettings({[name]:value})} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${settings[name]===value ? "border-[var(--color-indigo)] bg-[var(--color-indigo)] text-white" : "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"}`}>{label}</button>)}</div></fieldset>)}
      <button type="button" onClick={resetDisplaySettings} className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"><RotateCcw size={13}/> Reset to Defaults</button>
    </div>}
  </div>;
}
