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
/** Reach (distance nucleus -> lobe tip along the lobe axis) per orbital class. Deliberately modest so that atoms, the
 *  bonding region and neighbouring lobes stay visible (the lobes are slim, so a large reach is not needed to read them). */
export function reach(cls, n) {
  const s = nScale(n);
  switch (cls) {
    case "s": return 0.62 * s;
    case "p": return 1.3 * s;
    case "hybrid": return 1.05 * s;
    case "d": return 1.3 * s;
    default: return 0.62 * s;
  }
}

/** Drawing exponent per orbital class. The surface is the polar plot r(dir) = R * sign(f) * (|f| / max|f|)^K of the ANGULAR
 *  function f. K = 1 would be the raw |Y| polar plot (a p orbital = two tangent spheres, the "balloons" the old drawing looked
 *  like); K = 2 is the angular part of the probability density; the larger exponents used for p and d lobes slim them into
 *  tapered dumbbells / cloverleaves that pinch to a point at the nucleus (r -> 0 as the direction leaves the lobe axis).
 *  Hybrids keep a smaller exponent so that the small back lobe stays visible: its size relative to the large lobe is exactly
 *  (|f_back| / |f_front|)^K_HYBRID. This is an educational representation (angular part only, no radial wavefunction). */
/** Extra lateral slimming of the DRAWN mesh per class (rendering only): hybrids are drawn a little slimmer than their polar plot so that they read as elongated lobes. */
export const DRAW_WIDTH = { s: 1, p: 1, hybrid: 0.68, d: 1 };
export const SURFACE_K = { s: 1, p: 2.3, hybrid: 2.0, d: 2.3 };
/** Class of a term list: one s term = s, one p term = p, one d term = d, anything else = hybrid. */
export function classOfTerms(terms) {
  if (terms.length === 1) return typeOf(terms[0][0]);
  return "hybrid";
}
/** Widest half-width of a p lobe divided by its reach for exponent K: max over theta of cos^K(theta) sin(theta) = (K/(K+1))^(K/2) / sqrt(K+1). */
export const P_LATERAL = (SURFACE_K.p / (SURFACE_K.p + 1)) ** (SURFACE_K.p / 2) / Math.sqrt(SURFACE_K.p + 1);

/** Colour family of an orbital kind: "s", "px", "py", "pz" or "d" (all five d orbitals share one phase palette). */
export const colourKey = (kind) => (kind === "s" ? "s" : kind[0] === "p" ? kind : "d");
/** Human readable colour used in the legend / docs: 2px blue, 2py green, 2pz purple, s red/orange, hybrids h0..h5. */
export const COLOUR_NAMES = { s: "red/orange", px: "blue", py: "green", pz: "purple", d: "teal/gold" };
