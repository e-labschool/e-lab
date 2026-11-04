// The van-Arkel/bonding triangle, qualitative only (no percentage-ionic-
// character calculation required, per the brief) — substances are placed
// near a named region rather than at a computed coordinate.
const REGION_POS = {
  ionic: { x: 50, y: 20 },
  covalent: { x: 20, y: 90 },
  metallic: { x: 80, y: 90 },
  center: { x: 50, y: 65 },
};

export default function BondingTriangle({ markers = [] }) {
  return (
    <svg viewBox="0 0 100 100" className="h-40 w-40 text-[var(--color-ink)]" role="img" aria-label="Bonding triangle">
      <polygon points="50,10 15,95 85,95" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <text x="50" y="8" fontSize="7" textAnchor="middle" fill="currentColor">Ionic</text>
      <text x="12" y="98" fontSize="7" textAnchor="start" fill="currentColor">Covalent</text>
      <text x="88" y="98" fontSize="7" textAnchor="end" fill="currentColor">Metallic</text>
      {markers.map((m, i) => {
        const pos = REGION_POS[m.region] ?? REGION_POS.center;
        return (
          <g key={i}>
            <circle cx={pos.x} cy={pos.y} r="3" fill="var(--color-amber)" />
            <text x={pos.x} y={pos.y - 5} fontSize="7" textAnchor="middle" fill="var(--color-amber)">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
