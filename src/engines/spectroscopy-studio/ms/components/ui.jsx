import { useEffect, useRef, useState } from "react";

/** A radio group of chip buttons: options [{id, label, sub?, title?}]. Colour is never the only cue: the selected chip also has aria-checked and a heavier border. */
export function ChipGroup({ label, options, value, onChange, testId, className = "", small = false }) {
  return (
    <div className={`ms-chipgroup ${className}`} role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={`sim-btn ss-chipbtn ms-chip${small ? " ms-chip--sm" : ""}`} title={o.title} disabled={o.disabled}
          onClick={() => onChange(o.id)} data-testid={testId ? `${testId}-${o.id}` : undefined}>
          <span className="ms-chip-l">{o.label}</span>{o.sub && <span className="ms-chip-sub">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

/** Measure an element and return [ref, {w, h}] with a fallback size where there is no layout (jsdom), so scenes still render their content. */
export function useBox(fallback = { w: 800, h: 450 }) {
  const [el, setEl] = useState(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); const w = Math.round(r.width); const h = Math.round(r.height); setSize((s) => (s.w === w && s.h === h ? s : { w, h })); };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null; ro?.observe(el);
    return () => ro?.disconnect();
  }, [el]);
  return [setEl, size.w > 0 && size.h > 0 ? size : fallback, size.w > 0];
}

/** A box that measures itself and gives its children the pixel size: <Scene>{({w, h}) => <svg .../>}</Scene> */
export function Scene({ children, className = "", testId, fallback }) {
  const [ref, size] = useBox(fallback);
  return <div ref={ref} className={`ms-scene ${className}`} data-testid={testId}>{children(size)}</div>;
}

/** Equation line with the term that is "now" highlighted: parts [{t, on}] */
export function Equation({ parts, testId = "equation", className = "", ariaLabel }) {
  return <p className={`ms-eq ${className}`} data-testid={testId} aria-label={ariaLabel ?? parts.map((p) => (typeof p.t === "string" ? p.t : "")).join(" ")}>{parts.map((p, i) => <span key={i} className={p.on === false ? "is-dim" : p.on ? "is-on" : ""}>{p.t}</span>)}</p>;
}

/** Keeps a value stable between renders but lets it be read in event handlers */
export function useLatest(v) { const r = useRef(v); r.current = v; return r; }

export const PALETTE = ["#2dd4bf", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#38bdf8"];
export const ION_COLOR = "#fb923c"; // positive ions
export const ELECTRON_COLOR = "#38bdf8";
export const NEUTRAL_COLOR = "#c7d2ea";
export const sup = (n) => String(n).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);
