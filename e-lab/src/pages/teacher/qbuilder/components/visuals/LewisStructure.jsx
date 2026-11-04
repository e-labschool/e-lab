// A genuinely general Lewis structure renderer: atoms at given grid
// coordinates, bonds of order 1/2/3 (drawn as parallel lines), lone pairs
// (placed heuristically in the compass directions not occupied by a bond),
// formal charges, and an optional overall-charge bracket for ions. Also the
// base for ResonanceStructure (two or more of these side by side).
const UNIT = 40;

export default function LewisStructure({ atoms, bonds, overallCharge, label }) {
  const xs = atoms.map((a) => a.x);
  const ys = atoms.map((a) => a.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 1.5;
  const W = (maxX - minX + pad * 2) * UNIT;
  const H = (maxY - minY + pad * 2) * UNIT;
  const px = (x) => (x - minX + pad) * UNIT;
  const py = (y) => (y - minY + pad) * UNIT;

  function bondLines(bond) {
    const a = atoms.find((a) => a.id === bond.from);
    const b = atoms.find((a) => a.id === bond.to);
    const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len; // perpendicular unit vector
    const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-3, 3] : [-5, 0, 5];
    return offsets.map((off, i) => (
      <line
        key={i}
        x1={x1 + nx * off} y1={y1 + ny * off}
        x2={x2 + nx * off} y2={y2 + ny * off}
        stroke="currentColor" strokeWidth={bond.coordinate ? 0 : 1.5}
        markerEnd={bond.coordinate && i === 0 ? "url(#arrowhead)" : undefined}
      />
    ));
  }

  function lonePairDots(atom) {
    const bondedDirs = bonds
      .filter((b) => b.from === atom.id || b.to === atom.id)
      .map((b) => {
        const other = atoms.find((a) => a.id === (b.from === atom.id ? b.to : b.from));
        const dx = other.x - atom.x, dy = other.y - atom.y;
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "E" : "W";
        return dy > 0 ? "S" : "N";
      });
    const allDirs = ["N", "E", "S", "W"];
    const free = allDirs.filter((d) => !bondedDirs.includes(d));
    const slots = [...free, ...allDirs].slice(0, atom.lonePairs || 0);
    const offset = { N: [0, -14], E: [14, 0], S: [0, 14], W: [-14, 0] };
    const dotOffset = { N: [-3, 0], E: [0, -3], S: [-3, 0], W: [0, -3] };
    return slots.map((dir, i) => {
      const [ox, oy] = offset[dir];
      const [dxo, dyo] = dotOffset[dir];
      const cx = px(atom.x) + ox, cy = py(atom.y) + oy;
      return (
        <g key={i}>
          <circle cx={cx - dxo} cy={cy - dyo} r="1.4" fill="currentColor" />
          <circle cx={cx + dxo} cy={cy + dyo} r="1.4" fill="currentColor" />
        </g>
      );
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-xs font-medium text-[var(--color-ink-faint)]">{label}</span>}
      <svg viewBox={overallCharge ? `-14 -6 ${W + 28} ${H + 12}` : `0 0 ${W} ${H}`} className="text-[var(--color-ink)]" style={{ width: Math.min(W + (overallCharge ? 28 : 0), 220) }} role="img" aria-label="Lewis structure">
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
          </marker>
        </defs>
        {overallCharge && (
          <>
            <path d={`M -8 -2 L -12 -2 L -12 ${H + 2} L -8 ${H + 2}`} fill="none" stroke="currentColor" strokeWidth="1.25" />
            <path d={`M ${W + 8} -2 L ${W + 12} -2 L ${W + 12} ${H + 2} L ${W + 8} ${H + 2}`} fill="none" stroke="currentColor" strokeWidth="1.25" />
            <text x={W + 15} y={2} fontSize="10" fill="currentColor">{overallCharge}</text>
          </>
        )}
        {bonds.map((b, i) => <g key={i}>{bondLines(b)}</g>)}
        {atoms.map((atom) => (
          <g key={atom.id}>
            {lonePairDots(atom)}
            <circle cx={px(atom.x)} cy={py(atom.y)} r="11" fill="var(--color-paper)" />
            <text x={px(atom.x)} y={py(atom.y) + 4} fontSize="13" textAnchor="middle" fill="currentColor">{atom.symbol}</text>
            {atom.formalCharge && (
              <text x={px(atom.x) + 10} y={py(atom.y) - 8} fontSize="8" fill="currentColor">{atom.formalCharge}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
