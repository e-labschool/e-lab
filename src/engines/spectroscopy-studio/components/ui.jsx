import { GraduationCap } from "lucide-react";
import { useStudio } from "../state/StudioContext.jsx";

/** A list of live readouts: [{id, label, value, tone, title}]. Compact, no dashboard: a handful of values that matter for the step. */
export function Readouts({ items, ariaLabel = "Live values", testId = "readouts" }) {
  return (
    <dl className="ss-readouts" aria-label={ariaLabel} data-testid={testId}>
      {items.map((it) => (
        <div key={it.id} className={`ss-readout${it.tone ? ` ss-readout--${it.tone}` : ""}`} title={it.title} data-testid={`readout-${it.id}`}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The one prominent slider of a step. ticks: [{at: 0..1, label}] drawn under the track. */
export function BigSlider({ id, label, symbol, value, min, max, step, onChange, badge, valueText, ticks = [], color = "#38bdf8", testId, hint, describedBy }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="ss-bigslider" style={{ "--c": color }} data-testid={testId ? `${testId}-row` : undefined}>
      <div className="ss-bigslider-top">
        <label htmlFor={id} className="ss-bigslider-label">{label}{symbol && <span className="ss-sym"> ({symbol})</span>}</label>
        <output className="ss-bigslider-badge" htmlFor={id} data-testid={testId ? `${testId}-value` : undefined}>{badge}</output>
      </div>
      <input
        id={id} type="range" className="ss-range" min={min} max={max} step={step} value={value} aria-valuetext={valueText ?? badge} aria-describedby={describedBy}
        onChange={(e) => onChange(Number(e.target.value))} style={{ "--fill": `${fill}%` }} data-testid={testId}
      />
      {ticks.length > 0 && (
        <div className="ss-ticks" aria-hidden="true">
          {ticks.map((t) => <span key={t.label} style={{ left: `${t.at * 100}%` }} className={t.at === 0 ? "is-first" : t.at === 1 ? "is-last" : ""}>{t.label}</span>)}
        </div>
      )}
      {hint && <p className="ss-hint" id={describedBy}>{hint}</p>}
    </div>
  );
}

/** "Teacher: deeper explanation" disclosure. Open by default in Teacher mode, closed in Student mode; the viewer can always toggle it. */
export function TeacherDisclosure({ children, title = "Teacher: deeper explanation", testId = "teacher-details" }) {
  const mode = useStudio((s) => s.mode);
  if (!children) return null;
  return (
    <details key={mode} className="ss-teacher" open={mode === "teacher"} data-testid={testId}>
      <summary data-testid={`${testId}-summary`}><GraduationCap size={14} aria-hidden="true" /> {title}</summary>
      <div className="ss-teacher-body">{children}</div>
    </details>
  );
}

/** Small labelled badge drawn over a visual (model label, scale warning ...). tone: "warn" | undefined */
export function Badge({ children, tone, testId, className = "" }) {
  return <p className={`ss-badge ${tone ? `ss-badge--${tone}` : ""} ${className}`} data-testid={testId}>{children}</p>;
}

/** Legend with non-colour cues: [{color, label, shape}] (shape: dot | arrow | bar | ring) */
export function Legend({ items, className = "" }) {
  return (
    <ul className={`ss-legend ${className}`} aria-label="Legend">
      {items.map((it) => <li key={it.label}><span className={`ss-dot ss-dot--${it.shape ?? "dot"}`} style={{ "--c": it.color }} aria-hidden="true" />{it.label}</li>)}
    </ul>
  );
}
