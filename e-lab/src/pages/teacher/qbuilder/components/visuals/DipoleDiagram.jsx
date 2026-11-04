import { domainPositions } from "./VSEPRDiagram.jsx";

// Reuses VSEPRDiagram's angle table so a molecule's dipole arrows point in
// exactly the same directions its bonds are drawn — then overlays either a
// summed net-dipole arrow or a "no net dipole" label for symmetric cases.
export default function DipoleDiagram({ geometry, centralLabel = "A", bondLabels = [], netDipole = "present" }) {
  const positions = domainPositions(geometry).filter((_, i) => bondLabels[i] !== null);
  const CX = 70, CY = 70;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 text-[var(--color-ink)]" role="img" aria-label={`Bond dipoles for ${geometry} molecule`}>
        <defs>
          <marker id="dipole-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--color-amber)" />
          </marker>
        </defs>
        {positions.map((pos, i) => (
          <g key={i}>
            <line x1={CX} y1={CY} x2={pos.x} y2={pos.y} stroke="currentColor" strokeWidth="1.25" opacity="0.5" />
            <line
              x1={CX + (pos.x - CX) * 0.3} y1={CY + (pos.y - CY) * 0.3}
              x2={CX + (pos.x - CX) * 0.85} y2={CY + (pos.y - CY) * 0.85}
              stroke="var(--color-amber)" strokeWidth="1.75" markerEnd="url(#dipole-arrow)"
            />
            <circle cx={pos.x} cy={pos.y} r="8" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1" />
            <text x={pos.x} y={pos.y + 3} fontSize="8" textAnchor="middle" fill="currentColor">{bondLabels[i]}</text>
          </g>
        ))}
        <circle cx={CX} cy={CY} r="10" fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="1.5" />
        <text x={CX} y={CY + 3.5} fontSize="9" textAnchor="middle" fill="currentColor" fontWeight="600">{centralLabel}</text>
      </svg>
      <span className="text-xs font-medium" style={{ color: netDipole === "present" ? "var(--color-amber)" : "var(--color-ink-faint)" }}>
        {netDipole === "present" ? "Net molecular dipole" : "Dipoles cancel \u2014 no net dipole"}
      </span>
    </div>
  );
}
