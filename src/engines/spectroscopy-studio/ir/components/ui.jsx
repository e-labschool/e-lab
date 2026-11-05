import { Check, CircleSlash } from "lucide-react";

/** A radio group of chip buttons: options [{id, label, sub?, title?}]. Colour is never the only cue: the selected chip also has aria-checked and a heavier border. */
export function ChipGroup({ label, options, value, onChange, testId, className = "", small = false }) {
  return (
    <div className={`ir-chipgroup ${className}`} role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={`sim-btn ss-chipbtn ir-chip${small ? " ir-chip--sm" : ""}`} title={o.title} onClick={() => onChange(o.id)} data-testid={testId ? `${testId}-${o.id}` : undefined} data-active={o.active === undefined ? undefined : o.active ? "1" : "0"}>
          <span className="ir-chip-l">{o.label}</span>{o.sub && <span className="ir-chip-sub">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

/** IR active / inactive badge (text + icon, not only colour) */
export function ActivityPill({ active, size = "md", testId = "activity-pill" }) {
  return (
    <span className={`ir-pill ir-pill--${active ? "on" : "off"} ir-pill--${size}`} data-testid={testId} data-active={active ? "1" : "0"}>
      {active ? <Check size={size === "lg" ? 18 : 14} aria-hidden="true" /> : <CircleSlash size={size === "lg" ? 18 : 14} aria-hidden="true" />}
      {active ? "IR active" : "IR inactive"}
    </span>
  );
}

export const fmtWn = (wn) => `${Math.round(wn).toLocaleString("en-US").replace(",", " ")}`;
export const sci = (x, d = 2) => { const e = Math.floor(Math.log10(Math.abs(x))); const m = x / 10 ** e; return `${m.toFixed(d)}×10${String(e).replace("-", "⁻").replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c])}`; };
