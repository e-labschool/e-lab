// One source of numbers AND words for the "apply the magnetic field" step, so that the slider, the energy-level diagram, the readouts and
// the explanation can never disagree. Pure; tested by scripts/test-nmr-steps.mjs.
import { TEMPERATURE_K, energyGapEV, energyGapJ, larmorHz, larmorMHz, sci } from "./constants.js";
import { excessPerMillion, polarization } from "./populations.js";

const fmtInt = (x) => Math.round(x).toLocaleString("en-US").replace(/,/g, " ");

/** Everything that depends on B0, as numbers and as the exact strings the UI shows. */
export function fieldReadouts(b0Tesla, tempK = TEMPERATURE_K) {
  const nu0Hz = larmorHz(b0Tesla); const nu0MHz = larmorMHz(b0Tesla);
  const dEJ = energyGapJ(b0Tesla); const dEeV = energyGapEV(b0Tesla);
  const P = polarization(b0Tesla, tempK); const perMillion = excessPerMillion(b0Tesla, tempK);
  return {
    b0Tesla, nu0Hz, nu0MHz, dEJ, dEeV, polarization: P, excessPerMillion: perMillion,
    text: {
      b0: `${b0Tesla.toFixed(1)} T`,
      nu0: `${nu0MHz.toFixed(1)} MHz`,
      dE: `${sci(dEJ, 2)} J`,
      dEeV: `${(dEeV * 1e6).toFixed(2)} µeV`,
      excess: `${perMillion.toFixed(0)} per million`,
      polarization: sci(P, 2),
      alpha: `${fmtInt(1e6 * (1 + P) / 2)} per million`,
      beta: `${fmtInt(1e6 * (1 - P) / 2)} per million`,
    },
  };
}

/** The short explanation for the step-2 panel. `applied`: the field has been switched on (else the text describes the zero-field state). */
export function fieldSentence(b0Tesla, applied, tempK = TEMPERATURE_K) {
  const r = fieldReadouts(b0Tesla, tempK);
  if (!applied) {
    return `With no field (B₀ = 0) the two spin states have the same energy: they are degenerate. Choose a field strength (${r.text.b0}) and press Apply B₀.`;
  }
  return `In B₀ = ${r.text.b0} the two spin states differ in energy by ΔE = hν₀ = ${r.text.dE}, with ν₀ = γB₀/2π = ${r.text.nu0}. α (lower energy) is only very slightly more populated than β: about ${r.text.excess} at ${tempK} K.`;
}
