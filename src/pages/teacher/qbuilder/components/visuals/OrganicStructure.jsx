// One data-driven renderer covering skeletal formulas, displayed formulas,
// cis/trans diagrams, and wedge-dash stereochemistry — the same underlying
// atom/bond model as LewisStructure, extended with:
//   - atom.implicit: true hides the circle+label (skeletal-style carbon
//     vertex — the bond lines meeting at that point ARE the vertex);
//     heteroatoms are never implicit, so they're never silently omitted.
//   - bond.style: "wedge" (bold triangle, toward viewer) or "dash"
//     (hashed, away from viewer) for stereochemistry, in addition to the
//     existing order-based single/double/triple line rendering.
const UNIT = 32;

function Bond({ x1, y1, x2, y2, order = 1, style }) {
  if (style === "wedge") {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const w = 4;
    return <polygon points={`${x1},${y1} ${x2 + nx * w},${y2 + ny * w} ${x2 - nx * w},${y2 - ny * w}`} fill="currentColor" />;
  }
  if (style === "dash") {
    const steps = 5;
    const lines = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const w = 1 + t * 3.5;
      const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      lines.push(<line key={i} x1={cx - nx * w} y1={cy - ny * w} x2={cx + nx * w} y2={cy + ny * w} stroke="currentColor" strokeWidth="1" />);
    }
    return <>{lines}</>;
  }
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const offsets = order === 1 ? [0] : order === 2 ? [-2.5, 2.5] : [-4, 0, 4];
  return offsets.map((off, i) => (
    <line key={i} x1={x1 + nx * off} y1={y1 + ny * off} x2={x2 + nx * off} y2={y2 + ny * off} stroke="currentColor" strokeWidth="1.5" />
  ));
}

export default function OrganicStructure({ atoms, bonds, label }) {
  const xs = atoms.map((a) => a.x), ys = atoms.map((a) => a.y);
  const pad = 0.8;
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = (maxX - minX + pad * 2) * UNIT, H = (maxY - minY + pad * 2) * UNIT;
  const px = (x) => (x - minX + pad) * UNIT;
  const py = (y) => (y - minY + pad) * UNIT;

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-xs font-medium text-[var(--color-ink-faint)]">{label}</span>}
      <svg viewBox={`0 0 ${W} ${H}`} className="text-[var(--color-ink)]" style={{ width: Math.min(W, 260) }} role="img" aria-label="Organic structure">
        {bonds.map((b, i) => {
          const a = atoms.find((a) => a.id === b.from), c = atoms.find((a) => a.id === b.to);
          return <Bond key={i} x1={px(a.x)} y1={py(a.y)} x2={px(c.x)} y2={py(c.y)} order={b.order} style={b.style} />;
        })}
        {atoms.filter((a) => !a.implicit).map((atom) => (
          <g key={atom.id}>
            <circle cx={px(atom.x)} cy={py(atom.y)} r="9" fill="var(--color-paper)" />
            <text x={px(atom.x)} y={py(atom.y) + 3.5} fontSize="11" textAnchor="middle" fill="currentColor">{atom.symbol}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
