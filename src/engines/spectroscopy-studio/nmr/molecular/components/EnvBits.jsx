import { EnvBadge } from "./SpectrumPlot.jsx";

/** Small coloured + lettered + shaped marker of an environment (the letter and the shape are the non-colour cues). */
export function EnvMark({ env, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true" className="nm-envmark"><EnvBadge env={env} r={9} /></svg>
  );
}

/** One environment as a toggle chip: [mark] label · count. Unidentified environments (student mode) show "?" until identified. */
export function EnvChip({ env, selected, identified = true, coupled = false, onClick, showShift = false, testId, title }) {
  return (
    <button type="button" className={`sim-btn nm-chip${coupled ? " is-coupled" : ""}`} aria-pressed={selected} onClick={onClick} data-testid={testId ?? `env-chip-${env.id}`} data-env={env.id} data-identified={identified ? "1" : "0"} title={title}
      style={selected || coupled ? { borderColor: env.color, boxShadow: `0 0 0 2px ${env.color}55` } : undefined}>
      {identified ? <EnvMark env={env} size={18} /> : <span className="nm-chip-q" aria-hidden="true">?</span>}
      <span className="nm-chip-label">{identified ? env.label : "Unidentified"}</span>
      {identified && <span className="nm-chip-count">{env.count} H</span>}
      {identified && showShift && <span className="nm-chip-shift">{env.delta.toFixed(1)}</span>}
      {coupled && <span className="nm-chip-tag">neighbour</span>}
    </button>
  );
}
