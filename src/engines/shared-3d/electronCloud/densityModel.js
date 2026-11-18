// SIMPLIFIED electron-density model (pure; no three, no React). Shared by the Polarity Playground and the Intermolecular Forces
// Visualiser so both draw the same picture.
//
// WHAT THIS IS.  Every atom contributes one smooth, roughly spherical translucent REGION of electron density around its nucleus
// (a Venn-diagram picture in 3D). Where regions overlap the density of both atoms is present: that overlap is the shared bonding
// electron density of the simplified model. It is NOT a quantum-mechanical density (no molecular orbitals, no nuclear charge);
// the radii are teaching radii and the picture is "not to scale".
//
// HOW A POLAR BOND IS SHOWN.  The picture is NOT made by sliding two whole spheres sideways. For every bond whose atoms differ in
// electronegativity (s = visualPolarity(delta-EN), a qualitative 0..1 dial):
//   * the LESS electronegative atom's region is drawn out towards its partner (a teardrop bump in the bond direction; its far side is
//     untouched) and its density is thinner (relatively reduced);
//   * the MORE electronegative atom's region is a little more compact and its density more concentrated;
//   * as a result the OVERLAP (the shared bonding region) moves towards the more electronegative atom and stays continuous.
// Equal electronegativity gives identical contributions mirrored about the bond midpoint: a symmetric distribution.
//
// WHAT COLOUR MEANS (see docs/POLARITY_PLAYGROUND.md): density is drawn in ONE hue (teal): deeper = more concentrated. Colour never
// encodes charge. Partial charges are separate overlays (delta-plus blue, delta-minus red, always with the +/- sign).
// Electrostatic potential (ESP) is a different quantity and has its own optional colour mode (see ElectronCloud.js).
import { ELEMENT_STYLE } from "../elementStyle.js";
import { PAULING, visualPolarity, POLAR_BOND_MIN } from "./electronegativity.js";
import { add, clamp, dot, len, mul, perpTo, smooth, sub, unit } from "./vec3.js";

export const PULL_K = 0.62; // how far (as a fraction of R) a region is drawn out towards a more electronegative partner at s = 1
export const SQUEEZE_K = 0.16; // how much the electronegative atom's region is compacted at s = 1
export const CONC_UP = 0.55; // density gain of the electronegative atom
export const CONC_DOWN = 0.45; // density loss of the electron-poor atom
export const REGION_K = 1.45; // default region radius = REGION_K x van der Waals radius (scene units, not to scale)
export const LENS_GAIN = 0.9; // extra density where a region's surface lies inside another region (the bonding overlap)
export const BIAS_SHIFT = 0.22; // fraction of R a fully biased (polarised) cloud is displaced against the nuclei
export const BIAS_GRAD = 0.8; // density gradient across a polarised cloud

export const vdwOf = (el) => ELEMENT_STYLE[el]?.vdw ?? 1.8;
export const regionRadius = (el, regionScale = REGION_K) => regionScale * vdwOf(el);
export const nucleusRadius = (el) => ELEMENT_STYLE[el]?.r ?? 0.45;
/** Display bond length (scene units) of a two-atom picture so that the regions overlap like a Venn diagram. */
export const displayBondLength = (a, b, regionScale = REGION_K, overlap = 0.62) => overlap * (regionRadius(a, regionScale) + regionRadius(b, regionScale));

const bump = (c) => { const t = (c + 1) / 2; return t * t * t; }; // 1 towards the partner, 0 directly away

/**
 * Regions of one molecule / atom pair.
 *   mol       { atoms:[{ el, p:[x,y,z] }], bonds:[[i, j, order?]] }
 *   opts      regionScale  radius scale (default REGION_K);   progress 0..1  how far the redistribution has run (0 = equal sharing);
 *             minDelta     bonds with delta-EN below this add nothing (IMF uses the IB 0.4 so C-H stays symmetric);
 *             bias         { p:[x,y,z], strength 0..1 }  a polarisation of the whole cloud (induced / instantaneous dipole p, pointing
 *                          from its delta-minus to its delta-plus end): the density is displaced and concentrated on the delta-minus side.
 * Returns { regions, bonds, bias } where every region is { i, el, c, R, conc, squeeze, pulls:[{u,k,j,s}], offset, sOut, sIn }.
 */
export function buildRegions(mol, opts = {}) {
  const { regionScale = REGION_K, progress = 1, minDelta = 0, bias = null } = opts;
  const prog = clamp(progress, 0, 1);
  const regions = mol.atoms.map((a, i) => ({ i, el: a.el, c: [...a.p], R: a.R ?? regionRadius(a.el, regionScale), conc: 1, squeeze: 1, pulls: [], offset: [0, 0, 0], sOut: 0, sIn: 0 }));
  const bonds = [];
  for (const b of mol.bonds ?? []) {
    const [i, j] = b; const ei = mol.atoms[i].en ?? PAULING[mol.atoms[i].el]; const ej = mol.atoms[j].en ?? PAULING[mol.atoms[j].el]; // an atom may carry its own `en` (fictional atoms of the Tug-of-War free play) and `R`
    const dEN = ei !== undefined && ej !== undefined ? Math.abs(ei - ej) : 0;
    const s = dEN >= Math.max(1e-9, minDelta) ? visualPolarity(dEN) * prog : 0;
    const hi = ei >= ej ? i : j; const lo = hi === i ? j : i; // hi = more electronegative
    bonds.push({ i, j, hi: s > 0 ? hi : null, lo: s > 0 ? lo : null, dEN, s });
    if (s <= 0) continue;
    const u = unit(sub(mol.atoms[hi].p, mol.atoms[lo].p));
    regions[lo].pulls.push({ u, k: PULL_K * s, j: hi, s }); regions[lo].sIn += s; regions[hi].sOut += s;
  }
  for (const r of regions) {
    r.conc = clamp(1 + CONC_UP * Math.tanh(1.2 * r.sOut) - CONC_DOWN * Math.tanh(1.2 * r.sIn), 0.45, 1.9);
    r.squeeze = 1 - SQUEEZE_K * Math.min(1, r.sOut);
  }
  let bias2 = null;
  if (bias && bias.p && len(bias.p) > 1e-12 && (bias.strength ?? 1) > 0) {
    const e = unit(mul(bias.p, -1)); // electron-rich (delta-minus) direction
    const st = clamp(bias.strength ?? 1, 0, 1); bias2 = { e, strength: st };
    for (const r of regions) r.offset = mul(e, BIAS_SHIFT * r.R * st);
  }
  return { regions, bonds, bias: bias2 };
}

/** Distance from the nucleus of the region's surface in the unit direction d. */
export function regionRadiusAt(region, d, bias = null) {
  let f = 1;
  for (const p of region.pulls) f += p.k * bump(dot(d, p.u));
  let r = region.R * region.squeeze * f;
  if (bias) r *= 1 + 0.3 * bias.strength * dot(d, bias.e); // bulges on the delta-minus side, flattens on the delta-plus side
  return r;
}
export const regionCentre = (region) => add(region.c, region.offset);
export const surfacePoint = (region, d, bias = null) => add(regionCentre(region), mul(d, regionRadiusAt(region, d, bias)));
/** > 0 inside the region (1 at the nucleus), 0 on its surface, < 0 outside. */
export function insideDepth(region, point, bias = null) {
  const v = sub(point, regionCentre(region)); const l = len(v);
  if (l < 1e-9) return 1;
  return 1 - l / regionRadiusAt(region, mul(v, 1 / l), bias);
}

/** Density of the whole model at a point (relative units): each region contributes conc x a smooth fall-off that is 1/2 on its surface. */
export function densityAt(spec, point) {
  let rho = 0;
  for (const r of spec.regions) {
    const v = sub(point, regionCentre(r)); const l = len(v); const d = l < 1e-9 ? [1, 0, 0] : mul(v, 1 / l);
    const x = l / regionRadiusAt(r, d, spec.bias);
    let g = Math.exp(-Math.LN2 * x * x);
    if (spec.bias) g *= 1 + BIAS_GRAD * spec.bias.strength * 0.5 * dot(d, spec.bias.e);
    rho += r.conc * g;
  }
  return rho;
}

function bounds(spec, margin = 0.2) {
  const lo = [1e9, 1e9, 1e9]; const hi = [-1e9, -1e9, -1e9];
  for (const r of spec.regions) { const c = regionCentre(r); const R = r.R * (1 + PULL_K + 0.5) + margin; for (let k = 0; k < 3; k += 1) { lo[k] = Math.min(lo[k], c[k] - R); hi[k] = Math.max(hi[k], c[k] + R); } }
  return { lo, hi };
}
/** Density-weighted centroid of the model's density (grid integral). Equal electronegativities on a symmetric molecule: the geometric centre. */
export function densityCentroid(spec, step = 0.16) {
  const { lo, hi } = bounds(spec); let s = [0, 0, 0]; let w = 0;
  for (let x = lo[0]; x <= hi[0]; x += step) for (let y = lo[1]; y <= hi[1]; y += step) for (let z = lo[2]; z <= hi[2]; z += step) {
    const rho = densityAt(spec, [x, y, z]); s = add(s, mul([x, y, z], rho)); w += rho;
  }
  return w > 0 ? mul(s, 1 / w) : [0, 0, 0];
}
/** Volume centroid of the part of region i that is also inside region j (the shared bonding region), plus its volume (grid integral). */
export function overlapCentroid(spec, i, j, step = 0.1) {
  const ri = spec.regions[i]; const rj = spec.regions[j]; const { lo, hi } = bounds({ regions: [ri, rj], bias: spec.bias });
  let s = [0, 0, 0]; let n = 0;
  for (let x = lo[0]; x <= hi[0]; x += step) for (let y = lo[1]; y <= hi[1]; y += step) for (let z = lo[2]; z <= hi[2]; z += step) {
    const p = [x, y, z]; if (insideDepth(ri, p, spec.bias) > 0 && insideDepth(rj, p, spec.bias) > 0) { s = add(s, p); n += 1; }
  }
  return n ? { centre: mul(s, 1 / n), volume: n * step ** 3 } : { centre: null, volume: 0 };
}
/** The shared bonding region of two bonded atoms measured along the bond axis (analytic, cheap): { lo, hi, centre, halfLen, axis } in world coordinates. */
export function bondingLens(spec, i, j) {
  const ri = spec.regions[i]; const rj = spec.regions[j]; const ci = regionCentre(ri); const cj = regionCentre(rj);
  const axis = unit(sub(cj, ci)); const d = len(sub(cj, ci));
  const hiX = regionRadiusAt(ri, axis, spec.bias); // where region i ends, measured from ci along the axis
  const loX = d - regionRadiusAt(rj, mul(axis, -1), spec.bias); // where region j begins
  const a = Math.max(0, loX); const b = Math.min(d, hiX);
  const mid = (a + b) / 2;
  return { axis, lo: add(ci, mul(axis, a)), hi: add(ci, mul(axis, b)), centre: add(ci, mul(axis, mid)), halfLen: Math.max(0, (b - a) / 2), t: d > 0 ? mid / d : 0.5, continuous: hiX > loX };
}

// ---- the two "electron markers" of the Atom & Bond view ---------------------------------------------------------------------------
/**
 * Two small markers standing for the shared pair. They are NOT classical particles on tracks: each wanders in a small, never-repeating
 * pattern inside the shared bonding region (stays within `spread` of the lens centre) and the two keep to opposite sides of it.
 */
export function electronMarkers(t, lens, widthRef = 0.5, spread = 0.55) {
  const u = lens.axis; const p1 = perpTo(u); const p2 = unit([u[1] * p1[2] - u[2] * p1[1], u[2] * p1[0] - u[0] * p1[2], u[0] * p1[1] - u[1] * p1[0]]);
  const L = Math.max(0.05, lens.halfLen * spread); const W = widthRef * spread;
  const mk = (ph) => {
    const a = Math.sin(1.7 * t + ph) * 0.62 + Math.sin(2.9 * t + 1.3 * ph) * 0.38;
    const b = Math.sin(2.3 * t + 0.8 + ph) * 0.62 + Math.sin(3.7 * t + ph) * 0.38;
    const c = Math.cos(1.9 * t + ph) * 0.62 + Math.cos(3.1 * t + 2 * ph) * 0.38;
    return add(lens.centre, add(mul(u, L * a), add(mul(p1, W * b), mul(p2, W * c))));
  };
  return [mk(0), mk(Math.PI)];
}

// ---- per-vertex density for the renderer ----------------------------------------------------------------------------------------------
/** Density weight of the vertex of region `ri` that lies in direction d at `point` (used as the opacity / depth-of-colour attribute). */
export function vertexDensity(spec, ri, d, point) {
  const r = spec.regions[ri]; let v = r.conc;
  if (spec.bias) v *= 1 + BIAS_GRAD * spec.bias.strength * dot(d, spec.bias.e);
  let overlap = 0;
  for (const o of spec.regions) { if (o === r) continue; overlap = Math.max(overlap, smooth(0, 0.3, insideDepth(o, point, spec.bias))); }
  return v * (1 + LENS_GAIN * overlap);
}

export { POLAR_BOND_MIN };
