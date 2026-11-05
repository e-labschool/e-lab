// Isotope arithmetic: relative atomic mass, formula masses and isotope patterns by POLYNOMIAL (multinomial) EXPANSION. PURE.
//
// For an element with isotopes i (mass number A_i, abundance p_i) the generating polynomial is  P(x) = sum_i p_i x^(A_i).
// A molecule or ion with n_E atoms of element E has the pattern  prod_E P_E(x)^(n_E)  (convolution). The exponent of each term is the nominal mass
// of that isotopic combination, the coefficient is its probability (for two isotopes this is the binomial coefficient C(n,k) p^(n-k) q^k).
// Cl2 with 3 : 1 gives (0.75 x^35 + 0.25 x^37)^2 = 0.5625 x^70 + 0.375 x^72 + 0.0625 x^74, i.e. 9 : 6 : 1.
import { ISOTOPES, TEACHING_ABUNDANCE } from "../data/isotopes.js";
import { M_ELECTRON_U } from "./constants.js";

/** abundance table of an element: mode "natural" (IUPAC) or "teaching" (Cl 75:25, Br 50:50; other elements natural). Probabilities (sum 1). */
export function isotopesOf(el, mode = "natural") {
  const table = (mode === "teaching" && TEACHING_ABUNDANCE[el]) || ISOTOPES[el];
  if (!table) throw new Error(`unknown element ${el}`);
  const tot = table.reduce((s, t) => s + t.pct, 0);
  return table.map((t) => ({ A: t.A, mass: t.mass, p: t.pct / tot }));
}
export const mostAbundant = (el) => ISOTOPES[el].reduce((best, t) => (t.pct > best.pct ? t : best));

/** Relative atomic mass from MASS NUMBERS (what the school calculation uses): sum(A p) / sum(p).  list: [{A, pct}] */
export const arFromMassNumbers = (list) => list.reduce((s, t) => s + t.A * t.pct, 0) / list.reduce((s, t) => s + t.pct, 0);
/** Relative atomic mass from the EXACT isotopic masses: sum(m p) / sum(p).  list: [{mass, pct}] */
export const arFromIsotopicMasses = (list) => list.reduce((s, t) => s + t.mass * t.pct, 0) / list.reduce((s, t) => s + t.pct, 0);

/** The two-isotope chlorine sample of stage 10 for a given percentage of 35Cl. Returns both Ar values. */
export function chlorineSample(pct35) {
  const p35 = Math.min(100, Math.max(0, pct35)); const p37 = 100 - p35;
  const [a, b] = ISOTOPES.Cl;
  const list = [{ A: a.A, mass: a.mass, pct: p35 }, { A: b.A, mass: b.mass, pct: p37 }];
  return { p35, p37, arMassNumbers: arFromMassNumbers(list), arExact: arFromIsotopicMasses(list), list };
}

// ---- formulas ----
/** "C2H6O" -> {C:2, H:6, O:1}. Letters and digits only (no brackets): enough for the molecules and ions of this workspace. */
export function parseFormula(str) {
  const out = {}; const re = /([A-Z][a-z]?)(\d*)/g; let m; let used = 0;
  while ((m = re.exec(str)) !== null) { if (m[0] === "") { re.lastIndex += 1; continue; } if (!ISOTOPES[m[1]]) throw new Error(`unknown element ${m[1]} in ${str}`); out[m[1]] = (out[m[1]] ?? 0) + (m[2] === "" ? 1 : Number(m[2])); used += m[0].length; }
  if (used !== str.length) throw new Error(`cannot parse formula ${str}`);
  return out;
}
/** override: {Cl: 35} picks that isotope for every atom of the element (used for fragment ions that contain one specific halogen isotope). */
const isoFor = (el, override) => (override && override[el] ? ISOTOPES[el].find((t) => t.A === override[el]) ?? (() => { throw new Error(`no ${el}-${override[el]}`); })() : mostAbundant(el));
export function nominalMass(comp, override) { return Object.entries(comp).reduce((s, [el, n]) => s + n * isoFor(el, override).A, 0); }
/** monoisotopic (exact) mass of the neutral species, u */
export function exactMass(comp, override) { return Object.entries(comp).reduce((s, [el, n]) => s + n * isoFor(el, override).mass, 0); }
/** exact m/z of a cation with charge +z: (neutral mass - z electron masses) / z. The electron mass (0.000549 u) is small but real. */
export const cationMz = (comp, override, z = 1) => (exactMass(comp, override) - z * M_ELECTRON_U) / z;

// ---- isotope pattern ----
/**
 * isotopePattern(comp, { mode, only }) -> { peaks: [{nominal, p, rel, exact}], total }
 *   mode  "natural" | "teaching"
 *   only  optional list of elements whose isotopes are expanded; every other element is held at its most abundant isotope
 *         (the "halogen pattern" of stage 11 uses only: ["Cl","Br"]; the full pattern uses no list)
 * rel is normalised so that the tallest peak is 100. exact is the probability-weighted exact mass of the combinations at that nominal mass.
 */
export function isotopePattern(comp, { mode = "natural", only = null } = {}) {
  let poly = new Map([[0, { p: 1, m: 0 }]]); // nominal -> {p, m: sum(p * exact mass)}
  for (const [el, n] of Object.entries(comp)) {
    const iso = !only || only.includes(el) ? isotopesOf(el, mode) : [{ ...mostAbundant(el), p: 1 }];
    for (let k = 0; k < n; k += 1) {
      const next = new Map();
      for (const [a, t] of poly) for (const i of iso) {
        const key = a + i.A; const cur = next.get(key) ?? { p: 0, m: 0 };
        const p = t.p * i.p; cur.p += p; cur.m += t.m * i.p + p * i.mass; next.set(key, cur);
      }
      poly = next;
    }
  }
  const entries = [...poly.entries()].sort((a, b) => a[0] - b[0]).map(([nominal, t]) => ({ nominal, p: t.p, exact: t.m / t.p }));
  const total = entries.reduce((s, e) => s + e.p, 0); const top = Math.max(...entries.map((e) => e.p));
  return { peaks: entries.map((e) => ({ ...e, rel: (100 * e.p) / top })), total };
}
/** keep only peaks above a probability threshold (relative to the tallest), e.g. to hide 1e-6 tails */
export const significantPeaks = (pattern, minRel = 0.05) => pattern.peaks.filter((p) => p.rel >= minRel);

/** The isotopic combinations behind a pattern of n atoms of ONE two-isotope element: k heavy atoms, multiplicity C(n,k), probability, mass-number sum. */
export function isotopologues(el, n, mode = "natural") {
  const [light, heavy] = isotopesOf(el, mode);
  const binom = (nn, kk) => { let r = 1; for (let i = 1; i <= kk; i += 1) r = (r * (nn - kk + i)) / i; return Math.round(r); };
  return Array.from({ length: n + 1 }, (_, k) => ({ k, light: light.A, heavy: heavy.A, nLight: n - k, nHeavy: k, count: binom(n, k), p: binom(n, k) * light.p ** (n - k) * heavy.p ** k, massNumberSum: (n - k) * light.A + k * heavy.A }));
}
/** smallest whole-number ratio of a pattern with tolerance (e.g. 100 : 66.7 : 11.1 -> 9 : 6 : 1) - only for the teaching mode where the ratios are exact. */
export function simpleRatio(rels, maxInt = 60) {
  const min = Math.min(...rels.filter((r) => r > 0));
  for (let d = 1; d <= maxInt; d += 1) {
    const ints = rels.map((r) => (r / min) * d);
    if (ints.every((x) => Math.abs(x - Math.round(x)) < 1e-6)) return ints.map(Math.round);
  }
  return null;
}
