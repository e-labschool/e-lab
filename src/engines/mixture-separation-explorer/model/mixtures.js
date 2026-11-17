// Mixtures (samples) of the Mixture Separation Lab. A sample is { label, parts: [{ sub, form, g }] } with form:
//   solid      undissolved solid (grains)
//   liquid     a liquid (the solvent, or a second liquid)
//   dissolved  dissolved in the liquid(s) of the sample (ions / molecules; far too small to be filtered)
// Masses are in grams. Pure helpers only.
import { SUBSTANCES, subName } from "./chem.js";

export const part = (sub, form, g) => ({ sub, form, g });
export const makeSample = (label, parts) => ({ label, parts: parts.filter((p) => p.g > 1e-9).map((p) => ({ ...p })) });
export const cloneSample = (s) => ({ label: s.label, parts: s.parts.map((p) => ({ ...p })) });
export const totalMass = (s) => s.parts.reduce((a, p) => a + p.g, 0);
export const gramsOf = (s, sub) => s.parts.filter((p) => p.sub === sub).reduce((a, p) => a + p.g, 0);
export const hasForm = (s, form) => s.parts.some((p) => p.form === form && p.g > 1e-9);
export const subsIn = (s) => [...new Set(s.parts.map((p) => p.sub))];
export const isEmpty = (s) => !s || totalMass(s) < 1e-6;

/** Merge duplicate (sub, form) parts, drop empties. */
export function normalise(s) {
  const m = new Map();
  for (const p of s.parts) { if (p.g <= 1e-9) continue; const k = `${p.sub}|${p.form}`; m.set(k, (m.get(k) ?? 0) + p.g); }
  return { ...s, parts: [...m.entries()].map(([k, g]) => { const [sub, form] = k.split("|"); return { sub, form, g }; }) };
}

/** The substance that makes up most of the mass, and its mass fraction. */
export function dominant(s) {
  const t = totalMass(s); if (t <= 0) return null;
  const by = {};
  for (const p of s.parts) by[p.sub] = (by[p.sub] ?? 0) + p.g;
  const [sub, g] = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  return { sub, fraction: g / t };
}

/** Human description, e.g. "sand (20 g), water (100 g)". */
export const describeSample = (s) => (isEmpty(s) ? "empty" : s.parts.map((p) => `${subName(p.sub).toLowerCase()}${p.form === "dissolved" ? " (dissolved)" : ""} ${fmtG(p.g)}`).join(", "));
export const fmtG = (g) => (g >= 10 ? `${Math.round(g)} g` : g >= 1 ? `${g.toFixed(1)} g` : g >= 0.1 ? `${g.toFixed(2)} g` : `${g.toFixed(3)} g`);

/** Mass fraction of `sub` in the sample (any form). */
export const fractionOf = (s, sub) => { const t = totalMass(s); return t > 0 ? gramsOf(s, sub) / t : 0; };

// kind: how a chemist would classify it; best: the methods a competent chemist would choose, with the property that decides.
export const MIXTURES = [
  {
    id: "muddy-water", name: "Muddy water", short: "Sand in water", kind: "Heterogeneous: insoluble solid in a liquid",
    parts: [part("sand", "solid", 20), part("water", "liquid", 100)],
    best: ["filtration", "decanting"], deciding: "Sand does not dissolve and its grains are far bigger than the pores in filter paper.",
    levels: ["IGCSE", "DP"],
  },
  {
    id: "salt-solution", name: "Salt solution", short: "NaCl in water", kind: "Homogeneous: a solid dissolved in a liquid",
    parts: [part("salt", "dissolved", 10), part("water", "liquid", 100)],
    best: ["evaporation", "simple-distillation"], deciding: "Water boils at 100 °C; sodium chloride does not boil (its melting point is 801 °C), so only the water leaves.",
    levels: ["IGCSE", "DP"],
  },
  {
    id: "sand-salt", name: "Sand and salt", short: "Two dry solids", kind: "Heterogeneous: two solids, one soluble",
    parts: [part("sand", "solid", 20), part("salt", "solid", 10)],
    best: ["dissolve"], deciding: "Salt dissolves in water but sand does not: dissolve, filter off the sand, then evaporate the filtrate.",
    levels: ["IGCSE", "DP"], needsSteps: true,
  },
  {
    id: "copper-sulfate", name: "Copper(II) sulfate solution", short: "CuSO₄ in water", kind: "Homogeneous: a solid dissolved in a liquid",
    parts: [part("copperSulfate", "dissolved", 15), part("water", "liquid", 100)],
    best: ["crystallisation"], deciding: "Its solubility rises steeply with temperature (about 21 g per 100 g water at 20 °C, 75 g at 100 °C), so a hot concentrated solution gives crystals as it cools.",
    levels: ["IGCSE", "DP"],
  },
  {
    id: "black-ink", name: "Black felt-tip ink", short: "Three dyes in water", kind: "Homogeneous: several dissolved dyes",
    parts: [part("dyeYellow", "dissolved", 0.05), part("dyeRed", "dissolved", 0.05), part("dyeBlue", "dissolved", 0.05), part("water", "liquid", 5)],
    best: ["chromatography"], deciding: "The dyes are all dissolved, but they stick to the paper and dissolve in the solvent to different extents, so they travel at different speeds.",
    levels: ["IGCSE", "DP"],
  },
  {
    id: "permanent-marker", name: "Permanent marker ink", short: "Two pigments (not water-soluble)", kind: "Homogeneous: pigments dissolved in an organic solvent",
    parts: [part("pigOrange", "dissolved", 0.05), part("pigViolet", "dissolved", 0.05), part("ethanol", "liquid", 5)],
    best: ["chromatography"], deciding: "The pigments do not dissolve in water, so the solvent must be changed to ethanol before they will move up the paper.",
    levels: ["IGCSE", "DP"],
  },
  {
    id: "oil-water", name: "Oil and water", short: "Two immiscible liquids", kind: "Heterogeneous: two liquids that do not mix",
    parts: [part("oil", "liquid", 37), part("water", "liquid", 60)],
    best: ["separating-funnel", "decanting"], deciding: "The liquids are immiscible and differ in density (oil 0.92 g/cm³, water 1.00 g/cm³): they form two layers.",
    levels: ["IGCSE", "DP"],
  },
  {
    id: "iron-sulfur", name: "Iron filings and sulfur", short: "Iron + sulfur powder", kind: "Heterogeneous mixture (not a compound: nothing has reacted)",
    parts: [part("iron", "solid", 7), part("sulfur", "solid", 4)],
    best: ["magnetic"], deciding: "Iron is attracted to a magnet; sulfur is not. Heating the mixture would make a new compound, iron(II) sulfide.",
    levels: ["IGCSE", "DP"],
  },
  {
    id: "iodine-sand", name: "Iodine and sand", short: "Subliming solid + sand", kind: "Heterogeneous: two solids, one sublimes",
    parts: [part("iodine", "solid", 5), part("sand", "solid", 20)],
    best: ["sublimation"], deciding: "Iodine changes directly from solid to vapour when warmed (sublimation); sand does not.",
    levels: ["IGCSE (enrichment)", "DP (enrichment)"],
  },
  {
    id: "ethanol-water", name: "Ethanol and water", short: "Two miscible liquids", kind: "Homogeneous: two miscible liquids",
    parts: [part("ethanol", "liquid", 40), part("water", "liquid", 60)],
    best: ["fractional-distillation"], deciding: "The liquids mix completely but boil at different temperatures (ethanol 78 °C, water 100 °C): distil, and use a column because the difference is not large.",
    levels: ["IGCSE", "DP"],
  },
  {
    id: "crude-oil", name: "Crude oil (teaching model)", short: "Hydrocarbons of different chain length", kind: "Homogeneous: miscible hydrocarbons",
    parts: [part("hexane", "liquid", 30), part("decane", "liquid", 30), part("hexadecane", "liquid", 25), part("bitumen", "liquid", 15)],
    best: ["fractional-distillation"], deciding: "Longer chains have stronger London forces and higher boiling points, so the fractions boil off one after another.",
    levels: ["IGCSE", "DP"],
  },
];

export const MIXTURE_BY_ID = Object.fromEntries(MIXTURES.map((m) => [m.id, m]));
export const getMixture = (id) => MIXTURE_BY_ID[id] ?? MIXTURES[0];
export const sampleOf = (m) => makeSample(m.name, m.parts);

export function componentList(m) {
  return [...new Set(m.parts.map((p) => p.sub))].map((id) => ({ id, ...SUBSTANCES[id] }));
}
