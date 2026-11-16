import { useEffect, useId, useState } from "react";
import { parseNumber } from "../../lib/gas/gasUnits.js";
import "./number-field.css";

/**
 * Compact typed-value field with a unit, for exact values a slider cannot hit (273.15 K, 100 kPa ...).
 * The value is shown in the CALLER's display unit. Enter or leaving the field commits it; Escape reverts.
 * Nothing is ever clamped silently: out-of-range or unreadable input reports why through `onNotice(text|null)`.
 *   value, min, max, decimals, unit, label (accessible name), onCommit(number), onNotice(text|null)
 */
export default function NumberField({ value, min, max, decimals = 1, unit, label, onCommit, onNotice, testId, width = 74 }) {
  const id = useId();
  const show = (v) => (Number.isFinite(v) ? Number(v.toFixed(decimals)).toString() : "");
  const [text, setText] = useState(show(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(show(value)); }, [value, editing, decimals]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    setEditing(false);
    const v = parseNumber(text);
    if (v === null) { onNotice?.(`"${text}" is not a number. Value stays ${show(value)} ${unit}.`); setText(show(value)); return; }
    if (v < min - 1e-9 || v > max + 1e-9) {
      const c = Math.min(max, Math.max(min, v));
      onNotice?.(`${show(v)} ${unit} is outside the range ${show(min)} to ${show(max)} ${unit} for this investigation, so ${show(c)} ${unit} was used.`);
      onCommit?.(c);
      setText(show(c));
      return;
    }
    onNotice?.(null);
    onCommit?.(v);
    setText(show(v));
  };
  return (
    <span className="nf-wrap">
      <label htmlFor={id} className="nf-sr">{label}</label>
      <input
        id={id} type="text" inputMode="decimal" className="nf-input" style={{ width }} value={text} autoComplete="off" spellCheck="false"
        onFocus={(e) => { setEditing(true); e.target.select(); }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { setText(show(value)); setEditing(false); onNotice?.(null); e.currentTarget.blur(); }
        }}
        data-testid={testId}
        aria-label={`${label} (${unit}), type a value from ${show(min)} to ${show(max)} and press Enter`}
      />
      <span className="nf-unit" aria-hidden="true">{unit}</span>
    </span>
  );
}
