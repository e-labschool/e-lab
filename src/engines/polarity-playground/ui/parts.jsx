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
