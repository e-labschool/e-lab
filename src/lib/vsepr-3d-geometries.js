// Real 3D domain positions (unit vectors) for each electron-domain count.
// "Bent" and "trigonal pyramidal" are not separate vector sets — chemically
// they ARE tetrahedral electron-domain arrangements where 1 or 2 domains
// happen to be lone pairs rather than bonds, exactly like the existing 2D
// VSEPRDiagram already models it. This file only defines domain-count
// geometries; which domains are bonds vs lone pairs is per-question data,
// not baked into the geometry itself.

export const DOMAIN_POSITIONS = {
  2: [ // linear
    [1, 0, 0], [-1, 0, 0],
  ],
  3: [ // trigonal planar
    [1, 0, 0], [-0.5, 0.8660254, 0], [-0.5, -0.8660254, 0],
  ],
  4: [ // tetrahedral — also the basis for bent (2 bonds) and trigonal pyramidal (3 bonds)
    [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
  ].map((v) => normalize(v)),
  5: [ // trigonal bipyramidal — 2 axial + 3 equatorial
    [0, 0, 1], [0, 0, -1],
    [1, 0, 0], [-0.5, 0.8660254, 0], [-0.5, -0.8660254, 0],
  ],
  6: [ // octahedral
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ],
};

function normalize([x, y, z]) {
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / len, y / len, z / len];
}

// Geometry name -> { domainCount, label } — the teacher-facing geometry
// names, each backed by the correct domain-count position table above.
export const GEOMETRY_LIBRARY = {
  linear: { domainCount: 2, bondDomains: 2, label: "Linear" },
  bent: { domainCount: 4, bondDomains: 2, label: "Bent" },
  "trigonal-planar": { domainCount: 3, bondDomains: 3, label: "Trigonal planar" },
  "trigonal-pyramidal": { domainCount: 4, bondDomains: 3, label: "Trigonal pyramidal" },
  tetrahedral: { domainCount: 4, bondDomains: 4, label: "Tetrahedral" },
  "trigonal-bipyramidal": { domainCount: 5, bondDomains: 5, label: "Trigonal bipyramidal" },
  octahedral: { domainCount: 6, bondDomains: 6, label: "Octahedral" },
};

/** Builds { positions, kinds } for a named geometry — first `bondDomains` positions are bonds, the rest are lone pairs. */
export function buildDomains(geometryName) {
  const spec = GEOMETRY_LIBRARY[geometryName];
  if (!spec) return { positions: [], kinds: [] };
  const positions = DOMAIN_POSITIONS[spec.domainCount];
  const kinds = positions.map((_, i) => (i < spec.bondDomains ? "bond" : "lonePair"));
  return { positions, kinds, label: spec.label };
}
