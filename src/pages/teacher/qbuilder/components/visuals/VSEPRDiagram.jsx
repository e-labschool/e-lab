// Conventional simplified 2D projections of each required VSEPR geometry
// (wedge/dash convention for the tetrahedral family), built from a fixed
// angle table per geometry rather than one bespoke drawing per molecule.
// Also serves as the base for hybridization diagrams (same geometries map
// 1:1 onto sp/sp2/sp3/etc) and DipoleDiagram (reuses these angles for
// arrow direction).
const GEOMETRY_ANGLES = {
  linear: [{ a: 0, wedge: "plain" }, { a: 180, wedge: "plain" }],
  bent: [{ a: -30, wedge: "plain" }, { a: 210, wedge: "plain" }],
  "trigonal-planar": [{ a: -90, wedge: "plain" }, { a: 30, wedge: "plain" }, { a: 150, wedge: "plain" }],
  "trigonal-pyramidal": [{ a: -90, wedge: "wedge" }, { a: 30, wedge: "plain" }, { a: 150, wedge: "plain" }],
  tetrahedral: [{ a: -90, wedge: "wedge" }, { a: 30, wedge: "plain" }, { a: 150, wedge: "plain" }, { a: 90, wedge: "dash" }],
  "trigonal-bipyramidal": [{ a: -90, wedge: "plain" }, { a: 0, wedge: "plain" }, { a: 90, wedge: "plain" }, { a: 180, wedge: "wedge" }, { a: 180 + 45, wedge: "dash" }],
  octahedral: [{ a: -90, wedge: "plain" }, { a: 0, wedge: "plain" }, { a: 90, wedge: "plain" }, { a: 180, wedge: "plain" }, { a: 45, wedge: "wedge" }, { a: 225, wedge: "dash" }],
};

const R = 55;
const CX = 70, CY = 70;

export function domainPositions(geometry) {
  const angles = GEOMETRY_ANGLES[geometry] ?? GEOMETRY_ANGLES.tetrahedral;
  return angles.map(({ a, wedge }) => {
    const rad = (a * Math.PI) / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad), wedge };
  });
}

export default function VSEPRDiagram({ geometry, centralLabel = "A", domains }) {
  const positions = domainPositions(geometry);

  return (
    <svg viewBox="0 0 140 140" className="h-36 w-36 text-[var(--color-ink)]" role="img" aria-label={`${geometry} molecular geometry`}>
      {positions.map((pos, i) => {
        const domain = domains?.[i];
        const isLonePair = domain?.type === "lonePair";
        return (
          <g key={i}>
            <line
              x1={CX} y1={CY} x2={pos.x} y2={pos.y}
              stroke="currentColor"
              strokeWidth={pos.wedge === "wedge" ? 4 : 1.5}
              strokeDasharray={pos.wedge === "dash" ? "3 2" : undefined}
              opacity={isLonePair ? 0.4 : 1}
            />
            {isLonePair ? (
              <>
                <circle cx={pos.x} cy={pos.y - 3} r="1.6" fill="currentColor" />
                <circle cx={pos.x} cy={pos.y + 3} r="1.6" fill="currentColor" />
              </>
            ) : (
              <>
                <circle cx={pos.x} cy={pos.y} r="9" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1" />
                <text x={pos.x} y={pos.y + 3.5} fontSize="9" textAnchor="middle" fill="currentColor">{domain?.label ?? "X"}</text>
              </>
            )}
          </g>
        );
      })}
      <circle cx={CX} cy={CY} r="11" fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="1.5" />
      <text x={CX} y={CY + 4} fontSize="10" textAnchor="middle" fill="currentColor" fontWeight="600">{centralLabel}</text>
    </svg>
  );
}
