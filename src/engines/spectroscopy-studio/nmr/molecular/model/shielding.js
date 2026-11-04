// Qualitative shielding / electron-density helpers and the chemical-shift relationships used by the explorer. PURE.
//
// Honest scope: the colouring is QUALITATIVE. Heavy atoms are coloured from the sum of Pauling-electronegativity differences to
// their neighbours (electron-rich if their neighbours are less electronegative, electron-poor if more); hydrogens are coloured from the
// representative chemical shift of their environment (low delta = high electron density around the proton, i.e. shielded).
// It is NOT a computed electron density or electrostatic potential.

import { ATOMIC } from "./molecules.js";

export const DELTA_SCALE_MAX = 11; // ppm: the 'most deshielded' end of the colour scale (covers the 9.4-10 aldehyde row)

/** 0 = most shielded (low delta), 1 = most deshielded (high delta). */
export const deshieldingIndex = (delta) => Math.min(1, Math.max(0, delta / DELTA_SCALE_MAX));

/** Net bond polarity felt by an atom: > 0 means electron density is drawn AWAY (electron-poor), < 0 means electron-rich. */
export function polarityIndex(mol, atomIdx) {
  const a = mol.atoms[atomIdx]; const en = ATOMIC[a.el].pauling;
  let sum = 0;
  for (const n of a.neighbours) {
    const order = mol.bonds.find((b) => (b.a === atomIdx && b.b === n) || (b.a === n && b.b === atomIdx)).order;
    sum += (ATOMIC[mol.atoms[n].el].pauling - en) * (order === 2 ? 1.4 : 1);
  }
  return sum;
}

/**
 * 0..1 "electron-poor" score for the density view: hydrogens from delta, heavy atoms from bond polarity (clamped).
 * 0 = electron-rich / shielded end of the colour scale, 1 = electron-poor / deshielded end.
 */
export function densityScore(mol, atomIdx) {
  const a = mol.atoms[atomIdx];
  if (a.isHydrogen) return deshieldingIndex(mol.environments.find((e) => e.atoms.includes(atomIdx)).delta);
  const p = polarityIndex(mol, atomIdx);
  return Math.min(1, Math.max(0, 0.5 + p / 4));
}

/** Interpolated colour (hex) of the density scale: teal (electron-rich) -> pale violet -> amber (electron-poor). */
export function densityColor(score) {
  const stops = [[0, [45, 212, 191]], [0.5, [167, 139, 250]], [1, [251, 191, 36]]];
  const s = Math.min(1, Math.max(0, score));
  for (let i = 1; i < stops.length; i += 1) {
    if (s <= stops[i][0]) {
      const [t0, c0] = stops[i - 1]; const [t1, c1] = stops[i]; const u = (s - t0) / (t1 - t0);
      return `#${c0.map((v, k) => Math.round(v + (c1[k] - v) * u).toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return "#fbbf24";
}

// ---- chemical-shift relationships (definitions) ----
/** delta = (nu - nu_ref) / nu_ref x 10^6 */
export const deltaFromFrequencies = (nu, nuRef) => ((nu - nuRef) / nuRef) * 1e6;
/** Resonance frequency of a proton with shielding constant sigma in field B0: nu = (gamma/2pi) B0 (1 - sigma). */
export const nuFromShielding = (nu0, sigma) => nu0 * (1 - sigma);
/** Frequency offset from TMS in Hz for a given delta at operating frequency nu0 (MHz): delta [ppm] x nu0 [MHz]. */
export const offsetHz = (delta, nu0MHz) => delta * nu0MHz;
/** Extra effective field relative to the reference at field b0 (T): B0 x delta x 1e-6, in microtesla (a tiny fraction of B0). */
export const fieldShiftMicroTesla = (delta, b0Tesla) => b0Tesla * delta; // T x ppm = micro-T

/** Short qualitative reading of an environment for the explainer: where it sits and why (uses the data's descriptor). */
export function shieldingVerdict(env) {
  const d = env.delta;
  if (env.exchangeable) return { level: "variable", text: "Variable: an exchangeable O–H proton's shift depends on hydrogen bonding, solvent, concentration and temperature, so no single shielding explanation applies." };
  if (d < 1.5) return { level: "shielded", text: "Strongly shielded: little electron-withdrawing influence nearby, so the local electron circulation reduces the field at the proton most (low δ, upfield)." };
  if (d < 3) return { level: "moderate", text: "Moderately deshielded: an electron-withdrawing group (such as C=O) a bond or two away reduces the electron density around the proton (δ rises, downfield of alkyl H)." };
  if (d < 5) return { level: "deshielded", text: "Deshielded: the proton's carbon is bonded to an electronegative oxygen, which pulls electron density away, so less shielding opposes B₀ and the signal moves downfield (higher δ)." };
  return { level: "very deshielded", text: "Very strongly deshielded: the proton is on a carbonyl carbon. Electron withdrawal plus the magnetic anisotropy of the C=O bond (a local-field effect, not just electron density) move it far downfield." };
}
