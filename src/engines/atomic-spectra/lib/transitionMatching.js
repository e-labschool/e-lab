// Matches a (student-controlled) incoming photon wavelength against the
// hydrogen model's available transitions FROM a given starting level --
// solves the "impossible slider precision" problem explicitly called
// out in the brief: the underlying transition energies are exact, but
// matching a free-dragged wavelength slider against them needs a
// sensible tolerance, or a match would be practically unreachable by
// dragging.
import { hydrogenEnergyEv, transitionEnergyEv } from "./hydrogenEnergy.js";
import { energyEvToWavelengthNm, wavelengthNmToEnergyEv } from "./photonMath.js";

export const MAX_LEVEL = 6;

/** Every level ABOVE `fromLevel` (n=1..6, plus Infinity for the
 * ionization limit) that a photon absorbed from `fromLevel` could
 * reach -- i.e. every valid absorption target from the current state,
 * recalculated fresh each time (never cached against a stale starting
 * level, so e.g. "already at n=2" correctly recomputes available
 * upward transitions from n=2, not n=1). */
export function availableUpwardTransitions(fromLevel) {
  const targets = [];
  for (let n = fromLevel + 1; n <= MAX_LEVEL; n++) targets.push(n);
  targets.push(Infinity); // ionization
  return targets.map((toLevel) => {
    const deltaEv = transitionEnergyEv(fromLevel, toLevel);
    return { toLevel, deltaEv, wavelengthNm: energyEvToWavelengthNm(deltaEv) };
  });
}

/** Every level BELOW `fromLevel` an electron could emit down to. */
export function availableDownwardTransitions(fromLevel) {
  const targets = [];
  for (let n = 1; n < fromLevel; n++) targets.push(n);
  return targets.map((toLevel) => {
    const deltaEv = transitionEnergyEv(fromLevel, toLevel);
    return { toLevel, deltaEv, wavelengthNm: energyEvToWavelengthNm(deltaEv) };
  });
}

// A tolerance in eV, not nm -- using a fixed nm tolerance would make
// matching UNFAIRLY easy for large-gap, short-wavelength transitions
// and unfairly hard for closely-spaced, long-wavelength ones, since
// dE/dlambda is highly wavelength-dependent. 3% of the target
// transition's own energy is generous enough for a real slider drag to
// land within reliably, while still requiring the student to have
// genuinely found the right region rather than absorbing at any input.
const ENERGY_TOLERANCE_FRACTION = 0.03;

/** Checks whether `incomingWavelengthNm` matches any available upward
 * transition from `fromLevel` within tolerance -- returns the matched
 * transition (with exact values, never the imprecise input echoed
 * back) or null. */
export function matchAbsorption(fromLevel, incomingWavelengthNm) {
  const incomingEv = wavelengthNmToEnergyEv(incomingWavelengthNm);
  if (incomingEv == null) return null;
  const candidates = availableUpwardTransitions(fromLevel);
  for (const t of candidates) {
    const tolerance = t.deltaEv * ENERGY_TOLERANCE_FRACTION;
    if (Math.abs(incomingEv - t.deltaEv) <= tolerance) return t;
  }
  return null;
}

export { hydrogenEnergyEv };
