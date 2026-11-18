import { useId } from "react";
import { Info } from "lucide-react";
import { BAG } from "../engine/packetModel.js";
import { atomColour, atomRadius } from "../engine/particles.js";
import { getSubstance } from "../engine/substances.js";
import { AVOGADRO_LINE, ANALOGY_NOTE, amountText } from "../engine/labConfig.js";

/** Quantity buttons: ONE compact row of choices (radio semantics, arrow keys move). */
export function Choice({ label, value, options, onChange, format = (v) => String(v), testId, compact }) {
  const id = useId();
  return (
    <div className={"ml-choice" + (compact ? " is-compact" : "")} role="radiogroup" aria-labelledby={id} data-testid={testId}>
      <span className="ml-choice-label" id={id}>{label}</span>
      <div className="ml-choice-row">
        {options.map((o) => {
          const on = Math.abs(o - value) < 1e-9 || o === value;
          return <button key={o} type="button" role="radio" aria-checked={on} className={"ml-pill" + (on ? " is-on" : "")} onClick={() => onChange(o)} data-testid={testId ? `${testId}-${o}` : undefined}>{format(o)}</button>;
        })}
      </div>
    </div>
  );
}
export const molChoice = (props) => <Choice {...props} format={(v) => (props.fmt ? props.fmt(v) : amountText(v))} />;

/** Compact dropdown with a visible label. */
export function Pick({ label, value, options, onChange, testId, wide }) {
  const id = useId();
  return (
    <label className={"ml-pick" + (wide ? " is-wide" : "")} htmlFor={id}>
      <span className="ml-choice-label">{label}</span>
      <select id={id} className="ml-select" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** The ONE place the Avogadro statement and the counting-analogy note are written. */
export function Reference({ inline }) {
  return (
    <div className={"ml-reference" + (inline ? " is-inline" : "")} data-testid="ml-reference">
      <Info size={16} aria-hidden="true" /><span><b>Reference:</b> {AVOGADRO_LINE}</span>
      <span className="ml-reference-note">{ANALOGY_NOTE}</span>
    </div>
  );
}

/** One concise line + an optional expandable "more" area. */
export function Caption({ line, more, testId = "ml-line" }) {
  return (
    <div className="ml-caption">
      <p className="ml-line" data-testid={testId} aria-live="polite">{line}</p>
      {more && <details className="ml-more" data-testid="ml-more"><summary>Details</summary><div className="ml-more-body">{more}</div></details>}
    </div>
  );
}

/** 2D stand-in used when WebGL is unavailable: the SAME bag outline (identical size), fill = fraction of one mole, exact amount text. */
export function Fallback2D({ items, title, note }) {
  return (
    <div className="ml-fallback" data-testid="ml-fallback" role="group" aria-label={title ?? "Packets (2D view)"}>
      <p className="ml-fallback-note" role="status"><b>3D view unavailable on this device.</b> {note ?? "The packets are shown in 2D; everything else works as usual."}</p>
      <div className="ml-fallback-row">
        {items.map((it, i) => {
          const s = getSubstance(it.substanceId); const fill = Math.min(1, Math.max(0, it.fraction)); const el = Object.keys(s.composition)[0];
          return (
            <figure className={"ml-fb-bag" + (it.ghost ? " is-ghost" : "")} key={i} aria-label={`${s.name} packet, ${it.text}`}>
              <svg viewBox="0 0 80 100" width="76" height={76 * (BAG.height / BAG.width)} aria-hidden="true">
                <defs><clipPath id={`fb-${i}`}><rect x="6" y="6" width="68" height="88" rx="6" /></clipPath></defs>
                <rect x="6" y="6" width="68" height="88" rx="6" className="ml-fb-plastic" />
                <rect x="6" y={94 - 56 * fill - (fill ? 6 : 0)} width="68" height={56 * fill + (fill ? 6 : 0)} clipPath={`url(#fb-${i})`} fill={atomColour(el)} opacity="0.85" />
                <rect x="6" y="6" width="68" height="88" rx="6" className="ml-fb-outline" />
                <rect x="6" y="18" width="68" height="2.6" fill="#e5313d" /><rect x="6" y="21.4" width="68" height="2.6" fill="#2f6ee0" />
              </svg>
              <figcaption><b>{it.formula}</b><span>{it.text}</span></figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
export { atomRadius };
