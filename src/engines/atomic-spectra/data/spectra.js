// Curated real spectral data. NEVER invented -- values checked against
// independent published sources before inclusion (see the project's
// working notes for this engine). Deliberately limited to elements
// with genuinely verified data rather than padding the selector with
// lower-confidence entries: "better four reliable examples than many
// invented spectra" -- and honestly, better TWO solid ones than four
// where two weren't independently checked. He, Ne and Hg were added later
// from the sources named further down (AS-05); Li, K and Ca flame colours
// are not included.
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

// Helium, neon and mercury (AS-05). Wavelengths are AIR values. Helium: NIST Atomic Spectra Database handbook table "Strong Lines of Helium"
// (physics.nist.gov/PhysRefData/Handbook/Tables/heliumtable2.htm, fetched 2026-11-17), He I lines 402-707 nm, relative intensities from that table
// (rescaled so the strongest is 100). Neon and mercury: HyperPhysics "Atomic Spectra" line lists (fetched 2026-11-17; Hg also agrees with the
// standard mercury-lamp lines 404.656, 435.833, 546.074, 576.960, 579.066 nm to 0.002 nm). Neon/mercury intensities are only qualitative
// (strong = 3, medium = 2, weak = 1) because no sourced relative intensities were available. lampGlow is the approximate colour the
// discharge shows to the eye (hydrogen pink-magenta, helium pale pinkish-white, neon red-orange, mercury blue-white, sodium yellow-orange).
const HE_LINES = [[402.619, 10, "He I"], [447.148, 40, "He I"], [471.315, 6, "He I"], [492.193, 4, "He I"], [501.568, 20, "He I"], [587.562, 100, "He I (D3)"], [667.815, 40, "He I"], [706.518, 20, "He I"]];
const NE_LINES = [[540.056, 1], [585.249, 3], [588.19, 2], [603.0, 2], [607.434, 3], [616.359, 2], [621.728, 2], [626.65, 2], [633.443, 3], [638.299, 2], [640.225, 3], [650.653, 3], [659.895, 2], [692.947, 2], [703.241, 3]];
const HG_LINES = [[404.656, 2, "Hg"], [407.783, 1, "Hg"], [435.833, 3, "Hg"], [491.607, 1, "Hg"], [546.074, 3, "Hg"], [576.96, 2, "Hg (doublet)"], [579.066, 2, "Hg (doublet)"]];

export const SPECTRA = {
  Na: {
    symbol: "Na",
    name: "Sodium",
    species: "atomic vapour",
    medium: "air",
    lampGlow: "#F5B534",
    lines: [
      { wavelengthNm: 588.995, relativeIntensity: 2, label: "D2" },
      { wavelengthNm: 589.592, relativeIntensity: 1, label: "D1" },
    ],
  },
  H: {
    symbol: "H",
    name: "Hydrogen",
    species: "atomic gas",
    medium: "vacuum",
    lampGlow: "#E8559F",
    // Balmer series, transitions ending at n=2 -- the visible hydrogen lines.
    lines: [
      { wavelengthNm: balmerLine(3), transition: { from: 3, to: 2 }, label: "H\u03B1" },
      { wavelengthNm: balmerLine(4), transition: { from: 4, to: 2 }, label: "H\u03B2" },
      { wavelengthNm: balmerLine(5), transition: { from: 5, to: 2 }, label: "H\u03B3" },
      { wavelengthNm: balmerLine(6), transition: { from: 6, to: 2 }, label: "H\u03B4" },
    ],
  },
  He: { symbol: "He", name: "Helium", species: "atomic gas", medium: "air", lampGlow: "#F2C7B8", lines: HE_LINES.map(([w, i, label]) => ({ wavelengthNm: w, relativeIntensity: i, label })) },
  Ne: { symbol: "Ne", name: "Neon", species: "atomic gas", medium: "air", lampGlow: "#FF6A3D", lines: NE_LINES.map(([w, i]) => ({ wavelengthNm: w, relativeIntensity: i, label: "Ne I" })) },
  Hg: { symbol: "Hg", name: "Mercury", species: "atomic vapour", medium: "air", lampGlow: "#8FB6FF", lines: HG_LINES.map(([w, i, label]) => ({ wavelengthNm: w, relativeIntensity: i, label })) },
};

/** Ground-state resonance lines (nm, vacuum) in the ultraviolet: why He, Ne and Hg vapour show no visible absorption lines when cold. Values: NIST ASD (He 58.4334, Ne 73.59/74.37, Hg 253.652). */
export const UV_RESONANCE = { He: "58.4 nm", Ne: "73.6 and 74.4 nm", Hg: "253.7 nm" };
export const ABSORBS_VISIBLE_FROM_GROUND = new Set(["H_hot", "Na"]);

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
  if (UV_RESONANCE[symbol]) return { condition: "cold", label: "Cool gas (ground-state atoms)", series: null, lines: [], visibleLines: [], resonanceUV: UV_RESONANCE[symbol] };
  if (symbol === "H") return HYDROGEN_ABSORPTION[condition === "hot" ? "hot" : "cold"];
  const s = SPECTRA[symbol];
  return s ? { condition: "cold", label: "Cool gas (ground-state atoms)", series: null, lines: s.lines, visibleLines: s.lines } : null;
}

export const AVAILABLE_ELEMENTS = Object.keys(SPECTRA);

export function spectrumFor(symbol) {
  return SPECTRA[symbol] ?? null;
}
