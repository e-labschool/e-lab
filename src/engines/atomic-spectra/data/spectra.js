// Curated real spectral data. NEVER invented -- values checked against
// independent published sources before inclusion (see the project's
// working notes for this engine). Deliberately limited to elements
// with genuinely verified data rather than padding the selector with
// lower-confidence entries: "better four reliable examples than many
// invented spectra" -- and honestly, better TWO solid ones than four
// where two weren't independently checked. He/Ne are not included in
// this pass; the architecture (below) supports adding them once their
// lines are similarly verified.
//
// Sodium D-line values cross-checked against two independent sources
// (a published atomic-transitions review, arxiv.org/pdf/2012.10256;
// and a NIST-referencing physicist's answer, physlink.com) -- both
// give 588.995 / 589.592 nm, which is also exactly the pair the
// simplified 589.0 / 589.6 nm figures (used throughout chemistry
// teaching, including this brief itself) round to.
//
// Hydrogen's Balmer lines are DERIVED from the verified E_n=-13.6/n^2
// model (lib/hydrogenEnergy.js + photonMath.js) rather than a second,
// separately-typed dataset -- for hydrogen specifically, the formula
// IS the reliable source, so storing a redundant hand-typed copy here
// would only be a second place for a transcription error to creep in.
import { transitionEnergyEv } from "../lib/hydrogenEnergy.js";
import { energyEvToWavelengthNm } from "../lib/photonMath.js";

function balmerLine(nFrom) {
  return energyEvToWavelengthNm(transitionEnergyEv(nFrom, 2));
}

export const SPECTRA = {
  Na: {
    symbol: "Na",
    name: "Sodium",
    species: "atomic vapour",
    lines: [
      { wavelengthNm: 588.995, relativeIntensity: 2, label: "D2" },
      { wavelengthNm: 589.592, relativeIntensity: 1, label: "D1" },
    ],
  },
  H: {
    symbol: "H",
    name: "Hydrogen",
    species: "atomic gas",
    // Balmer series, transitions ending at n=2 -- the visible hydrogen lines.
    lines: [
      { wavelengthNm: balmerLine(3), transition: { from: 3, to: 2 }, label: "H\u03B1" },
      { wavelengthNm: balmerLine(4), transition: { from: 4, to: 2 }, label: "H\u03B2" },
      { wavelengthNm: balmerLine(5), transition: { from: 5, to: 2 }, label: "H\u03B3" },
      { wavelengthNm: balmerLine(6), transition: { from: 6, to: 2 }, label: "H\u03B4" },
    ],
  },
};

// COLD hydrogen (atoms in the ground state, n = 1) can only absorb photons that lift the electron from n = 1: the LYMAN series
// (n = 1 -> 2, 3, 4, ...), all in the ultraviolet. It shows NO dark Balmer lines. Balmer absorption needs atoms already in n = 2
// (hot, excited gas, e.g. a star's atmosphere). The two cases are separate so the simulation cannot show the wrong one.
function lymanLine(nTo) {
  return energyEvToWavelengthNm(transitionEnergyEv(1, nTo));
}
export const HYDROGEN_ABSORPTION = {
  cold: {
    condition: "cold",
    label: "Cool gas (atoms in the ground state, n = 1)",
    series: "Lyman",
    lines: [2, 3, 4, 5, 6].map((n) => ({ wavelengthNm: lymanLine(n), transition: { from: 1, to: n }, label: n === 2 ? "Ly\u03B1" : n === 3 ? "Ly\u03B2" : n === 4 ? "Ly\u03B3" : `1\u2192${n}` })),
    visibleLines: [],
  },
  hot: {
    condition: "hot",
    label: "Hot gas (atoms already excited to n = 2, e.g. a star's atmosphere)",
    series: "Balmer",
    lines: SPECTRA.H.lines,
    visibleLines: SPECTRA.H.lines,
  },
};

/** Absorption lines for the element and gas condition. Sodium vapour absorbs the D lines from its ground state in either case. */
export function absorptionFor(symbol, condition = "cold") {
  if (symbol === "H") return HYDROGEN_ABSORPTION[condition === "hot" ? "hot" : "cold"];
  const s = SPECTRA[symbol];
  return s ? { condition: "cold", label: "Cool gas (ground-state atoms)", series: null, lines: s.lines, visibleLines: s.lines } : null;
}

export const AVAILABLE_ELEMENTS = Object.keys(SPECTRA);

export function spectrumFor(symbol) {
  return SPECTRA[symbol] ?? null;
}
