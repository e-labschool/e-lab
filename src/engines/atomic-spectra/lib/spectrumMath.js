// Wavelength -> horizontal position mapping for the spectrum display --
// a single, real linear function of wavelength, never manually-placed
// coordinates. This is what guarantees the sodium doublet renders as
// two genuinely close lines rather than aesthetically-spread ones.
export const VISIBLE_MIN_NM = 380;
export const VISIBLE_MAX_NM = 750;

/** Returns 0..1 (clamped) for a wavelength's position within the axis
 * range -- the caller multiplies by the actual pixel/viewBox width. */
export function wavelengthToPosition(wavelengthNm, min = VISIBLE_MIN_NM, max = VISIBLE_MAX_NM) {
  const t = (wavelengthNm - min) / (max - min);
  return Math.max(0, Math.min(1, t));
}
