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

export const AVAILABLE_ELEMENTS = Object.keys(SPECTRA);

export function spectrumFor(symbol) {
  return SPECTRA[symbol] ?? null;
}
