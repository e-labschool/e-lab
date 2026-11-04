// Maps the real, physically-meaningful wavelength range (visible light,
// 400-700nm -- the range where c=f*lambda and E=hf give pedagogically
// legible values) to a legible ON-SCREEN pixel wavelength range for the
// SVG wave shapes. This is purely a DISPLAY scale, kept separate from
// the actual physics in waveMath.js -- the underlying wavelength value
// is always the same real nm number; only its two representations
// (nm for the physics readout, px for the drawn wave) differ.
export const WAVELENGTH_NM_MIN = 400;
export const WAVELENGTH_NM_MAX = 700;
const WAVELENGTH_PX_MIN = 50;
const WAVELENGTH_PX_MAX = 140;

export function wavelengthNmToPx(nm) {
  const t = (nm - WAVELENGTH_NM_MIN) / (WAVELENGTH_NM_MAX - WAVELENGTH_NM_MIN);
  return WAVELENGTH_PX_MIN + t * (WAVELENGTH_PX_MAX - WAVELENGTH_PX_MIN);
}

// Amplitude is genuinely independent of the EM-radiation relationship
// (per instruction: "do not imply that amplitude controls photon
// energy") -- its own small display range, unrelated to wavelength/nm.
export const AMPLITUDE_PX_MIN = 14;
export const AMPLITUDE_PX_MAX = 46;
