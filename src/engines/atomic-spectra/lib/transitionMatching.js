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

/** Ionization energy (eV) needed to remove the electron entirely from
 * `fromLevel` -- the transition to n=Infinity. */
export function ionizationEnergyEv(fromLevel) {
  return transitionEnergyEv(fromLevel, Infinity);
}

/** The PRIMARY matcher for the photon-energy-first interaction: given
 * a photon energy directly (not a wavelength -- energy IS the
 * student-controlled quantity in this design), returns one of three
 * distinct outcomes, each scientifically different and never conflated:
 *   - { kind: "bound", toLevel, deltaEv, ... } -- exact discrete
 *     bound-to-bound absorption (tolerance-based match, same rule as
 *     matchAbsorption above).
 *   - { kind: "ionization", excessKeEv } -- energy at or ABOVE the
 *     ionization threshold; the atom ionizes and any excess energy
 *     becomes the ejected electron's kinetic energy. This is
 *     deliberately a >= rule, not a tolerance-window match, since
 *     ionization is a continuum process, not a discrete level --
 *     unlike bound transitions, "more energy" genuinely still ionizes.
 *   - null -- energy matches neither a bound transition nor meets the
 *     ionization threshold, so nothing is absorbed. Explicitly, a
 *     photon with MORE energy than a bound transition's ΔE (but still
 *     below the ionization threshold) is NOT absorbed into that bound
 *     level -- "more energy" is not automatically "good enough" for a
 *     discrete transition, only for ionization. */
export function matchAbsorptionByEnergy(fromLevel, photonEnergyEv) {
  // Ionization is checked FIRST and takes priority whenever energy
  // meets the threshold -- verified this matters: near the ionization
  // limit, a high-n bound transition's tolerance window can numerically
  // overlap the threshold itself (e.g. from n=1, the n=6 transition's
  // +3% tolerance edge reaches 13.62eV, overlapping the 13.60eV
  // threshold), and checking bound transitions first would have
  // wrongly classified an exact-threshold photon as a bound n=6
  // absorption instead of ionization. Checking >= threshold first
  // keeps the two concepts cleanly separated as required.
  const threshold = ionizationEnergyEv(fromLevel);
  if (photonEnergyEv >= threshold) {
    return { kind: "ionization", thresholdEv: threshold, excessKeEv: photonEnergyEv - threshold };
  }
  const boundCandidates = availableUpwardTransitions(fromLevel).filter((t) => t.toLevel !== Infinity);
  for (const t of boundCandidates) {
    const tolerance = t.deltaEv * ENERGY_TOLERANCE_FRACTION;
    if (Math.abs(photonEnergyEv - t.deltaEv) <= tolerance) return { kind: "bound", ...t };
  }
  return null;
}

export { hydrogenEnergyEv };
