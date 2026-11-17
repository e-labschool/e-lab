// How a sample LOOKS (colours of liquids / solids) so the apparatus pictures match the chemistry. Pure.
import { SUBSTANCES } from "../model/chem.js";
import { gramsOf, hasForm } from "../model/mixtures.js";

export const LIQUID_LOOK = { water: "#79b9ee", ethanol: "#cfe7da", oil: "#e6b422", hexane: "#efe3a0", decane: "#e0b85c", hexadecane: "#b9722f", bitumen: "#2a2420" };

export function liquidColour(sample) {
  if (!sample) return { colour: "#79b9ee", opacity: 0.7 };
  if (gramsOf(sample, "copperSulfate") > 0) return { colour: "#2f86e0", opacity: 0.82 };
  if (gramsOf(sample, "dyeYellow") > 0 && gramsOf(sample, "dyeBlue") > 0) return { colour: "#1f2748", opacity: 0.92 };
  if (gramsOf(sample, "pigOrange") > 0) return { colour: "#b99cc0", opacity: 0.8 };
  if (gramsOf(sample, "hexane") + gramsOf(sample, "decane") + gramsOf(sample, "hexadecane") > 0) return { colour: "#c88a32", opacity: 0.85 };
  if (gramsOf(sample, "ethanol") > 0 && gramsOf(sample, "water") > 0) return { colour: "#cfe7da", opacity: 0.75 };
  if (gramsOf(sample, "water") > 0) return { colour: "#79b9ee", opacity: gramsOf(sample, "salt") > 0 ? 0.62 : 0.7 };
  const first = sample.parts.find((p) => p.form === "liquid");
  return { colour: LIQUID_LOOK[first?.sub] ?? "#cfe7da", opacity: 0.8 };
}

/** Colour of the undissolved solid heap, and a texture name. */
export function solidColour(sample) {
  const solids = sample?.parts.filter((p) => p.form === "solid") ?? [];
  if (!solids.length) return null;
  const main = solids.sort((a, b) => b.g - a.g)[0];
  return SUBSTANCES[main.sub]?.colour ?? "#d8b574";
}

export function turbidity(sample) {
  if (!sample) return 0;
  const liquid = sample.parts.filter((p) => p.form === "liquid").reduce((a, p) => a + p.g, 0);
  const solid = sample.parts.filter((p) => p.form === "solid" && SUBSTANCES[p.sub].grainMm).reduce((a, p) => a + p.g, 0);
  return liquid > 0 ? Math.min(1, (solid / liquid) * 2.5) : 0;
}

export const hasLiquid = (s) => hasForm(s, "liquid");
