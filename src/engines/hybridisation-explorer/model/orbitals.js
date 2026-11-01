// Orbital definitions: names, labels, angular functions and the size conventions of the EDUCATIONAL drawing.
// Pure (no React / three). The angular parts are the real (normalised) real spherical harmonics; the radial part is
// NOT computed: an orbital is drawn as the polar plot r(theta, phi) = R * |f| / max|f| of its angular function (sign
// = phase). That is a qualitative shape, not a quantum-mechanical calculation.

export const MINUS = "−";
export const P_KINDS = ["px", "py", "pz"];
export const D_KINDS = ["dxy", "dxz", "dyz", "dx2-y2", "dz2"]; // display order
export const P_AXIS = { px: [1, 0, 0], py: [0, 1, 0], pz: [0, 0, 1] };

const SUB = { px: "x", py: "y", pz: "z", dxy: "xy", dxz: "xz", dyz: "yz", "dx2-y2": `x^{2}${MINUS}y^{2}`, dz2: "z^{2}" };
const SUB_PLAIN = { px: "x", py: "y", pz: "z", dxy: "xy", dxz: "xz", dyz: "yz", "dx2-y2": `x${MINUS}y (x²${MINUS}y²)`, dz2: "z²" };

export const typeOf = (kind) => (kind === "s" ? "s" : kind[0]);
export const lOf = (kind) => ({ s: 0, p: 1, d: 2 })[typeOf(kind)];

/** Stable id, also the specific name with its principal quantum number: "2s", "2px", "3dz2", "3dx2-y2". */
export const orbitalId = (n, kind) => `${n}${kind}`;

/** LaTeX-ish source for the app's scientific renderer (renderCompactLatex): 2p_{x}, 3d_{x^{2}-y^{2}}. */
export function orbitalLatex(n, kind) {
  if (kind === "s") return `${n}s`;
  return `${n}${kind[0]}_{${SUB[kind]}}`;
}
/** Plain-text accessible name: "2px", "3dz2", "3d x2-y2". */
export function orbitalPlain(n, kind) {
  if (kind === "s") return `${n}s`;
  if (kind === "dx2-y2") return `${n}d(x²${MINUS}y²)`;
  if (kind === "dz2") return `${n}d(z²)`;
  return `${n}${kind}`;
}
export { SUB_PLAIN };

export function makeOrbital(n, kind, electrons = 0) {
  const id = orbitalId(n, kind);
  return { id, n, kind, type: typeOf(kind), l: lOf(kind), electrons, latex: orbitalLatex(n, kind), plain: orbitalPlain(n, kind) };
}

// ---- real spherical harmonics (normalised) -------------------------------------------------------------------------
const C_S = 1 / (2 * Math.sqrt(Math.PI));
const C_P = Math.sqrt(3 / (4 * Math.PI));
const C_DZ2 = Math.sqrt(5 / (16 * Math.PI));
const C_DX2 = Math.sqrt(15 / (16 * Math.PI));
const C_DXY = Math.sqrt(15 / (4 * Math.PI));
/** Angular function of a real orbital at the UNIT direction (x, y, z). */
export function angular(kind, x, y, z) {
  switch (kind) {
    case "s": return C_S;
    case "px": return C_P * x;
    case "py": return C_P * y;
    case "pz": return C_P * z;
    case "dz2": return C_DZ2 * (3 * z * z - 1);
    case "dx2-y2": return C_DX2 * (x * x - y * y);
    case "dxy": return C_DXY * x * y;
    case "dxz": return C_DXY * x * z;
    case "dyz": return C_DXY * y * z;
    default: throw new Error(`unknown orbital kind ${kind}`);
  }
}
/** Linear combination sum_k c_k * angular(kind_k)(dir); terms = [[kind, coeff], ...]. */
export function combination(terms, x, y, z) {
  let v = 0; for (let i = 0; i < terms.length; i += 1) v += terms[i][1] * angular(terms[i][0], x, y, z); return v;
}

// ---- size conventions of the drawing (scene units) -----------------------------------------------------------------
/** Base size per principal quantum number. */
export const nScale = (n) => ({ 1: 0.85, 2: 1.0, 3: 1.2, 4: 1.35, 5: 1.5 })[n] ?? 1.0 + 0.12 * (n - 2);
/** Reach (distance nucleus -> lobe tip along the lobe axis) per orbital class. */
export function reach(cls, n) {
  const s = nScale(n);
  switch (cls) {
    case "s": return s;
    case "p": return 1.25 * s;
    case "hybrid": return 1.35 * s;
    case "d": return 1.3 * s;
    default: return s;
  }
}

/** Drawing exponent: surfaces are r = R (|f|/max|f|)^GAMMA. 1 would be the plain polar plot of the angular function (two tangent
 *  spheres for a p orbital); 2 the angular part of the probability density. 1.5 keeps lobes slim enough to read while the small
 *  back lobe of a hybrid stays visible. P_LATERAL = widest half-width of a p lobe / its reach for this exponent (used by the
 *  pi-overlap distance window so the overlap window matches what is drawn). Both are verified numerically in the tests. */
export const GAMMA = 1.5;
export const P_LATERAL = 0.43;
