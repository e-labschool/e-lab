/** Compact switch rows (View options). `items`: [{ id, label, checked, onChange, title, disabled, testId }] */
export default function ViewOptions({ items, variant = "list" }) {
  return (
    <div className={"vx-options" + (variant === "chips" ? " vx-options--chips" : "")} role="group" aria-label="View options" data-testid="view-options">
      {items.map((o) => (
        <label key={o.id} className={"vx-switch" + (o.disabled ? " is-off" : "")} title={o.title}>
          <input type="checkbox" role="switch" checked={o.checked} disabled={o.disabled} onChange={(e) => o.onChange(e.target.checked)} data-testid={o.testId} />
          <span className="vx-track" aria-hidden="true"><i /></span>
          <span className="vx-switch-text">{o.label}</span>
        </label>
      ))}
    </div>
  );
}
