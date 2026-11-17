// Glossary terms (shown as tooltips / popovers). Plain, accurate, short.
export const GLOSSARY = {
  mixture: "Two or more substances physically mixed, not chemically bonded, in no fixed ratio. A mixture can be separated by physical methods.",
  compound: "A substance in which atoms of different elements are chemically bonded in a fixed ratio. It can only be split by a chemical reaction.",
  solute: "The substance that dissolves in a solution (for example salt in salt water).",
  solvent: "The liquid that does the dissolving (for example water). In chromatography it is also the mobile phase.",
  solution: "A homogeneous mixture of a solute dissolved in a solvent.",
  soluble: "Able to dissolve in a given solvent.",
  insoluble: "Not able to dissolve in a given solvent (sand does not dissolve in water).",
  saturated: "A solution that already holds as much solute as it can at that temperature.",
  solubility: "The mass of solute that dissolves in 100 g of solvent at a stated temperature.",
  residue: "The solid left behind on the filter paper (or in the flask) after a separation.",
  filtrate: "The liquid that passes through the filter paper.",
  distillate: "The liquid that condenses and is collected during distillation.",
  decant: "To pour off a liquid, leaving a settled solid (or a heavier layer) behind.",
  miscible: "Liquids that mix completely in all proportions (ethanol and water).",
  immiscible: "Liquids that do not mix and form separate layers (oil and water).",
  volatile: "Easily evaporated: it has a low boiling point.",
  "boiling point": "The temperature at which a pure liquid boils at normal pressure. Water 100 °C, ethanol 78 °C.",
  condenser: "A tube cooled by water in an outer jacket, where vapour turns back into liquid.",
  "anti-bumping granules": "Small pieces of porous material that give a steady stream of small bubbles so the liquid boils smoothly instead of in sudden violent bursts.",
  azeotrope: "A mixture that boils at a constant temperature and gives a vapour with the same composition as the liquid, so distillation cannot separate it further. Ethanol and water form one at about 95.6 % ethanol.",
  sublimation: "A change from solid directly to gas without passing through the liquid state. The reverse (gas to solid) is deposition.",
  "crystallisation point": "The point at which a hot solution is just saturated: if a drop is cooled on a glass rod, small crystals appear.",
  "mother liquor": "The solution left behind after crystals have formed. It still holds some solute.",
  baseline: "The pencil line on the chromatography paper where the sample is placed.",
  "solvent front": "The furthest point the solvent has reached up the paper.",
  Rf: "Retention factor: distance moved by the spot divided by distance moved by the solvent front, both measured from the baseline. Always between 0 and 1.",
  "stationary phase": "The paper in paper chromatography: the substances stick to it to different extents.",
  "mobile phase": "The solvent, which moves up the paper carrying the dissolved substances with it.",
  ferromagnetic: "Strongly attracted to a magnet (iron, cobalt and nickel).",
  azeotropic: "Of the azeotrope: see azeotrope.",
  "theoretical plate": "One stage of evaporation and condensation in a fractionating column. More plates give a better separation.",
  fraction: "One portion collected from fractional distillation, made up of substances with similar boiling points.",
  purity: "A pure substance has one component only: it melts and boils at sharp, fixed temperatures.",
};

export const termKeys = Object.keys(GLOSSARY);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// longest words first so that "boiling point" wins over "point"
const PATTERN = new RegExp(`(?<![A-Za-z])(${[...termKeys].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?![A-Za-z])`, "gi");

/** Split `text` into plain strings and glossary terms. Each glossary word is linked once per call (`skip` words are never linked). */
export function splitTerms(text, skip = []) {
  if (!text) return [];
  const out = []; const seen = new Set(skip.map((s) => s.toLowerCase())); let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const key = termKeys.find((k) => k.toLowerCase() === m[1].toLowerCase());
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ term: key, text: m[1] });
    last = m.index + m[1].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
