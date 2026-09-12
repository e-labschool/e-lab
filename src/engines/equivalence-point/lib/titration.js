// A real, fixed HCl + NaOH titration model — every value shown to the
// student is computed from stoichiometry, never animated between preset
// numbers. All volumes in dm3 (litres), concentrations in mol/dm3.
//
// V0 = 40 mL of 0.100 mol/dm3 NaOH; HCl (0.100 mol/dm3) is added in
// 4 mL increments — chosen so equivalence lands on exactly the 10th
// press, giving a clean, predictable number of "little by little"
// additions rather than an arbitrary fractional press.
export const V0_NAOH = 0.040; // dm3
export const C_NAOH = 0.100; // mol/dm3
export const HCL_INCREMENT = 0.004; // dm3 per "Add HCl" press
export const C_HCL = 0.100; // mol/dm3
export const EQUIVALENCE_PRESSES = Math.round(V0_NAOH / HCL_INCREMENT); // 10

const INITIAL_MOLES_OH = V0_NAOH * C_NAOH;

/**
 * Computes the full titration state after `presses` additions of HCl.
 * Performs the stoichiometric neutralization first (net = moles OH-
 * remaining, negative once H+ is in excess), THEN derives pH from
 * whichever species is actually in excess -- this is what makes the pH
 * change sharply near equivalence rather than linearly, exactly as a
 * real titration curve does.
 */
export function computeTitrationState(presses) {
  const volumeHCl = presses * HCL_INCREMENT;
  const totalVolume = V0_NAOH + volumeHCl;
  const molesH = presses * HCL_INCREMENT * C_HCL;
  const net = INITIAL_MOLES_OH - molesH; // >0: OH- excess, <0: H+ excess, 0: equivalence

  let pH, status;
  if (Math.abs(net) < 1e-12) {
    pH = 7.0;
    status = "equivalence";
  } else if (net > 0) {
    const concOH = net / totalVolume;
    const pOH = -Math.log10(concOH);
    pH = 14 - pOH;
    status = presses === EQUIVALENCE_PRESSES - 1 ? "approaching" : "basic";
  } else {
    const concH = -net / totalVolume;
    pH = -Math.log10(concH);
    status = "acidic";
  }

  // The excess FRACTION (relative to the initial OH- charge) drives the
  // beam's tilt -- deliberately separate from pH. pH must follow the
  // true (sharp, logarithmic) titration curve; the beam's motion is
  // asked to be gradual and show "several stages", which a direct
  // pH-to-angle mapping could never do since pH barely moves for most
  // of the addition and then swings violently right at equivalence.
  const excessFraction = net / INITIAL_MOLES_OH; // 1 at start, 0 at equivalence, negative beyond

  return { presses, totalVolume, net, pH, status, excessFraction };
}

/**
 * Maps an excess fraction to a beam tilt angle in degrees. Uses a
 * square-root response so even a SMALL remaining excess (e.g. one
 * press before equivalence) still produces a clearly non-zero, clearly
 * readable tilt -- "approaching equivalence" must never look already
 * centred. Positive angle = OH- side down (basic); negative = H+ side
 * down (acidic); exactly 0 only at true equivalence.
 */
export function excessFractionToBeamAngle(excessFraction, maxAngleDeg = 16) {
  if (excessFraction === 0) return 0;
  const sign = Math.sign(excessFraction);
  const magnitude = Math.min(1, Math.abs(excessFraction));
  return sign * maxAngleDeg * Math.sqrt(magnitude);
}
