// The schematic gas-phase spectrum of a small molecule from its IR-active normal modes (stage 6). Pure.
//   * one band per IR-active mode group, at its (literature) wavenumber; IR-inactive modes give NO band;
//   * peak absorbance from the model's relative intensity, compressed so that weak bands stay visible: A = 0.2 + 1.1 sqrt(relIntensity);
//   * widths 36 cm^-1 (stretches) and 46 cm^-1 (bends), mostly Lorentzian. Real gas-phase bands consist of many sharp rotational lines (a "rotational envelope");
//     that fine structure is not modelled.
// Relative band depths are therefore ILLUSTRATIVE: the point-charge dipole model gives qualitative intensities only.
export const bandFor = (mode) => ({ nu: mode.wn, fwhm: mode.kind === "bend" ? 46 : 36, A: 0.2 + 1.1 * Math.sqrt(mode.relIntensity), eta: 0.8, modeId: mode.id, label: mode.label });
/** Modes in the order the spectrum is built: from high to low wavenumber, i.e. left to right on the axis. */
export const buildOrder = (modes) => [...modes].sort((a, b) => b.wn - a.wn);
export const gasBands = (modes) => buildOrder(modes).filter((m) => m.active).map(bandFor);
