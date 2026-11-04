// Centralized, physically-sensible wavelength -> display-colour mapping
// -- used consistently everywhere a spectral line, wave animation, or
// wavelength label needs a colour, rather than ad-hoc CSS colours per
// component. This is an APPROXIMATE display mapping (monitor RGB
// cannot literally reproduce monochromatic spectral colour) but the
// hue progression follows the real visible-spectrum order (violet ->
// blue -> green -> yellow -> orange -> red), not an arbitrary palette.
// Based on the well-known Bruton (1996) approximation, a standard
// reference for this exact problem.
export function wavelengthToRGB(wavelengthNm) {
  let r = 0, g = 0, b = 0;
  const w = wavelengthNm;

  if (w >= 380 && w < 440) { r = -(w - 440) / (440 - 380); g = 0; b = 1; }
  else if (w >= 440 && w < 490) { r = 0; g = (w - 440) / (490 - 440); b = 1; }
  else if (w >= 490 && w < 510) { r = 0; g = 1; b = -(w - 510) / (510 - 490); }
  else if (w >= 510 && w < 580) { r = (w - 510) / (580 - 510); g = 1; b = 0; }
  else if (w >= 580 && w < 645) { r = 1; g = -(w - 645) / (645 - 580); b = 0; }
  else if (w >= 645 && w <= 750) { r = 1; g = 0; b = 0; }

  // Intensity taper near the visible edges, so 381nm and 749nm don't
  // render at full brightness the same as 550nm.
  let factor = 1;
  if (w >= 380 && w < 420) factor = 0.3 + (0.7 * (w - 380)) / (420 - 380);
  else if (w > 700 && w <= 750) factor = 0.3 + (0.7 * (750 - w)) / (750 - 700);
  else if (w < 380 || w > 750) factor = 0; // outside visible -- caller should classify separately, this just returns black

  const gamma = 0.8;
  const toByte = (c) => Math.round(255 * (c * factor) ** gamma);
  return { r: toByte(r), g: toByte(g), b: toByte(b) };
}

export function wavelengthToCSS(wavelengthNm) {
  const { r, g, b } = wavelengthToRGB(wavelengthNm);
  return `rgb(${r}, ${g}, ${b})`;
}
