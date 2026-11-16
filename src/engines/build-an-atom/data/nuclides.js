// Build an Atom's nuclide data is now a thin adapter over the SHARED atomic data layer
// (src/lib/atomic/nuclides.js, NUBASE2020; see that file's header for source, date and approximations).
// The earlier hand-curated Z = 1-36 table (which only knew stable isotopes plus a few radioactive ones
// and called every other nuclide "not stable", including impossible ones such as hydrogen-61) was removed.
import { classifyNuclide as sharedClassify, isotopesOf, referenceIsotope as sharedReference, neutronRange } from "../../../lib/atomic/nuclides.js";

export const MAX_SUPPORTED_ATOMIC_NUMBER = 36;

export function hasCuratedCoverage(atomicNumber) {
  return atomicNumber >= 1 && atomicNumber <= 118;
}

/** Known isotope record for (protons, neutrons) or null when no such nuclide has ever been observed. */
export function findNuclide(protons, neutrons) {
  const c = sharedClassify(protons, neutrons);
  return c.exists ? { massNumber: protons + neutrons, stability: c.status === "stable" ? "stable" : "radioactive", ...c } : null;
}

export function defaultNeutronsFor(atomicNumber) {
  const ref = sharedReference(atomicNumber);
  return ref ? ref.neutrons : null;
}

/** All KNOWN isotopes of an element that are real atoms (stable or radioactive, not fleeting resonances). */
export function curatedIsotopesFor(atomicNumber) {
  return isotopesOf(atomicNumber).filter((i) => i.status !== "unbound").map((i) => ({ ...i, stability: i.status === "stable" ? "stable" : "radioactive" }));
}

/** Compact teaching set for "Compare Isotopes": all stable isotopes, plus the longest-lived radioactive ones
 * until at least 3 are shown (max 5). */
export function comparisonIsotopesFor(atomicNumber) {
  const all = curatedIsotopesFor(atomicNumber);
  const stable = all.filter((i) => i.status === "stable");
  const rad = all.filter((i) => i.status === "radioactive").sort((a, b) => b.halfLifeSeconds - a.halfLifeSeconds);
  const picked = [...stable];
  for (const r of rad) { if (picked.length >= Math.max(3, stable.length) || picked.length >= 5) break; picked.push(r); }
  return picked.slice(0, 6).sort((a, b) => a.massNumber - b.massNumber);
}

/** "stable" | "radioactive" | "unbound" | "unobserved" | "out-of-range" | "none" | "no-data" */
export function classifyNuclide(protons, neutrons) {
  return sharedClassify(protons, neutrons).status;
}

export { neutronRange };
