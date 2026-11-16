// Shared nuclide (isotope) layer for Z = 1-118, built from NUBASE2020.
//
// SOURCE: F.G. Kondev, M. Wang, W.J. Huang, S. Naimi, G. Audi, "The NUBASE2020 evaluation of nuclear
// physical properties", Chin. Phys. C 45, 030001 (2021). File nubase_4.mas20.txt (AMDC / IAEA). Retrieved
// 2026-11-16 from the "nucleardatapy" 1.0.2 Python wheel (data/nuclei/masses/AME/2020_nubase_4.mas20.txt),
// converted by scripts/gen-nuclide-data.mjs into nuclideData.generated.js. Natural abundances are the
// "IS=" values in the same file (IUPAC-derived). Nothing here is typed from memory.
//
// APPROXIMATIONS / POLICY (also in docs/sim-review/atomic-fixes.md):
//  * A nuclide is "known" if NUBASE2020 lists it as a ground state whose mass is measured, or whose
//    half-life is measured. Entries flagged "#" (estimated from systematics, never observed) are NOT
//    known. Isomers (excited nuclear states) are ignored.
//  * Known range for element Z = the lightest to the heaviest known isotope. Outside it, "no known
//    isotope" and the student cannot build the nuclide. Inside the range, a mass number that was never
//    observed (rare gap, e.g. C-21, K-32..34) is labelled "not yet observed" and also cannot be selected.
//  * Stable = NUBASE2020 "stbl" (no decay observed). Radioactive = anything else with a half-life,
//    including very long-lived primordial nuclides (Ca-48, K-40, U-238). "Unbound" = observed only as a
//    resonance (half-life < 1e-15 s or no half-life): not an atom you could hold.
//  * The reference isotope is the most abundant natural isotope; for elements with no natural
//    abundance it is the longest-lived known isotope.
import { NUCLIDE_ROWS, NUBASE_YEAR } from "./nuclideData.generated.js";

export { NUBASE_YEAR };
export const NUCLIDE_SOURCE = "NUBASE2020 (Kondev et al., Chin. Phys. C 45, 030001, 2021)";
/** Below this half-life (s) a nuclide is only seen as a fleeting resonance, not as an atom. */
export const UNBOUND_HALF_LIFE_S = 1e-15;

const SECONDS_PER_YEAR = 3.15576e7;

function build(z) {
  const rows = NUCLIDE_ROWS[z];
  if (!rows) return null;
  const byA = new Map();
  for (const [A, hl, ab] of rows) byA.set(A, { A, N: A - z, hl, abundance: ab ?? 0 });
  const As = rows.map((r) => r[0]);
  return { z, byA, minA: As[0], maxA: As[As.length - 1] };
}
const CACHE = new Map();
const entry = (z) => {
  if (!Number.isInteger(z)) return null;
  if (!CACHE.has(z)) CACHE.set(z, build(z));
  return CACHE.get(z);
};

export function formatHalfLife(seconds) {
  if (seconds === 0) return "stable";
  if (seconds < 0) return "unbound";
  const sci = (v) => {
    const [m, e] = v.toExponential(2).split("e");
    return `${Number(m)} × 10^${Number(e)}`;
  };
  if (seconds < 1e-3) return `${sci(seconds)} s`;
  if (seconds < 1) return `${(seconds * 1e3).toPrecision(3).replace(/\.?0+$/, "")} ms`;
  if (seconds < 60) return `${Number(seconds.toPrecision(3))} s`;
  if (seconds < 3600) return `${Number((seconds / 60).toPrecision(3))} min`;
  if (seconds < 86400) return `${Number((seconds / 3600).toPrecision(3))} h`;
  if (seconds < SECONDS_PER_YEAR) return `${Number((seconds / 86400).toPrecision(3))} days`;
  const y = seconds / SECONDS_PER_YEAR;
  return y < 1e4 ? `${Number(y.toPrecision(3))} years` : `${sci(y)} years`;
}

/** Lightest and heaviest known isotope (as neutron counts) of element z, or null for z outside 1-118. */
export function neutronRange(z) {
  const e = entry(z);
  if (!e) return null;
  return { minN: e.minA - z, maxN: e.maxA - z, minA: e.minA, maxA: e.maxA };
}

/** Is (z, n) a nuclide that has actually been observed? */
export function isKnownNuclide(z, n) {
  const e = entry(z);
  return !!e && e.byA.has(z + n);
}

/** All known isotopes of z, ascending, each { massNumber, neutrons, status, halfLifeSeconds, halfLifeLabel, abundance }. */
export function isotopesOf(z) {
  const e = entry(z);
  if (!e) return [];
  return [...e.byA.values()].map((r) => describe(z, r));
}

function statusOf(hl) {
  if (hl === 0) return "stable";
  if (hl < 0 || hl < UNBOUND_HALF_LIFE_S) return "unbound";
  return "radioactive";
}

function describe(z, r) {
  return {
    protons: z,
    neutrons: r.N,
    massNumber: r.A,
    status: statusOf(r.hl),
    halfLifeSeconds: r.hl,
    halfLifeLabel: r.hl < 0 ? "unbound" : formatHalfLife(r.hl),
    abundance: r.abundance,
  };
}

/**
 * Classify (z, n).
 * status: "none" (no protons) | "stable" | "radioactive" | "unbound" | "unobserved" | "out-of-range" | "no-data"
 * `exists` is true only when the nuclide is known (stable, radioactive or unbound).
 */
export function classifyNuclide(z, n) {
  if (!Number.isInteger(z) || z < 1) return { status: "none", exists: false };
  const e = entry(z);
  if (!e) return { status: "no-data", exists: false };
  const rec = e.byA.get(z + n);
  if (rec) return { ...describe(z, rec), exists: true };
  const status = z + n < e.minA || z + n > e.maxA ? "out-of-range" : "unobserved";
  return { status, exists: false, protons: z, neutrons: n, massNumber: z + n };
}

/** Number of known isotopes and the stable ones of element z. */
export function stableIsotopes(z) {
  return isotopesOf(z).filter((i) => i.status === "stable");
}

/** Reference isotope: most abundant natural; else longest-lived known (non-unbound). */
export function referenceIsotope(z) {
  const list = isotopesOf(z);
  if (!list.length) return null;
  const natural = list.filter((i) => i.abundance > 0);
  if (natural.length) return natural.reduce((a, b) => (b.abundance > a.abundance ? b : a));
  const real = list.filter((i) => i.status !== "unbound");
  return (real.length ? real : list).reduce((a, b) => {
    const ha = a.halfLifeSeconds === 0 ? Infinity : a.halfLifeSeconds;
    const hb = b.halfLifeSeconds === 0 ? Infinity : b.halfLifeSeconds;
    return hb > ha ? b : a;
  });
}

/**
 * The step a student asked for (+1 / -1 neutron). Returns { neutrons, refused, reason } where `neutrons`
 * is the new count (unchanged when refused). Steps over unobserved gaps inside the known range.
 */
export function stepNeutrons(z, n, delta, elementName = "this element") {
  const range = neutronRange(z);
  if (!range) return { neutrons: n, refused: false, reason: null };
  if (n < range.minN || n > range.maxN) {
    return { neutrons: clampNeutrons(z, n), refused: false, reason: null, snapped: true };
  }
  const dir = delta > 0 ? 1 : -1;
  let next = n + dir;
  while (next >= range.minN && next <= range.maxN && !isKnownNuclide(z, next)) next += dir;
  if (next > range.maxN) {
    return { neutrons: n, refused: true, reason: `The heaviest known ${elementName} isotope is ${elementName}-${range.maxA} (${range.maxN} neutrons). No heavier isotope has ever been observed, so it cannot be built.` };
  }
  if (next < range.minN) {
    return { neutrons: n, refused: true, reason: `The lightest known ${elementName} isotope is ${elementName}-${range.minA} (${range.minN} neutrons). With fewer neutrons the nucleus does not exist.` };
  }
  return { neutrons: next, refused: false, reason: null };
}

/** Nearest known neutron count for z at or above/below n (used when the element changes). */
export function clampNeutrons(z, n) {
  const range = neutronRange(z);
  if (!range) return n;
  let v = Math.min(range.maxN, Math.max(range.minN, n));
  if (isKnownNuclide(z, v)) return v;
  for (let d = 1; d < 100; d += 1) {
    if (isKnownNuclide(z, v + d)) return v + d;
    if (isKnownNuclide(z, v - d)) return v - d;
  }
  return v;
}

/** Plain-English teaching sentence for a classification. */
export function nuclideMessage(z, n, name = "this element") {
  const c = classifyNuclide(z, n);
  const label = `${name}-${z + n}`;
  switch (c.status) {
    case "none": return "A nucleus needs at least one proton.";
    case "stable": return `${label} is a stable nuclide: no radioactive decay has ever been observed.`;
    case "radioactive": return `${label} is radioactive (half-life ${c.halfLifeLabel}). It exists, but it is not stable: it decays.`;
    case "unbound": return `${label} has only been seen as an extremely short-lived resonance. It is not stable and does not exist long enough to form an atom.`;
    case "unobserved": return `No known isotope: ${label} has never been observed.`;
    case "out-of-range": {
      const r = neutronRange(z);
      return `No known isotope: ${label} has never been observed. Known ${name} isotopes run from ${name}-${r.minA} to ${name}-${r.maxA}.`;
    }
    default: return "No isotope data for this element.";
  }
}
