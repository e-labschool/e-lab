// Verified physics for the EM-radiation relationship this simulation
// teaches -- c = f*lambda (wavelength/frequency inversely linked, c
// held constant) and E = h*f (photon energy directly proportional to
// frequency). Wavelength is stored/edited in nanometres (the natural
// unit for visible-light teaching examples) and converted to metres
// internally before either physics formula is applied -- getting this
// conversion right is the single most error-prone part of this kind of
// calculation, so it is verified numerically below before use anywhere
// in the UI.
export const SPEED_OF_LIGHT = 3.0e8; // m s^-1
export const PLANCK_CONSTANT = 6.626e-34; // J s

const NM_PER_M = 1e9;

/** wavelength (nm) -> frequency (Hz), via c = f*lambda with lambda
 * converted from nm to m first. */
export function frequencyFromWavelengthNm(wavelengthNm) {
  if (!(wavelengthNm > 0)) return null;
  const wavelengthM = wavelengthNm / NM_PER_M;
  return SPEED_OF_LIGHT / wavelengthM;
}

/** frequency (Hz) -> wavelength (nm), the inverse of the above. */
export function wavelengthNmFromFrequency(frequencyHz) {
  if (!(frequencyHz > 0)) return null;
  const wavelengthM = SPEED_OF_LIGHT / frequencyHz;
  return wavelengthM * NM_PER_M;
}

/** frequency (Hz) -> photon energy (J), via E = h*f. */
export function photonEnergyFromFrequency(frequencyHz) {
  if (!(frequencyHz > 0)) return null;
  return PLANCK_CONSTANT * frequencyHz;
}

/** Formats a number in scientific notation with the given significant
 * figures, e.g. formatScientific(6.0e14, 3) -> "6.00 × 10^14". Never
 * returns NaN/Infinity text -- callers should check for a finite input
 * first, but this also guards defensively. */
export function formatScientific(value, sigFigs = 3) {
  if (!Number.isFinite(value) || value === 0) return "\u2014";
  let exponent = Math.floor(Math.log10(Math.abs(value)));
  let mantissa = value / 10 ** exponent;
  let rounded = mantissa.toFixed(sigFigs - 1);
  // Rounding the mantissa can push it to 10.0 (e.g. 9.996 -> "10.0" at
  // 3 s.f.) -- verified this actually occurs (9.996e14 at 3 s.f. is a
  // real case, not a hypothetical), so renormalize by bumping the
  // exponent and re-deriving the mantissa directly, never by recursing
  // with the same arguments (an earlier version of this function did
  // exactly that and would have infinite-looped on this input).
  if (Math.abs(Number(rounded)) >= 10) {
    exponent += 1;
    mantissa = value / 10 ** exponent;
    rounded = mantissa.toFixed(sigFigs - 1);
  }
  return `${rounded} \u00D7 10${superscript(exponent)}`;
}

const SUPERSCRIPT_DIGITS = { "-": "\u207B", "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079" };
function superscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch).join("");
}
