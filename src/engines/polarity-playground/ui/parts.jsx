// Small shared controls (all keyboard operable; native inputs / buttons).
export function Pills({ options, value, onChange, ariaLabel, testId, size = "md" }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`pp-pills pp-pills--${size}`} data-testid={testId}>
      {options.map((o, i) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} tabIndex={value === o.id ? 0 : -1} className={"pp-pill" + (value === o.id ? " is-on" : "")} data-testid={o.testId ?? `${testId}-${o.id}`} title={o.title}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => { const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0; if (!d) return; e.preventDefault(); const n = options[(i + d + options.length) % options.length]; onChange(n.id); requestAnimationFrame(() => document.querySelector(`[data-testid="${n.testId ?? `${testId}-${n.id}`}"]`)?.focus()); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
export const Card = ({ title, children, className = "", testId, aside }) => (
  <section className={`pp-card ${className}`} data-testid={testId} aria-label={typeof title === "string" ? title : undefined}>
    {(title || aside) && <header className="pp-card-head">{title && <h3>{title}</h3>}{aside}</header>}
    {children}
  </section>
);
export const Row = ({ label, children, testId }) => (<div className="pp-row"><span className="pp-row-l">{label}</span><span className="pp-row-v" data-testid={testId}>{children}</span></div>);
export const Key = () => (
  <ul className="pp-key" aria-label="Colour key" data-testid="colour-key">
    <li><i className="pp-sw pp-sw--density" aria-hidden="true" />Teal = electron density (deeper = more concentrated). Not charge.</li>
    <li><i className="pp-sw pp-sw--plus" aria-hidden="true" />δ+ blue, <i className="pp-sw pp-sw--minus" aria-hidden="true" />δ− red = partial charge.</li>
  </ul>
);

/** Rough dEN guide: non-polar -> polar -> ionic character. Marker position = |dEN| on a 0..3.4 axis. A guide only (IB uses the bonding triangle); no sharp boundary is implied. */
export const SCALE_MAX = 3.4;
export function EnScale({ dEN, show = true, testId = "en-scale" }) {
  const d = Math.min(SCALE_MAX, Math.abs(dEN ?? 0)); const pct = (d / SCALE_MAX) * 100;
  const zone = d < 0.4 ? "non-polar covalent" : d <= 1.8 ? "polar covalent" : "ionic character";
  return (
    <div className="pp-scale" data-testid={testId} role="img" aria-label={show ? `ΔEN ${d.toFixed(2)}: in the ${zone} region of a rough guide` : "ΔEN scale"}>
      <div className="pp-scale-bar" aria-hidden="true"><i className="z1" style={{ width: `${(0.4 / SCALE_MAX) * 100}%` }} /><i className="z2" style={{ width: `${(1.4 / SCALE_MAX) * 100}%` }} /><i className="z3" style={{ width: `${((SCALE_MAX - 1.8) / SCALE_MAX) * 100}%` }} />
        {show && <b className="pp-scale-mark" style={{ left: `${pct}%` }} data-testid={`${testId}-marker`} data-pct={pct.toFixed(1)} />}</div>
      <div className="pp-scale-lab" aria-hidden="true"><span>Non-polar</span><span>Polar</span><span>Ionic</span></div>
      <p className="pp-scale-note">ΔEN rough guide only: the change is gradual, not a sharp line (IB uses the bonding triangle).</p>
    </div>
  );
}
