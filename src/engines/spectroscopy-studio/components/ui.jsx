import { useEffect, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import Slot from "./Slot.jsx";
import { useReducedMotion, useStudio } from "../state/StudioContext.jsx";

/** Horizontal activity tabs of a stage (e.g. The proton | Apply the field | RF pulse | Resonance). */
export function ActivityBar({ items, value, onChange, ariaLabel, testIdPrefix = "act" }) {
  const go = (i, d) => { const n = items[(i + d + items.length) % items.length]; onChange(n.id); requestAnimationFrame(() => document.getElementById(`${testIdPrefix}-${n.id}`)?.focus()); };
  return (
    <div className="ss-activities" role="tablist" aria-label={ariaLabel}>
      {items.map((it, i) => (
        <button
          key={it.id} id={`${testIdPrefix}-${it.id}`} type="button" role="tab" aria-selected={it.id === value} tabIndex={it.id === value ? 0 : -1}
          className="ss-activity" data-testid={`${testIdPrefix}-${it.id}`} title={it.title} onClick={() => onChange(it.id)}
          onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); go(i, 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(i, -1); } }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Key numbers: [{id, label, value, unit, tone, title}] */
export function Stats({ items, ariaLabel = "Live values", columns }) {
  return (
    <dl className="ss-stats" aria-label={ariaLabel} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {items.map((it) => (
        <div key={it.id} className={`ss-stat ${it.tone ? `ss-stat--${it.tone}` : ""}`} title={it.title} data-testid={`stat-${it.id}`}>
          <dt>{it.label}</dt>
          <dd>{it.value}{it.unit && <small> {it.unit}</small>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled group of controls (compact card). */
export function Group({ title, children, testId, className = "", aside }) {
  return (
    <section className={`ss-group ${className}`} data-testid={testId} aria-label={title}>
      {(title || aside) && <header className="ss-group-head"><h3>{title}</h3>{aside}</header>}
      {children}
    </section>
  );
}

/** Teacher-mode annotation. Renders nothing in Student mode. */
export function TeacherNote({ title = "Teacher note", children, testId = "teacher-note" }) {
  const mode = useStudio((s) => s.mode);
  if (mode !== "teacher") return null;
  return (
    <aside className="ss-teacher" data-testid={testId}>
      <h4><GraduationCap size={14} aria-hidden="true" /> {title}</h4>
      <div>{children}</div>
    </aside>
  );
}

/** Predict-before-reveal with immediate, accurate feedback and retry. options: [{id, label}]; correct: id; feedback: (id) => string. */
export function PredictBox({ question, options, correct, feedback, testId = "predict-box", onResult }) {
  const [picked, setPicked] = useState(null);
  const ok = picked === correct;
  return (
    <section className="ss-predict" data-testid={testId} aria-label="Prediction">
      <p className="ss-predict-q" id={`${testId}-q`}>{question}</p>
      <div role="radiogroup" aria-labelledby={`${testId}-q`} className="ss-predict-opts">
        {options.map((o) => (
          <button
            key={o.id} type="button" role="radio" aria-checked={picked === o.id} className="ss-chip" data-testid={`${testId}-${o.id}`}
            onClick={() => { setPicked(o.id); onResult?.(o.id === correct); }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className={`ss-predict-fb ${ok ? "is-ok" : "is-no"}`} role="status" data-testid={`${testId}-feedback`}>
          <b>{ok ? "Correct. " : "Not quite. "}</b>{feedback(picked)}
          {!ok && <button type="button" className="ss-link" onClick={() => setPicked(null)} data-testid={`${testId}-retry`}> Try again</button>}
        </p>
      )}
    </section>
  );
}

/** Portal the stage explanation into the dashboard's bottom line. */
export function Explain({ slots, children }) {
  return <Slot target={slots?.explain}><p className="sd-explain-text ss-explain-text" aria-live="polite" aria-atomic="true" data-testid="what-is-happening">{children}</p></Slot>;
}

/** value -> value, eased over `ms` toward `target` (immediate with prefers-reduced-motion). */
export function useTween(target, ms = 900) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reduced || ms <= 0) { cur.current = target; setV(target); return undefined; }
    const from = cur.current; const t0 = performance.now(); let raf = 0; let alive = true;
    const tick = (now) => {
      if (!alive) return;
      const k = Math.min(1, (now - t0) / ms); const e = k * k * (3 - 2 * k);
      cur.current = from + (target - from) * e; setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [target, ms, reduced]);
  return v;
}

/** Legend overlay: [{color, label, shape}] */
export function Legend({ items, className = "" }) {
  return (
    <ul className={`ss-legend ${className}`} aria-label="Legend">
      {items.map((it) => <li key={it.label}><span className={`ss-dot ss-dot--${it.shape ?? "dot"}`} style={{ background: it.color }} aria-hidden="true" />{it.label}</li>)}
    </ul>
  );
}
