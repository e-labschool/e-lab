// Indicator colour model for the flask tint (pure visual layer: reads a calculated pH, never feeds back into chemistry).
import { INDICATORS } from "./constants.js";

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [0, 1, 2, 3].map((i) => lerp(c1[i], c2[i], Math.max(0, Math.min(1, t))));
const css = (c) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${c[3].toFixed(2)})`;

const PALETTE = {
  "methyl-orange": [[196, 66, 58, 0.62], [214, 132, 46, 0.62], [208, 188, 64, 0.62]], // red, orange, yellow
  "bromothymol-blue": [[214, 188, 64, 0.6], [120, 178, 120, 0.6], [86, 140, 196, 0.62]], // yellow, green, blue
  phenolphthalein: [[205, 215, 228, 0.16], [224, 130, 172, 0.45], [224, 120, 168, 0.62]], // colourless, pale pink, pink
};

export function indicatorColourCss(id, pH) {
  const ind = INDICATORS[id]; const [a, m, b] = PALETTE[id];
  if (pH <= ind.low) return css(a);
  if (pH >= ind.high) return css(b);
  const mid = (ind.low + ind.high) / 2;
  return css(pH <= mid ? mix(a, m, (pH - ind.low) / (mid - ind.low)) : mix(m, b, (pH - mid) / (ind.high - mid)));
}

/** Colour NAME for text (colour must never be the only carrier of the state). */
export function indicatorColourName(id, pH) {
  const ind = INDICATORS[id];
  if (pH <= ind.low) return ind.acidColour;
  if (pH >= ind.high) return ind.baseColour;
  return "mid-change (" + (id === "phenolphthalein" ? "pale pink" : id === "methyl-orange" ? "orange" : "green") + ")";
}

/** The pH at which an indicator is taken to "end" (middle of its range) and whether it is a sensible choice for a curve. */
export const endpointPH = (id) => (INDICATORS[id].low + INDICATORS[id].high) / 2;
/** Suitable when the whole transition range lies within the steep (vertical) part: between the pH at V_eq -1 % and V_eq +1 %. */
export function isSuitable(id, titration) {
  const ind = INDICATORS[id]; const lo = Math.min(titration.steep.pHLow, titration.steep.pHHigh); const hi = Math.max(titration.steep.pHLow, titration.steep.pHHigh);
  return ind.low >= lo - 0.5 && ind.high <= hi + 0.5;
}
/** Recommended indicator by pair (what the IB course teaches). */
export function recommendedIndicator(titration) {
  if (titration.kind === "WA-WB") return null;
  return titration.kind === "SA-SB" ? "bromothymol-blue" : titration.kind === "WA-SB" ? "phenolphthalein" : "methyl-orange";
}
