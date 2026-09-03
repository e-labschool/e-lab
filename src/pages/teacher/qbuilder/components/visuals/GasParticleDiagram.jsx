// One or more containers with particles distributed inside — reused for
// Avogadro's-law comparisons (same T/P, different volumes), compression
// comparisons (same particles, smaller container), and separation
// comparisons (widely spaced vs closely packed). Simple scientific dots,
// no decorative electron shells, no bonds unless the question needs them
// (none in this batch do).
function seededPositions(count, seed) {
  // deterministic pseudo-random layout so the same data always renders identically
  const positions = [];
  let s = seed * 9301 + 49297;
  for (let i = 0; i < count; i += 1) {
    s = (s * 9301 + 49297) % 233280;
    const rx = s / 233280;
    s = (s * 9301 + 49297) % 233280;
    const ry = s / 233280;
    positions.push({ x: 0.1 + rx * 0.8, y: 0.1 + ry * 0.8 });
  }
  return positions;
}

function OneContainer({ label, relativeSize = 1, particleCount, spread = 0.8, seed }) {
  const size = 40 + relativeSize * 40;
  const positions = seededPositions(particleCount, seed);
  const margin = (1 - spread) / 2;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="text-[var(--color-ink)]" role="img" aria-label={`Container${label ? ` ${label}` : ""} with ${particleCount} gas particles`}>
        <rect x="4" y="4" width="92" height="92" fill="none" stroke="currentColor" strokeWidth="2" />
        {positions.map((p, i) => (
          <circle key={i} cx={4 + (margin + p.x * spread) * 92} cy={4 + (margin + p.y * spread) * 92} r="3.2" fill="currentColor" />
        ))}
      </svg>
      {label && <span className="text-xs font-medium text-[var(--color-ink-soft)]">{label}</span>}
    </div>
  );
}

export default function GasParticleDiagram({ containers }) {
  return (
    <div className="flex flex-wrap items-end gap-6">
      {containers.map((c, i) => (
        <OneContainer key={i} {...c} seed={i + 1} />
      ))}
    </div>
  );
}
