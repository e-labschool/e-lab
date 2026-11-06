// Small ball-and-stick geometries for the SVG molecule glyphs (stages 2-4, 10, 11). PURE. Lengths are in angstrom (C-H 1.09, H-H 0.74, C-Cl 1.78); only the
// SHAPES matter: CH4 tetrahedral, CH3+ trigonal planar (sp2), CH2+• bent. The drawn radii are display radii (not van der Waals radii).
export const ATOM_STYLE = {
  C: { r: 0.42, light: "#d7deef", dark: "#58648a" },
  H: { r: 0.27, light: "#ffffff", dark: "#9aaccd" },
  O: { r: 0.4, light: "#fecaca", dark: "#dc2626" },
  Cl: { r: 0.62, light: "#b9f5cf", dark: "#1f9d55" },
  Br: { r: 0.72, light: "#ffc9a0", dark: "#9a3412" },
};
const T = 1.09 / Math.sqrt(3);
const tet = [[T, T, T], [T, -T, -T], [-T, T, -T], [-T, -T, T]];
const plane = (n, bond, tilt = 0) => Array.from({ length: n }, (_, i) => { const a = tilt + (2 * Math.PI * i) / n; return [bond * Math.cos(a), bond * Math.sin(a) * 0.999, 0]; });
export const GEOMETRIES = {
  ch4: { atoms: [{ el: "C", p: [0, 0, 0] }, ...tet.map((p) => ({ el: "H", p }))], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] },
  ch3: { atoms: [{ el: "C", p: [0, 0, 0] }, ...plane(3, 1.09, Math.PI / 2).map((p) => ({ el: "H", p }))], bonds: [[0, 1], [0, 2], [0, 3]] },
  ch2: { atoms: [{ el: "C", p: [0, 0, 0] }, { el: "H", p: [1.0, 0.45, 0] }, { el: "H", p: [-1.0, 0.45, 0] }], bonds: [[0, 1], [0, 2]] },
  ch: { atoms: [{ el: "C", p: [0, 0, 0] }, { el: "H", p: [1.12, 0, 0] }], bonds: [[0, 1]] },
  c: { atoms: [{ el: "C", p: [0, 0, 0] }], bonds: [] },
  h: { atoms: [{ el: "H", p: [0, 0, 0] }], bonds: [] },
  h2: { atoms: [{ el: "H", p: [-0.37, 0, 0] }, { el: "H", p: [0.37, 0, 0] }], bonds: [[0, 1]] },
  cl: { atoms: [{ el: "Cl", p: [0, 0, 0] }], bonds: [] },
  ch3cl: { atoms: [{ el: "C", p: [0, 0, 0] }, { el: "Cl", p: [0, 0, 1.78] }, ...[0, 1, 2].map((i) => { const a = (2 * Math.PI * i) / 3; return { el: "H", p: [1.03 * Math.cos(a), 1.03 * Math.sin(a), -0.36] }; })], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] },
};

/** rotate about y (spin) then tilt about x, orthographic. returns {x, y (up positive), z (depth, larger = nearer)} */
export function project([x, y, z], spin = 0, tilt = 0.35) {
  const c = Math.cos(spin); const s = Math.sin(spin);
  const x1 = x * c + z * s; const z1 = -x * s + z * c;
  const ct = Math.cos(tilt); const st = Math.sin(tilt);
  const y2 = y * ct - z1 * st; const z2 = y * st + z1 * ct;
  return { x: x1, y: y2, z: z2 };
}
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Fragmentation pathways as atom-level motion: the precursor geometry, which atoms stay with the charge, where each group ends up (positions relative to its own centre). */
export const FRAGMENT_MOTION = {
  ch3: { // CH4+• -> CH3+ + H•
    pre: "ch4", charged: [0, 1, 2, 3], neutral: [4], chargedEnd: "ch3", neutralEnd: "h", neutralLeaves: [0.55, 0.65, 0.2],
  },
  ch2: { // CH4+• -> CH2+• + H2
    pre: "ch4", charged: [0, 1, 2], neutral: [3, 4], chargedEnd: "ch2", neutralEnd: "h2", neutralLeaves: [0.55, 0.65, 0.2],
  },
  ch: { // CH3+ -> CH+ + H2
    pre: "ch3", charged: [0, 1], neutral: [2, 3], chargedEnd: "ch", neutralEnd: "h2", neutralLeaves: [0.55, 0.65, 0.2],
  },
  c: { // CH+ -> C+ + H•
    pre: "ch", charged: [0], neutral: [1], chargedEnd: "c", neutralEnd: "h", neutralLeaves: [0.55, 0.65, 0.2],
  },
};
