import { useMemo } from "react";

// Simple representative particles, gently jittered (not literal physics)
// inside a beaker's liquid region — consistent, labelled, colour-coded
// identities. Positions are pseudo-random but STABLE per particle index
// (via a seeded offset), so particles don't visibly teleport on every
// re-render, just settle into a slightly different natural-looking
// arrangement when counts change.
const SPECIES_STYLE = {
  H: { color: "#c23b3b", r: 5, label: "H\u207A" },
  OH: { color: "#2f4bc4", r: 5, label: "OH\u207B" },
  CH3COOH: { color: "#c99a3a", r: 8, label: "HA" },
  CH3COO: { color: "#3a9ac9", r: 8, label: "A\u207B" },
};

function seededOffset(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function BufferParticles({ counts, width = 140, height = 90 }) {
  const particles = useMemo(() => {
    const list = [];
    let seed = 0;
    for (const [species, count] of Object.entries(counts)) {
      for (let i = 0; i < count; i++) {
        seed += 1;
        list.push({
          species,
          x: 10 + seededOffset(seed) * (width - 20),
          y: 10 + seededOffset(seed + 100) * (height - 20),
        });
      }
    }
    return list;
  }, [counts, width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="buffer-particle-layer">
      {particles.map((p, i) => {
        const style = SPECIES_STYLE[p.species];
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={style.r} fill={style.color} opacity="0.85" />
            <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={style.r > 6 ? 7 : 6} fontWeight="700" fill="white">
              {style.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
